import { vaultService } from '@/features/vault/service/vaultService'
import { encryptDataWithPassword, decryptDataWithPassword } from '@/shared/utils/crypto'
import { parseOtpUri } from '@/shared/utils/totp'
import { tryParseJSON, base64ToBytes } from '@/shared/utils/encoding'
import { gaMigrationStrategy } from '@/shared/utils/serializers/gauthStrategy'
import { csvStrategy } from '@/shared/utils/serializers/csvStrategy'
import { aegisStrategy } from '@/shared/utils/serializers/aegisStrategy'
import protonStrategy from '@/shared/utils/serializers/protonStrategy'
import { migrationError } from '@/shared/utils/errors/migrationError'
import jsQR from 'jsqr'


import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import * as SQLite from 'wa-sqlite'
import { MemoryAsyncVFS } from '@/shared/utils/sqlite/MemoryAsyncVFS'

// 2FAS 加密备份的固定参数（官方格式标准）
const _2FAS_CRYPTO_CONFIG = {
    SALT_LEN: 32,
    IV_LEN: 12,
    ITERATIONS: 10000,
    ALGORITHM: 'aes-256-gcm',
    KDF: 'PBKDF2'
}

/**
 * 数据迁移服务核心控制器
 * 负责智能分发不同来源与格式的导入导出请求
 */
export const dataMigrationService = {
    /**
     * 智能识别导入内容或文件的类型
     * @param {string|ArrayBuffer|Uint8Array} content - 文件文本内容或二进制数据
     * @param {string} filename - 文件名
     * @returns {'bwauth_csv'|'generic_csv'|'text'|'bwauth_json'|'encrypted'|'json'|'2fas'|'2fas_encrypted'|'aegis'|'aegis_encrypted'|'phonefactor'|'unknown'} 返回类型标识
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

        let textContent = content
        if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
            try {
                const bytes = content instanceof Uint8Array ? content : new Uint8Array(content)
                textContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
            } catch (e) {
                textContent = ''
            }
        }

        if (filename && filename.toLowerCase().endsWith('.csv')) {
            const firstLine = typeof textContent === 'string' ? textContent.split('\n')[0].toLowerCase() : ''
            if (firstLine.includes('login_totp')) return 'bwauth_csv'
            return 'generic_csv'
        }

        if (typeof textContent === 'string' && textContent.trim().startsWith('otpauth://')) {
            return 'text'
        }

        if (typeof textContent === 'string') {
            const json = tryParseJSON(textContent)
            if (json) {
                if (Array.isArray(json.items) && json.items.length > 0 && json.items[0].login && json.items[0].login.totp) return 'bwauth_json'
                if (json.encrypted === true && json.app === '2fauth') return 'encrypted'
                if (json.app === '2fauth' || Array.isArray(json.accounts) || Array.isArray(json.vault) || Array.isArray(json.secrets)) return 'json'
                // 2FAS encrypted: schemaVersion + servicesEncrypted（colon-separated salt:iv:cipher）
                if (json.schemaVersion && json.servicesEncrypted && typeof json.servicesEncrypted === 'string') return '2fas_encrypted'
                if (json.schemaVersion && Array.isArray(json.services)) return '2fas'
                if (json.version === 1 && json.db && typeof json.db === 'object' && Array.isArray(json.db.entries)) return 'aegis' // Aegis unencrypted
                if (json.version === 1 && json.header && json.db && typeof json.db === 'string') return 'aegis_encrypted'
                if (json.version === 1 && typeof json.salt === 'string' && typeof json.content === 'string') return 'proton_encrypted'
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
     * 3.0 解密 2FAS 加密备份文件
     * @param {string} password - 用户输入的密码
     * @param {Object} encryptedJson - 2FAS 备份 JSON 对象（包含 servicesEncrypted 字段）
     * @returns {Promise<Object[]>} 标准化的 2FAS 账户列表
     * @throws {migrationError}
     */
    async decrypt2FasEncrypted(password, encryptedJson) {
        try {
            const servicesEncryptedStr = encryptedJson.servicesEncrypted
            if (!servicesEncryptedStr || typeof servicesEncryptedStr !== 'string') {
                throw new migrationError('无效的 2FAS 加密数据：找不到 servicesEncrypted 字段', 'INVALID_2FAS_ENCRYPTED')
            }

            // 解析 colon-separated 格式，允许更多冒号并将剩余部分视为密文
            const rawParts = servicesEncryptedStr.split(':')
            if (rawParts.length < 3) {
                throw new migrationError('无效的 2FAS 加密格式：应为 salt:iv:ciphertext', 'INVALID_2FAS_FORMAT')
            }
            const parts = [rawParts[0], rawParts[1], rawParts.slice(2).join(':')]

            // Base64 decode（去除空格，处理标准 base64 格式）
            const bufs = parts.map(p => Uint8Array.from(atob(p.replace(/\s+/g, '')), c => c.charCodeAt(0)))

            // Helper to concatenate multiple Uint8Arrays
            const concatBufs = (arr) => {
                const total = arr.reduce((sum, b) => sum + b.length, 0)
                const res = new Uint8Array(total)
                let off = 0
                for (const b of arr) {
                    res.set(b, off)
                    off += b.length
                }
                return res
            }

            let actualSalt, actualIv, actualCipher

            // 1. 先尝试简单规则：先定位 IV，再把剩余数据中较短的当作 salt，剩余全部当作 cipher
            const ivIndex = bufs.findIndex(b => b.length === _2FAS_CRYPTO_CONFIG.IV_LEN)
            if (ivIndex !== -1) {
                actualIv = bufs.splice(ivIndex, 1)[0]
                if (bufs.length > 0) {
                    // 选取最短的剩余部分作为 salt（cipher 往往远大于 salt）
                    let saltIdx = 0
                    for (let i = 1; i < bufs.length; i++) {
                        if (bufs[i].length < bufs[saltIdx].length) saltIdx = i
                    }
                    actualSalt = bufs.splice(saltIdx, 1)[0]
                    // 剩余的部分拼接成 cipher
                    actualCipher = bufs.length === 1 ? bufs[0] : concatBufs(bufs)
                }
            }

            if (!actualSalt || !actualIv || !actualCipher) {
                // 简单规则失败时回退到旧的排列检测逻辑
                let found = false
                const allBufs = bufs.slice()
                const permutations = [
                    { salt: bufs[1], iv: bufs[2], cipher: bufs[0], name: 'bufs[1]=salt, bufs[2]=iv, bufs[0]=cipher' },
                    {
                        salt: bufs.length > 1 && bufs[1].length >= 44 ? bufs[1].slice(0, 32) : null,
                        iv: bufs.length > 1 && bufs[1].length >= 44 ? bufs[1].slice(32, 44) : null,
                        cipher: bufs[0],
                        name: 'salt/iv extracted from bufs[1]'
                    },
                    {
                        salt: bufs[0].slice(0, 32), iv: bufs[0].slice(32, 44), cipher: bufs[0].slice(44),
                        name: 'salt/iv extracted from bufs[0]'
                    }
                ]

                for (const perm of permutations) {
                    if (!perm.salt || !perm.iv || !perm.cipher) continue
                    if (perm.iv.length !== _2FAS_CRYPTO_CONFIG.IV_LEN) continue

                    try {
                        const testPasswordBuf = new TextEncoder().encode(password)
                        const testKeyMaterial = await crypto.subtle.importKey('raw', testPasswordBuf, { name: 'PBKDF2' }, false, ['deriveKey'])
                        const testKey = await crypto.subtle.deriveKey(
                            { name: 'PBKDF2', salt: perm.salt, iterations: _2FAS_CRYPTO_CONFIG.ITERATIONS, hash: 'SHA-256' },
                            testKeyMaterial,
                            { name: 'AES-GCM', length: 256 },
                            false,
                            ['decrypt']
                        )

                        if (perm.cipher.length >= 16) {
                            const testAuthTag = perm.cipher.slice(perm.cipher.length - 16)
                            const testEncData = perm.cipher.slice(0, perm.cipher.length - 16)
                            const testDecrypted = await crypto.subtle.decrypt(
                                { name: 'AES-GCM', iv: perm.iv },
                                testKey,
                                new Uint8Array([...testEncData, ...testAuthTag])
                            )
                            const testPlain = new TextDecoder().decode(testDecrypted)
                            JSON.parse(testPlain)

                            actualSalt = perm.salt
                            actualIv = perm.iv
                            actualCipher = perm.cipher
                            found = true
                            console.debug('[decrypt2FasEncrypted] permutation succeeded with:', perm.name)
                            break
                        }
                    } catch (e) {
                        // ignore
                    }
                }

                if (!found && !actualSalt) {
                    // 回退最保守的顺序
                    actualSalt = bufs[0]
                    actualIv = bufs[1]
                    actualCipher = bufs[2]
                    if (actualSalt.length !== _2FAS_CRYPTO_CONFIG.SALT_LEN && actualIv.length === _2FAS_CRYPTO_CONFIG.SALT_LEN) {
                        [actualSalt, actualIv] = [actualIv, actualSalt]
                    }
                    if (actualIv.length !== _2FAS_CRYPTO_CONFIG.IV_LEN && actualCipher.length === _2FAS_CRYPTO_CONFIG.IV_LEN) {
                        [actualIv, actualCipher] = [actualCipher, actualIv]
                    }
                }
            }

            console.debug('[decrypt2FasEncrypted] chosen mapping lengths salt,iv,cipher=', actualSalt?.length, actualIv?.length, actualCipher?.length)

            // 验证最终长度：salt 至少保持合理长度（通常 >=16），iv 必须为12字节
            if (actualSalt.length < 16) {
                throw new migrationError(`salt 长度过短：${actualSalt.length}`, 'INVALID_SALT_LEN')
            }
            if (actualIv.length !== _2FAS_CRYPTO_CONFIG.IV_LEN) {
                throw new migrationError(`IV 长度错误：期望 ${_2FAS_CRYPTO_CONFIG.IV_LEN}，实际 ${actualIv.length}`, 'INVALID_IV_LEN')
            }

            // PBKDF2 派生密钥
            const passwordBuf = new TextEncoder().encode(password)
            const keyMaterial = await crypto.subtle.importKey('raw', passwordBuf, { name: 'PBKDF2' }, false, ['deriveKey'])
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: actualSalt,
                    iterations: _2FAS_CRYPTO_CONFIG.ITERATIONS,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            )
            console.debug('[decrypt2FasEncrypted] key derived')

            // AES-GCM 解密
            // GCM 模式下，密文末尾 16 字节是 auth tag
            if (actualCipher.length < 16) {
                throw new migrationError('密文过短（无法包含 auth tag）', 'CIPHERTEXT_TOO_SHORT')
            }
            const authTag = actualCipher.slice(actualCipher.length - 16)
            const encryptedData = actualCipher.slice(0, actualCipher.length - 16)

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: actualIv },
                key,
                new Uint8Array([...encryptedData, ...authTag])
            )

            const plaintext = new TextDecoder().decode(decrypted)
            const servicesJson = JSON.parse(plaintext)
            // servicesJson 应该是数组格式的 2FAS services
            if (!Array.isArray(servicesJson)) {
                throw new migrationError('解密后的数据不是数组格式', 'INVALID_DECRYPTED_FORMAT')
            }

            return servicesJson
        } catch (error) {
            if (error instanceof migrationError) {
                throw error
            }
            throw new migrationError(`2FAS 解密失败：${error.message || String(error)}`, 'TWOFAS_DECRYPTION_FAILED', error)
        }
    },

    /**
     * 辅助函数：将字节数组编码为 Base32 字符串
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    bytesToBase32(bytes) {
        const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        let bits = 0
        let value = 0
        let output = ''

        for (let i = 0; i < bytes.length; i++) {
            value = (value << 8) | bytes[i]
            bits += 8

            while (bits >= 5) {
                bits -= 5
                output += base32Chars[(value >>> bits) & 31]
            }
        }

        if (bits > 0) {
            output += base32Chars[(value << (5 - bits)) & 31]
        }

        // 添加 padding
        while (output.length % 8) {
            output += '='
        }

        return output
    },

    /**
     * 辅助函数：将 Base64 字符串转换为 Base32
     * @param {string} base64Str
     * @returns {string}
     */
    base64ToBase32(base64Str) {
        try {
            // 解码 Base64 为字节数组
            const binaryString = atob(base64Str.trim())
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            // 转换为 Base32
            return this.bytesToBase32(bytes)
        } catch (e) {
            throw new Error(`Base64 转 Base32 失败: ${e.message}`)
        }
    },

    /**
     * 3.0 解析PhoneFactor SQLite数据库 (通过 wa-sqlite 支持 WAL 和多文件)
     * @param {ArrayBuffer|Object} inputData - SQLite数据库二进制数据(为旧版兼容) 或者 包含 main/wal/shm 的 group 对象
     * @returns {Promise<Object[]>} 标准化的账户列表
     * @throws {migrationError}
     */
    async parsePhoneFactor(inputData) {
        console.log('[PhoneFactor] parsePhoneFactor 开始')
        let mainBuf = null
        let walBuf = null
        let shmBuf = null
        let vfs = null

        try {
            // Group 提取

            if (inputData && inputData.main && inputData.main.buffer) {
                mainBuf = new Uint8Array(inputData.main.buffer)
                if (inputData.wal && inputData.wal.buffer) walBuf = new Uint8Array(inputData.wal.buffer)
                if (inputData.shm && inputData.shm.buffer) shmBuf = new Uint8Array(inputData.shm.buffer)
            } else if (inputData instanceof ArrayBuffer || inputData instanceof Uint8Array) {
                // 回退：单文件模式
                mainBuf = new Uint8Array(inputData)
            } else {
                throw new migrationError('无法识别传入的 PhoneFactor 数据格式', 'INVALID_PHONEFACTOR_INPUT')
            }

            console.log('[PhoneFactor] 文件提取完成', {
                mainBufLen: mainBuf?.byteLength,
                walBufLen: walBuf?.byteLength ?? 0,
                shmBufLen: shmBuf?.byteLength ?? 0
            })

            // 初始化 wa-sqlite
            console.log('[PhoneFactor] 调用 SQLiteESMFactory...')
            const module = await SQLiteESMFactory()
            console.log('[PhoneFactor] SQLiteESMFactory 完成，创建 sqlite3...')
            const sqlite3 = SQLite.Factory(module)
            console.log('[PhoneFactor] sqlite3 Factory 完成')

            // 注册内存虚拟文件系统 (MemoryAsyncVFS)
            // wa-sqlite-async build 必须配合 Async VFS 才能正确处理 Asyncify 异步调用
            vfs = new MemoryAsyncVFS()
            const vfsName = `vfs-${Date.now()}`
            vfs.name = vfsName
            sqlite3.vfs_register(vfs)
            console.log('[PhoneFactor] VFS 注册完成:', vfsName)

            // 将文件加载入内存文件系统
            const mainPath = 'PhoneFactor'

            // Helper to write file to MemoryVFS
            const writeFileToVFS = (path, uint8Array) => {
                // 使用 slice 确保我们获取的是一个干净的 ArrayBuffer，
                // 解决可能存在的 TypedArray view 偏移量问题导致 SQLite 无法识别文件头。
                const ab = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
                vfs.mapNameToFile.set(path, {
                    name: path,
                    flags: SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_MAIN_DB,
                    size: uint8Array.byteLength,
                    data: ab
                })
            }

            writeFileToVFS(mainPath, mainBuf)
            // 注入 WAL（如果有真实内容）
            const hasRealWal = walBuf && walBuf.byteLength > 0
            if (hasRealWal) writeFileToVFS(`${mainPath}-wal`, walBuf)
            // ⚠️ 关键：始终注入 SHM（如果存在），不管 WAL 是否为空。
            // PhoneFactor 主文件本身可能已处于 WAL 模式（header byte 18 = 2），
            // SQLite 初始化时必须能找到 SHM 文件，否则报 SQLITE_CANTOPEN (14)。
            if (shmBuf && shmBuf.byteLength > 0) writeFileToVFS(`${mainPath}-shm`, shmBuf)

            console.log('[PhoneFactor] 注入文件到 VFS 完成', {
                main: mainPath,
                hasWal: hasRealWal,
                hasShm: !!(shmBuf && shmBuf.byteLength > 0)
            })

            console.log('[PhoneFactor] 调用 open_v2...')
            const db = await sqlite3.open_v2(
                mainPath,
                SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
                vfsName
            )
            console.log('[PhoneFactor] open_v2 成功')

            // ⚠️ 关键步骤：处理 WAL 模式（无论 WAL 文件是否为空）
            // PhoneFactor 数据库可能已处于 WAL 模式（header byte 18 = 2）。
            // 即使 WAL 文件为空（无未提交变更），也必须执行以下两条 PRAGMA 来：
            // 1. 获取 EXCLUSIVE 锁，使 SQLite 能在只有 SHM 的情况下正确初始化
            // 2. 将 journal 模式切换回 DELETE，触发 checkpoint 并确保数据可读
            // 注：对于非 WAL 模式数据库，这两条 PRAGMA 是无害的空操作
            console.log('[PhoneFactor] 执行 PRAGMA locking_mode...')
            await sqlite3.exec(db, 'PRAGMA locking_mode = EXCLUSIVE;')
            console.log('[PhoneFactor] 执行 PRAGMA journal_mode...')
            await sqlite3.exec(db, 'PRAGMA journal_mode = DELETE;')
            console.log('[PhoneFactor] PRAGMA 完成')

            // 检查accounts表是否存在
            let hasAccountsTable = false
            await sqlite3.exec(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'", (row) => {
                hasAccountsTable = true
            })
            console.log('[PhoneFactor] accounts 表存在:', hasAccountsTable)

            if (!hasAccountsTable) {
                await sqlite3.close(db)
                throw new migrationError('不是有效的Microsoft Authenticator数据文件', 'INVALID_PHONEFACTOR_FILE')
            }

            const vault = []
            let skippedEncrypted = 0
            let skippedEmpty = 0
            let skippedInvalidSecret = 0
            const base32Re = /^[A-Z2-7]+=*$/i

            try {
                console.log('[PhoneFactor] 开始提取基础数据...')

                // 不使用 for await (const stmt of ...)，规避 Asyncify Generator 的协程挂起 bug
                const str = sqlite3.str_new(db, "SELECT name, username, oath_secret_key, encrypted_oath_secret_key, account_type FROM accounts")
                let prepared = await sqlite3.prepare_v2(db, sqlite3.str_value(str))

                if (prepared && prepared.stmt) {
                    const stmt = prepared.stmt
                    console.log('[PhoneFactor] SQL 预编译成功，开始读取行...')

                    try {
                        let rowsRead = 0;
                        while (await sqlite3.step(stmt) === SQLite.SQLITE_ROW) {
                            rowsRead++;
                            if (rowsRead % 5 === 0) console.log(`[PhoneFactor] 已读取 ${rowsRead} 行...`);

                            const row = sqlite3.row(stmt)
                            const name = row[0]
                            const username = row[1]
                            let oath_secret_key = row[2]
                            const encrypted_oath_secret_key = row[3]
                            const account_type = row[4]

                            // 跳过条件：name 和 username 同时为空
                            if ((!name || String(name).trim() === '') && (!username || String(username).trim() === '')) {
                                skippedEmpty++
                                continue
                            }

                            let secret = (oath_secret_key || '').toString().trim()
                            if (!secret) {
                                if (encrypted_oath_secret_key && String(encrypted_oath_secret_key).trim() !== '') {
                                    skippedEncrypted++
                                    continue
                                }
                                skippedEmpty++
                                continue
                            }

                            let algorithm = 'SHA1'
                            let digits = 6

                            // 根据 account_type 处理密钥
                            try {
                                if (account_type === 0) {
                                    // account_type=0: Base32 编码
                                } else if (account_type === 1) {
                                    // account_type=1: Base64 编码，转换为 Base32
                                    secret = this.base64ToBase32(secret)
                                    algorithm = 'SHA1'
                                    digits = 8
                                } else if (account_type === 2) {
                                    // account_type=2: Base32 编码（小写），转大写
                                    secret = secret.toUpperCase()
                                    algorithm = 'SHA256'
                                    digits = 6
                                } else {
                                    skippedInvalidSecret++
                                    continue
                                }
                            } catch (e) {
                                console.warn(`Failed to convert secret for account_type=${account_type}:`, e.message)
                                skippedInvalidSecret++
                                continue
                            }

                            // 验证转换后的密钥是否为有效的 Base32 格式
                            const normalized = secret.replace(/\s+/g, '').replace(/=+$/, '')
                            if (!base32Re.test(normalized)) {
                                if (encrypted_oath_secret_key && String(encrypted_oath_secret_key).trim() !== '') {
                                    skippedEncrypted++
                                    continue
                                }
                                skippedInvalidSecret++
                                continue
                            }

                            vault.push({
                                service: name || 'Unknown Service',
                                account: username || 'Unknown Account',
                                secret: secret,
                                algorithm: algorithm,
                                digits: digits,
                                period: 30
                            })
                        }
                        console.log(`[PhoneFactor] 行读取循环结束，总共提取 ${rowsRead} 行`);
                    } finally {
                        await sqlite3.finalize(stmt)
                    }
                }
                sqlite3.str_finish(str)
                console.log('[PhoneFactor] 数据提取完成，关闭 DB...')
            } catch (e) {
                await sqlite3.close(db)
                throw new migrationError('解析 PhoneFactor 数据库失败', 'INVALID_PHONEFACTOR_FILE', e)
            }

            await sqlite3.close(db)

            // Clean up memory VFS (by clearing the maps, safer than calling xDelete from JS)
            try {
                if (vfs) {
                    vfs.mapNameToFile.clear()
                    vfs.mapIdToFile.clear()
                }
            } catch (ignore) { }

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
            // 打印详细调试信息到控制台
            try {
                const bufLen = (mainBuf && (mainBuf.byteLength || mainBuf.length)) || 0
                console.error('parsePhoneFactor failed:', {
                    message: error && error.message,
                    stack: error && error.stack,
                    bufferLength: bufLen,
                    error
                })
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

        // 处理PhoneFactor SQLite数据库 (包括新版的 phonefactor_group)
        if (type === 'phonefactor' || type === 'phonefactor_group') {
            return await this.parsePhoneFactor(content)
        }

        // 统一处理将可能传入的 ArrayBuffer 转回 string，以便后续非数据库格式的解析
        let textContent = content
        if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
            try {
                const bytes = content instanceof Uint8Array ? content : new Uint8Array(content)
                textContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
            } catch (e) {
                console.warn('Failed to decode buffer as text', e)
            }
        }
        // 对于非 phonefactor 的格式，后续逻辑全部使用 textContent 替代 content
        content = textContent;

        if (type === 'bwauth_csv' || type === 'generic_csv') {
            rawVault = csvStrategy.parseCsv(content)
            content = JSON.stringify(rawVault)
            type = 'raw'
        }

        if (type === 'proton_encrypted') {
            rawVault = await protonStrategy.parse(content, password)
            type = 'raw'
            content = JSON.stringify(rawVault)
            password = undefined
        }

        // 处理 2FAS 加密备份
        if (type === '2fas_encrypted') {
            if (!password) throw new migrationError('导入 2FAS 加密备份需要密码', 'MISSING_PASSWORD')
            try {
                const encryptedJson = typeof content === 'string' ? JSON.parse(content) : content
                const decryptedServices = await this.decrypt2FasEncrypted(password, encryptedJson)
                // 转换为标准 2FAS 格式处理
                content = JSON.stringify({ services: decryptedServices })
                type = '2fas'
                password = undefined
            } catch (e) {
                if (e instanceof migrationError) throw e
                throw new migrationError(`2FAS 加密备份解密失败：${e.message || String(e)}`, 'TWOFAS_DECRYPTION_FAILED', e)
            }
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
            if (!password) throw new migrationError('导入本系统加密文件需要密码', 'MISSING_PASSWORD')
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
