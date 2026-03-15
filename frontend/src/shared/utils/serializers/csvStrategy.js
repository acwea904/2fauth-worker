import { parseOtpUri } from '@/shared/utils/totp'

/**
 * CSV 格式迁移解析策略
 */
export const csvStrategy = {
    /**
     * @typedef {Object} VaultItem
     * @property {string} service
     * @property {string} account
     * @property {string} secret
     * @property {string} algorithm
     * @property {number} digits
     * @property {number} period
     * @property {string} category
     */

    /**
     * 解析一行 CSV，正确处理 RFC 4180 引号字段（含引号的字段、内部双引号转义）
     * @param {string} line
     * @returns {string[]}
     */
    _splitCsvLine(line) {
        const fields = []
        let i = 0
        while (i <= line.length) {
            if (i === line.length) { fields.push(''); break }
            if (line[i] === '"') {
                // 引号字段：读取到匹配的结束引号
                let val = ''
                i++ // skip opening quote
                while (i < line.length) {
                    if (line[i] === '"') {
                        if (line[i + 1] === '"') { val += '"'; i += 2 } // 转义的 "" → "
                        else { i++; break } // 结束引号
                    } else {
                        val += line[i++]
                    }
                }
                fields.push(val.trim())
                if (line[i] === ',') i++ // skip comma
            } else {
                // 无引号字段：读取到下一个逗号
                const end = line.indexOf(',', i)
                if (end === -1) { fields.push(line.slice(i).trim()); break }
                fields.push(line.slice(i, end).trim())
                i = end + 1
            }
        }
        return fields
    },

    /**
     * Decode a generic or bitwarden (vault) CSV string.
     * @param {string} csvText 
     * @returns {VaultItem[]}
     */
    parseCsv(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim())
        if (lines.length < 2) return []

        // 表头同样做去引号处理并小写
        const headers = this._splitCsvLine(lines[0]).map(h => h.toLowerCase())
        const rawVault = []

        const isBitwardenVault = headers.includes('login_totp')
        const isBitwardenAuth = headers.includes('otpauth') && !headers.includes('title')
        const is1Password = headers.includes('otpauth') && headers.includes('title')
        const isGeneric = headers.includes('issuer') || headers.includes('secret') || headers.includes('name')

        if (!isBitwardenVault && !isBitwardenAuth && !is1Password && !isGeneric) return []

        for (let i = 1; i < lines.length; i++) {
            const row = this._splitCsvLine(lines[i])
            const rowData = {}
            headers.forEach((h, index) => { rowData[h] = row[index] || '' })

            if (is1Password) {
                const totpStr = (rowData['otpauth'] || '').trim()
                if (totpStr && totpStr.startsWith('otpauth://')) {
                    const accData = parseOtpUri(totpStr)
                    if (accData) {
                        accData.service = rowData['title'] || accData.service
                        accData.account = rowData['username'] || accData.account
                        rawVault.push(accData)
                    }
                }
            } else if (isBitwardenVault || isBitwardenAuth) {
                const totpStr = (rowData['login_totp'] || rowData['otpauth'] || rowData['totp'] || '').trim()
                if (totpStr) {
                    let accData = null
                    if (totpStr.startsWith('otpauth://')) {
                        accData = parseOtpUri(totpStr)
                    } else {
                        // Check if it's a plain Base32 secret
                        const secret = totpStr.replace(/\s/g, '').toUpperCase()
                        const base32Re = /^[A-Z2-7]+=*$/
                        if (base32Re.test(secret)) {
                            accData = {
                                service: rowData['name'] || 'Unknown',
                                account: rowData['login_username'] || 'Unknown',
                                secret: secret,
                                algorithm: 'SHA-1',
                                digits: 6,
                                period: 30,
                                category: ''
                            }
                        }
                    }

                    if (accData) {
                        accData.service = rowData['name'] || accData.service
                        accData.account = rowData['login_username'] || accData.account
                        rawVault.push(accData)
                    }
                }
            } else {
                const secret = rowData['secret'] || ''
                if (secret) {
                    // 本系统导出的 generic csv: name=account, issuer=service
                    // 兼容其他工具: 若有独立的 account 列则优先
                    const service = rowData['issuer'] || rowData['name'] || 'Unknown'
                    const account = rowData['account'] || rowData['name'] || ''
                    rawVault.push({
                        service,
                        account,
                        secret: secret.replace(/\s/g, '').toUpperCase(),
                        algorithm: (rowData['algorithm'] || 'SHA1').toUpperCase().replace(/^SHA-?1$/, 'SHA-1').replace(/^SHA-?256$/, 'SHA-256').replace(/^SHA-?512$/, 'SHA-512'),
                        digits: parseInt(rowData['digits'] || '6', 10),
                        period: parseInt(rowData['period'] || '30', 10),
                        category: ''
                    })
                }
            }
        }
        return rawVault
    }
}
