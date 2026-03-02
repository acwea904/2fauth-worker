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
     * Decode a generic or bwauth CSV string.
     * @param {string} csvText 
     * @returns {VaultItem[]}
     */
    parseCsv(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim())
        if (lines.length < 2) return []

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
        const rawVault = []

        const isBwAuth = headers.includes('login_totp')
        const isGeneric = headers.includes('issuer') || headers.includes('secret') || headers.includes('name')

        if (!isBwAuth && !isGeneric) return []

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(c => c.trim())
            const rowData = {}
            headers.forEach((h, index) => { rowData[h] = row[index] })

            if (isBwAuth) {
                const totpStr = rowData['login_totp'] || ''
                if (totpStr.startsWith('otpauth://')) {
                    const accData = parseOtpUri(totpStr)
                    if (accData) {
                        accData.service = rowData['name'] || accData.service
                        accData.account = rowData['login_username'] || accData.account
                        rawVault.push(accData)
                    }
                }
            } else {
                const secret = rowData['secret'] || ''
                if (secret) {
                    rawVault.push({
                        service: rowData['issuer'] || rowData['name'] || 'Unknown',
                        account: rowData['account'] || rowData['name'] || '',
                        secret: secret.replace(/\s/g, '').toUpperCase(),
                        algorithm: (rowData['algorithm'] || 'SHA1').toUpperCase().replace('SHA1', 'SHA-1').replace('SHA256', 'SHA-256').replace('SHA512', 'SHA-512'),
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
