import { vaultService } from '@/features/vault/service/vaultService'
import { encryptDataWithPassword, decryptDataWithPassword } from '@/shared/utils/crypto'
import { parseOtpUri } from '@/shared/utils/totp'
import { tryParseJSON, base64ToBytes } from '@/shared/utils/encoding'
import { gaMigrationStrategy } from '@/shared/utils/serializers/gauthStrategy'
import { csvStrategy } from '@/shared/utils/serializers/csvStrategy'
import { aegisStrategy } from '@/shared/utils/serializers/aegisStrategy'
import { migrationError } from '@/shared/utils/errors/migrationError'
import jsQR from 'jsqr'
import initSqlJs from 'sql.js'

/**
 * 数据迁移服务核心控制器
 * 负责智能分发不同来源与格式的导入导出请求
 */
export const dataMigrationService = {
    /**
     * 智能识别导入内容或文件的类型
     * @param {string|ArrayBuffer|Uint8Array} content - 文件文本内容或二进制数据
     * @param {string} filename - 文件名
     * @returns {'bwauth_csv'|'generic_csv'|'text'|'bwauth_json'|'encrypted'|'json'|'2fas'|'aegis'|'aegis_encrypted'|'phonefactor'|'unknown'} 返回类型标识
     */
    detectFileType(content, filename) {
        // 如果是二进制数据，尝试用更宽容的方式判断 PhoneFactor
        if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
            const bytes = content instanceof Uint8Array ? content : new Uint8Array(content)
            // 1) 检查 SQLite 文件头
            const header = 'SQLite format 3'
            let headerMatch = true
            for (let i = 0; i < header.length && i < bytes.length; i++) {
                if (bytes[i] !== header.charCodeAt(i)) { headerMatch = false; break }
            }
            if (headerMatch) return 'phonefactor'

            // 2) 快速 ASCII 搜索表/列名（容错，某些导出会保留表名字符串在文件内部）
            try {
                const hay = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
                if (hay.includes('accounts') && (hay.includes('oath_secret_key') || hay.includes('encrypted_oath_secret_key'))) return 'phonefactor'
            } catch (e) { /* ignore decode errors */ }
        }

        // 宽容的文件名匹配（包含 phonefactor 字样）
        if (filename && filename.toLowerCase().includes('phonefactor')) {
            // 如果文件名包含 phonefactor，则谨慎标记为 phonefactor（上层读取时还会再校验头/表）
            return 'phonefactor'
        }

        if (filename && filename.toLowerCase().endsWith('.csv')) {
            const firstLine = content.split('\n')[0].toLowerCase()
            if (firstLine.includes('login_totp')) return 'bwauth_csv'
            return 'generic_csv'
        }

        if (typeof content === 'string' && content.trim().startsWith('otpauth://')) {
            return 'text'
        }

        if (typeof content === 'string') {
            const json = tryParseJSON(content)
            if (json) {
                if (Array.isArray(json.items) && json.items.length > 0 && json.items[0].login && json.items[0].login.totp) return 'bwauth_json'
                if (json.encrypted === true && json.app === '2fauth') return 'encrypted'
                if (json.app === '2fauth' || Array.isArray(json.accounts) || Array.isArray(json.vault) || Array.isArray(json.secrets)) return 'json'
                if (json.schemaVersion && Array.isArray(json.services)) return '2fas'
                if (json.version === 1 && json.db && typeof json.db === 'object' && Array.isArray(json.db.entries)) return 'aegis' // Aegis unencrypted
                if (json.version === 1 && json.header && json.db && typeof json.db === 'string') return 'aegis_encrypted'
            }
        }

        if (filename) {
            const ext = filename.toLowerCase()
            if (ext.endsWith('.2fas')) return '2fas'
            if (ext.endsWith('.txt')) return 'text'
        }

        return 'unknown'
    },

    /**
     * 1. 获取所有数据 (用于导出)
     * @returns {Promise<Object[]>}
     */
    async fetchAllVault() {
        const res = await vaultService.getVault({ limit: 9999 })
        if (!res.success) throw new migrationError('无法获取账号数据', 'VAULT_FETCH_FAILED')
        return res.vault || []
    },

    /**
     * 2. 处理导出逻辑 (前端加密/格式化)
     * @param {Object[]} vault 
     * @param {string} type 
     * @param {string} password 
     * @param {string} [variant='generic'] 
     * @returns {Promise<string>} 导出的文件字符串内容
     */
    async exportData(vault, type, password, variant = 'generic') {
        const timestamp = new Date().toISOString()
        const baseData = { version: "2.0", app: "2fauth", timestamp }

        if (type === 'encrypted') {
            if (!password) throw new migrationError('加密导出需要密码', 'MISSING_PASSWORD')
            const payload = { ...baseData, accounts: vault }
            const encryptedData = await encryptDataWithPassword(payload, password)
            return JSON.stringify({
                ...baseData,
                encrypted: true,
                data: encryptedData,
                note: "This file is encrypted with your export password (AES-GCM-256 + PBKDF2)."
            }, null, 2)
        }

        if (type === 'generic_json') {
            const secrets = vault.map(acc => ({
                issuer: acc.service || 'Unknown',
                account: acc.account || '',
                secret: acc.secret,
                type: 'TOTP',
                digits: acc.digits || 6,
                period: acc.period || 30,
                algorithm: (acc.algorithm || 'SHA1').toUpperCase().replace('SHA-', 'SHA')
            }))
            return JSON.stringify({
                version: "1.0",
                exportDate: new Date().toISOString(),
                count: secrets.length,
                secrets
            }, null, 2)
        }

        if (type === 'json') {
            return JSON.stringify({ ...baseData, encrypted: false, accounts: vault }, null, 2)
        }

        if (type === '2fas') {
            const services = vault.map((acc, index) => {
                const algo = (acc.algorithm || 'SHA1')
                    .replace('SHA-1', 'SHA1')
                    .replace('SHA-256', 'SHA256')
                    .replace('SHA-512', 'SHA512')
                return {
                    name: acc.service,
                    secret: acc.secret,
                    otp: {
                        source: 'manual',
                        account: acc.account || '',
                        digits: acc.digits || 6,
                        period: acc.period || 30,
                        algorithm: algo,
                        tokenType: 'TOTP',
                        counter: 0,
                    },
                    order: { position: index },
                    badge: { color: 'Default' },
                    updatedAt: Date.now(),
                    icon: {
                        selected: 'Label',
                        label: {
                            text: (acc.service || '?').slice(0, 2).toUpperCase(),
                            backgroundColor: 'Default',
                        },
                        iconCollection: { id: 'A5B3FB65-4EC5-43E6-8EC1-49E24CA9E7AD' },
                    },
                }
            })
            return JSON.stringify({
                schemaVersion: 4,
                appVersionCode: 50316,
                appVersionName: '5.3.16',
                appOrigin: 'ios',
                groups: [],
                services
            })
        }

        if (type === 'aegis') {
            const entries = vault.map(acc => ({
                type: 'totp',
                uuid: crypto.randomUUID(),
                name: acc.account || acc.service,
                issuer: acc.service,
                info: {
                    secret: acc.secret,
                    algo: (acc.algorithm || 'SHA1').replace('SHA-', 'SHA'),
                    digits: acc.digits || 6,
                    period: acc.period || 30
                }
            }))
            return JSON.stringify({
                version: 1,
                header: { slots: null, params: null },
                db: { version: 3, entries }
            }, null, 2)
        }

        if (type === 'text') {
            return vault.map(acc => {
                const label = encodeURIComponent(`${acc.service}:${acc.account}`)
                const issuer = encodeURIComponent(acc.service)
                return `otpauth://totp/${label}?secret=${acc.secret}&issuer=${issuer}&digits=${acc.digits}&period=${acc.period}`
            }).join('\n')
        }

        if (type === 'csv') {
            if (variant === 'bitwarden') {
                let csv = 'name,secret,totp,favorite,folder\n'
                vault.forEach(acc => {
                    const name = `"${acc.service}${acc.account ? ':' + acc.account : ''}"`
                    const label = encodeURIComponent(`${acc.service}:${acc.account}`)
                    const issuer = encodeURIComponent(acc.service)
                    const totp = `"otpauth://totp/${label}?secret=${acc.secret}&issuer=${issuer}&digits=${acc.digits}&period=${acc.period}"`
                    csv += `${name},${acc.secret},${totp},0,\n`
                })
                return csv
            } else {
                // generic csv
                let csv = 'name,issuer,secret,algorithm,digits,period,type\n'
                vault.forEach(acc => {
                    const name = `"${acc.account}"`
                    const issuer = `"${acc.service}"`
                    csv += `${name},${issuer},${acc.secret},${acc.algorithm},${acc.digits},${acc.period},TOTP\n`
                })
                return csv
            }
        }

        if (type === 'bwauth') {
            const items = vault.map(acc => {
                const label = encodeURIComponent(acc.account ? `${acc.service}:${acc.account}` : acc.service)
                const issuer = encodeURIComponent(acc.service)
                const algo = (acc.algorithm || 'SHA1').replace('SHA-1', 'SHA1').replace('SHA-256', 'SHA256').replace('SHA-512', 'SHA512')
                const totp = `otpauth://totp/${label}?secret=${acc.secret}&issuer=${issuer}&algorithm=${algo}&digits=${acc.digits || 6}&period=${acc.period || 30}`
                return {
                    favorite: false,
                    id: crypto.randomUUID().toUpperCase(),
                    login: { totp, username: acc.account || '' },
                    name: acc.service,
                    type: 1
                }
            })
            return JSON.stringify({ encrypted: false, items })
        }

        throw new migrationError('未知的导出类型: ' + type, 'UNKNOWN_EXPORT_TYPE')
    },

    /**
     * 导出为 Google Authenticator 迁移协议二维码 (分批生成图片 URI)
     * @param {Object[]} vault
     * @returns {Promise<string[]>} QR Code Data URLs
     */
    async exportAsGaMigration(vault) {
        if (!vault || vault.length === 0) throw new migrationError('没有账户可以迁移', 'EMPTY_VAULT')

        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < vault.length; i += BATCH_SIZE) {
            batches.push(vault.slice(i, i + BATCH_SIZE));
        }

        const batchId = Math.floor(Math.random() * 0x7fffffff);
        const QRCode = await import('qrcode')
        const qrDataUrls = [];

        function writeVarint(val, arr) {
            while (val >= 0x80) {
                arr.push((val & 0x7f) | 0x80)
                val >>>= 7
            }
            arr.push(val)
        }

        function writeString(str, arr) {
            const bytes = new TextEncoder().encode(str)
            writeVarint(bytes.length, arr)
            for (let i = 0; i < bytes.length; i++) arr.push(bytes[i])
        }

        function writeBytes(bytes, arr) {
            writeVarint(bytes.length, arr)
            for (let i = 0; i < bytes.length; i++) arr.push(bytes[i])
        }

        for (let bIndex = 0; bIndex < batches.length; bIndex++) {
            const currentBatch = batches[bIndex];
            const payloadBytes = [];

            payloadBytes.push(16) // version = 1
            writeVarint(1, payloadBytes)
            payloadBytes.push(24) // batch_size
            writeVarint(batches.length, payloadBytes)
            payloadBytes.push(32) // batch_index
            writeVarint(bIndex, payloadBytes)
            payloadBytes.push(40) // batch_id
            writeVarint(batchId, payloadBytes)

            for (const acc of currentBatch) {
                const otpBytes = []
                const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
                const secretStr = acc.secret.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
                const sBytes = []
                let bits = 0, value = 0
                for (let i = 0; i < secretStr.length; i++) {
                    const val = ALPHABET.indexOf(secretStr[i])
                    if (val === -1) continue
                    value = (value << 5) | val
                    bits += 5
                    if (bits >= 8) {
                        sBytes.push((value >>> (bits - 8)) & 0xFF)
                        bits -= 8
                    }
                }
                if (sBytes.length > 0) {
                    otpBytes.push(10)
                    writeBytes(sBytes, otpBytes)
                }

                const name = acc.account || acc.service
                if (name) {
                    otpBytes.push(18)
                    writeString(name, otpBytes)
                }

                if (acc.service) {
                    otpBytes.push(26)
                    writeString(acc.service, otpBytes)
                }

                let algoVal = 1 // SHA1
                if (acc.algorithm === 'SHA256') algoVal = 2
                else if (acc.algorithm === 'SHA512') algoVal = 3
                otpBytes.push(32)
                writeVarint(algoVal, otpBytes)

                let digVal = 1 // SIX
                if (acc.digits === 8) digVal = 2
                otpBytes.push(40)
                writeVarint(digVal, otpBytes)

                otpBytes.push(48)
                writeVarint(2, otpBytes) // TOTP = 2

                payloadBytes.push(10)
                writeVarint(otpBytes.length, payloadBytes)
                for (let i = 0; i < otpBytes.length; i++) payloadBytes.push(otpBytes[i])
            }

            let binary = ''
            for (let i = 0; i < payloadBytes.length; i++) binary += String.fromCharCode(payloadBytes[i])
            const uri = `otpauth-migration://offline?data=${encodeURIComponent(btoa(binary))}`
            const dataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', width: 480, margin: 2 })
            qrDataUrls.push(dataUrl);
        }

        return qrDataUrls;
    },

    async exportAsHtml(vault) {
        const QRCode = await import('qrcode')
        const htmlContent = []

        htmlContent.push(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>2FAuth 备份报告</title>
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; color: #333; max-width: 1000px; margin: 0 auto; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eaeaea; padding-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; display: flex; flex-direction: column; align-items: center; background: white; page-break-inside: avoid; }
          .qr-img { width: 160px; height: 160px; margin: 10px 0; border: 1px solid #eee; }
          .service { font-weight: bold; font-size: 1.1em; color: #1a73e8; margin-bottom: 5px; word-break: break-all; }
          .account { color: #555; font-size: 0.9em; margin-bottom: 15px; word-break: break-all; }
          .code { font-family: monospace; background: #f5f5f5; padding: 5px 10px; border-radius: 4px; font-size: 1.2em; letter-spacing: 2px; }
          .footer { text-align: center; margin-top: 50px; color: #888; font-size: 0.9em; page-break-before: auto; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
            .card { box-shadow: none; border: 1px solid #999; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>2FAuth 二步验证账户备份</h1>
          <p>生成时间：${new Date().toLocaleString()}</p>
          <p class="no-print" style="color: #d93025; font-weight: bold;">⚠️ 警告：此页面包含敏感信息，请妥善保管。请使用浏览器打印功能将其保存为 PDF 或打印成纸质备份。</p>
          <button class="no-print" onclick="window.print()" style="padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">打印 / 导出 PDF</button>
        </div>
        <div class="grid">
    `)

        for (const acc of vault) {
            const label = encodeURIComponent(`${acc.account}`)
            const issuer = encodeURIComponent(acc.service)
            const uri = `otpauth://totp/${label}?secret=${acc.secret}&issuer=${issuer}&digits=${acc.digits}&period=${acc.period}`

            try {
                const qrDataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2 })
                htmlContent.push(`
          <div class="card">
            <div class="service">${acc.service}</div>
            <div class="account">${acc.account || '-'}</div>
            <img class="qr-img" src="${qrDataUrl}" alt="QR Code">
            <div class="code">${acc.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
            <div style="font-size: 0.8em; color: #888; margin-top: 8px;">${acc.algorithm} / ${acc.digits} / ${acc.period}s</div>
          </div>
        `)
            } catch (e) { }
        }

        htmlContent.push(`
        </div>
        <div class="footer"><p>This report was securely generated in the browser for backup purposes.</p></div>
      </body>
      </html>
    `)
        return htmlContent.join('\n')
    },

    /**
     * 3.0 解析PhoneFactor SQLite数据库
     * @param {ArrayBuffer} dbBuffer - SQLite数据库二进制数据
     * @returns {Promise<Object[]>} 标准化的账户列表
     * @throws {migrationError}
     */
    async parsePhoneFactor(dbBuffer) {
        try {
            // 初始化 sql.js：浏览器端优先从 /sql-wasm.wasm 或 CDN 加载 wasm，Node 环境从 node_modules 加载
            let SQL
            try {
                if (typeof window !== 'undefined') {
                    try {
                        SQL = await initSqlJs({ locateFile: file => `/sql-wasm.wasm` })
                    } catch (e) {
                        // 如果本地 public 中不存在 wasm，回退到 CDN
                        SQL = await initSqlJs({ locateFile: file => `https://unpkg.com/sql.js@1.10.3/dist/${file}` })
                    }
                } else {
                    SQL = await initSqlJs({ locateFile: file => require('path').resolve('node_modules/sql.js/dist/', file) })
                }
            } catch (e) {
                // 最后兜底，直接初始化（可能仍然抛错）
                SQL = await initSqlJs()
            }
            const db = new SQL.Database(new Uint8Array(dbBuffer))
            
            // 检查accounts表是否存在
            const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'")
            if (tables.length === 0) {
                throw new migrationError('不是有效的Microsoft Authenticator数据文件', 'INVALID_PHONEFACTOR_FILE')
            }

            // 使用 prepared statement 逐行读取，避免依赖 exec 返回的 columns/values 结构不一致
            const vault = []
            let skippedEncrypted = 0
            let skippedEmpty = 0
            const base32Re = /^[A-Z2-7]+=*$/i

            try {
                const stmt = db.prepare("SELECT name, username, oath_secret_key, encrypted_oath_secret_key FROM accounts WHERE account_type=0")
                while (stmt.step()) {
                    const record = stmt.getAsObject()
                    const name = record.name
                    const username = record.username
                    const oath_secret_key = record.oath_secret_key
                    const encrypted_oath_secret_key = record.encrypted_oath_secret_key

                    // 跳过条件：name 和 username 同时为空
                    if ((!name || String(name).trim() === '') && (!username || String(username).trim() === '')) {
                        skippedEmpty++
                        continue
                    }

                    const secret = (oath_secret_key || '').toString().trim()
                    if (!secret) {
                        if (encrypted_oath_secret_key && String(encrypted_oath_secret_key).trim() !== '') {
                            skippedEncrypted++
                            continue
                        }
                        skippedEmpty++
                        continue
                    }

                    const normalized = secret.replace(/\s+/g, '').replace(/=+$/, '')
                    if (!base32Re.test(normalized)) {
                        if (encrypted_oath_secret_key && String(encrypted_oath_secret_key).trim() !== '') {
                            skippedEncrypted++
                            continue
                        }
                        skippedEmpty++
                        continue
                    }

                    vault.push({
                        service: name || 'Unknown Service',
                        account: username || 'Unknown Account',
                        secret: secret,
                        algorithm: 'SHA1',
                        digits: 6,
                        period: 30
                    })
                }
                stmt.free()
            } catch (e) {
                db.close()
                throw new migrationError('解析 PhoneFactor 数据库失败', 'INVALID_PHONEFACTOR_FILE', e)
            }

            db.close()
            if (vault.length === 0) {
                if (skippedEncrypted > 0) throw new migrationError('PhoneFactor 文件仅包含加密的密钥，无法在前端导入', 'PHONEFACTOR_ONLY_ENCRYPTED')
                throw new migrationError('未能从 PhoneFactor 文件中提取到可导入的 TOTP 记录', 'PHONEFACTOR_NO_IMPORTABLE_ROWS')
            }
            return vault

        } catch (error) {
            if (error instanceof migrationError) {
                console.error('parsePhoneFactor migrationError:', error)
                throw error
            }
            // 打印详细调试信息到控制台，包含底层错误与缓冲长度
            try {
                const bufLen = (dbBuffer && (dbBuffer.byteLength || dbBuffer.length)) || 0
                console.error('parsePhoneFactor failed:', { message: error && error.message, stack: error && error.stack, bufferLength: bufLen, error })
            } catch (logErr) {
                console.error('parsePhoneFactor failed (logging error):', logErr)
            }
            const msg = error && error.message ? `${error.message}` : String(error)
            throw new migrationError(`不是有效的Microsoft Authenticator数据文件: ${msg}`, 'INVALID_PHONEFACTOR_FILE', error)
        }
    },

    /**
     * 3. 导入逻辑：前端解密/分发解析序列化策略
     * @param {string|ArrayBuffer} content - 文件内容或二进制数据
     * @param {string} type - 探测出的类型
     * @param {string} [password] - 加密文件的密码
     * @returns {Promise<Object[]>} 返回标准化后的金库清单
     * @throws {migrationError}
     */
    async parseImportData(content, type, password) {
        let rawVault = []

        // 处理PhoneFactor SQLite数据库
        if (type === 'phonefactor') {
            return await this.parsePhoneFactor(content)
        }

        if (type === 'bwauth_csv' || type === 'generic_csv') {
            rawVault = csvStrategy.parseCsv(content)
            content = JSON.stringify(rawVault)
            type = 'raw'
        }

        if (type === 'aegis_encrypted') {
            const parsedAegis = tryParseJSON(content)
            const decryptedDb = await aegisStrategy.decryptDatabase(parsedAegis, password)
            content = JSON.stringify(decryptedDb)
            type = 'aegis'
            password = undefined
        } else if (type === 'aegis') {
            const parsedAegis = tryParseJSON(content)
            content = JSON.stringify(parsedAegis.db)
        }

        if (type === 'encrypted') {
            if (!password) throw new migrationError('导入加密文件需要密码', 'MISSING_PASSWORD')
            try {
                let ciphertext = content
                const json = typeof content === 'string' ? tryParseJSON(content) : content
                if (json && typeof json === 'object' && json.data) ciphertext = json.data
                const decrypted = await decryptDataWithPassword(ciphertext, password)
                rawVault = decrypted.vault || decrypted.accounts || []
            } catch (e) {
                throw new migrationError('解密失败：密码错误或文件格式不兼容', 'DECRYPTION_FAILED', e)
            }
        }
        else if (type === 'json') {
            const json = typeof content === 'string' ? JSON.parse(content) : content
            if (Array.isArray(json.accounts)) rawVault = json.accounts
            else if (Array.isArray(json.vault)) rawVault = json.vault
            else if (Array.isArray(json.data)) rawVault = json.data
            else if (json.secrets) {
                rawVault = json.secrets.map(s => {
                    let account = s.account || s.label || '';
                    if (typeof account === 'string' && account.includes(':')) {
                        account = account.split(':').pop()?.trim() || account;
                    }
                    return {
                        service: s.issuer || s.service || s.name || 'Unknown',
                        account,
                        secret: s.secret || '',
                        algorithm: s.algorithm || 'SHA1',
                        digits: s.digits || 6,
                        period: s.period || 30,
                    }
                })
            } else if (Array.isArray(json)) rawVault = json
        }
        else if (type === '2fas') {
            const json = typeof content === 'string' ? JSON.parse(content) : content
            if (Array.isArray(json.services)) {
                rawVault = json.services.map(s => {
                    let account = s.otp?.account || s.account || s.username || '';
                    if (typeof account === 'string' && account.includes(':')) {
                        account = account.split(':').pop()?.trim() || account;
                    }
                    return {
                        service: s.otp?.issuer || s.name || 'Unknown',
                        account,
                        secret: s.secret || '',
                        algorithm: (s.otp?.algorithm || s.algorithm || 'SHA1').toUpperCase(),
                        digits: s.otp?.digits || s.digits || 6,
                        period: s.otp?.period || s.period || 30,
                    }
                })
            }
        }
        else if (type === 'bwauth_json') {
            const json = typeof content === 'string' ? JSON.parse(content) : content
            if (Array.isArray(json.items)) {
                json.items.forEach(item => {
                    if (item.login && item.login.totp) {
                        const accInfo = parseOtpUri(item.login.totp)
                        if (accInfo) {
                            accInfo.service = item.name || accInfo.service
                            accInfo.account = item.login.username || accInfo.account
                            rawVault.push(accInfo)
                        }
                    }
                })
            }
        }
        else if (type === 'aegis') {
            const json = typeof content === 'string' ? JSON.parse(content) : content
            const entries = json.entries || (json.db && json.db.entries) || []
            rawVault = entries.map(s => ({
                service: s.issuer || s.name || 'Unknown',
                account: s.name || '',
                secret: s.info?.secret || '',
                algorithm: s.info?.algo || 'SHA1',
                digits: s.info?.digits || 6,
                period: s.info?.period || 30,
            }))
        }
        else if (type === 'text') {
            const lines = content.split('\n')
            lines.forEach(line => {
                const acc = parseOtpUri(line.trim())
                if (acc) rawVault.push(acc)
            })
        }
        else if (type === 'bwauth_csv' || type === 'generic_csv') rawVault = csvStrategy.parseCsv(content)

        return rawVault.map(acc => {
            if (typeof acc.account === 'string' && acc.account.includes(':')) {
                acc.account = acc.account.split(':').pop()?.trim() || acc.account
            }
            if (!acc.account || acc.account.trim() === '') acc.account = acc.service || 'Unknown Account'
            return acc
        }).filter(acc => acc && acc.secret && acc.service)
    },

    /**
     * 3.1 解析 GA 二维码图片
     * @param {File} file 
     * @returns {Promise<Object[]>}
     */
    async parseGaQrImageFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image()
            const url = URL.createObjectURL(file)
            img.onload = () => {
                URL.revokeObjectURL(url)
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d', { willReadFrequently: true })
                const scales = [1.0, 1.5, 0.5, 2.0, 0.8]
                let code = null
                for (const scale of scales) {
                    canvas.width = img.width * scale
                    canvas.height = img.height * scale
                    context.imageSmoothingEnabled = false
                    context.drawImage(img, 0, 0, canvas.width, canvas.height)
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
                    code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" })
                    if (code) break;
                }

                if (!code) return reject(new migrationError('未能识别出二维码，请确认为完整清晰的截图。', 'QR_RECOGNITION_FAILED'))
                const uri = code.data
                if (!uri.startsWith('otpauth-migration://offline?data=')) return reject(new migrationError('不是有效的 Google Authenticator 迁移二维码', 'INVALID_GA_QR'))

                try {
                    const urlParams = new URL(uri).searchParams
                    const dataBase64Url = urlParams.get('data')
                    let base64 = dataBase64Url.replace(/-/g, '+').replace(/_/g, '/')
                    while (base64.length % 4) base64 += '='
                    const raw = atob(base64)
                    const dataBytes = new Uint8Array(raw.length)
                    for (let i = 0; i < raw.length; i++) dataBytes[i] = raw.charCodeAt(i)
                    resolve(gaMigrationStrategy.decodePayload(dataBytes))
                } catch (e) { reject(new migrationError('解析 Google Authenticator 数据失败', 'GA_DECODE_FAILED', e)) }
            }
            img.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new migrationError('图片读取失败，文件可能已损坏', 'IMAGE_LOAD_FAILED'))
            }
            img.src = url
        })
    },

    /**
     * 4. 批量保存到后端
     * @param {Object[]} vault
     */
    async saveImportedVault(vault) {
        return await vaultService.importVault(vault)
    }
}
