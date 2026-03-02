import { request } from '@/shared/utils/request'
import { vaultError } from '@/shared/utils/errors/vaultError'

/**
 * @typedef {Object} VaultAccount
 * @property {string} [id] - Account ID
 * @property {string} service - Service name (e.g. "Google")
 * @property {string} account - Account identifier (e.g. email)
 * @property {string} secret - Base32-encoded TOTP secret
 * @property {string} [category] - Optional category label
 * @property {6|8} [digits] - OTP digit count (default: 6)
 * @property {30|60} [period] - TOTP period in seconds (default: 30)
 * @property {'SHA1'|'SHA256'|'SHA512'} [algorithm] - HMAC algorithm (default: 'SHA1')
 */

/**
 * @typedef {Object} VaultPagination
 * @property {number} page - Current page number
 * @property {number} totalPages - Total number of pages
 * @property {number} total - Total item count
 */

/**
 * @typedef {Object} VaultListResponse
 * @property {boolean} success
 * @property {VaultAccount[]} vault - List of accounts for THIS page
 * @property {VaultPagination} pagination
 */

export const vaultService = {
    /**
     * 分页获取账号列表
     * @param {{ page?: number, limit?: number, search?: string }} params
     * @returns {Promise<VaultListResponse>}
     * @throws {vaultError}
     */
    async getVault(params = {}) {
        try {
            const query = new URLSearchParams(params).toString()
            return await request(`/api/vault?${query}`)
        } catch (e) {
            throw new vaultError('Failed to fetch vault list', 'VAULT_FETCH_FAILED', e)
        }
    },

    /**
     * 创建新账号
     * @param {VaultAccount} vaultData
     * @returns {Promise<{success: boolean, id: string}>}
     * @throws {vaultError}
     */
    async createAccount(vaultData) {
        try {
            return await request('/api/vault', {
                method: 'POST',
                body: JSON.stringify(vaultData)
            })
        } catch (e) {
            throw new vaultError('Failed to create account', 'ACCOUNT_CREATE_FAILED', e)
        }
    },

    /**
     * 更新账号信息
     * @param {string} id
     * @param {Partial<VaultAccount>} updateData
     * @returns {Promise<{success: boolean}>}
     * @throws {vaultError}
     */
    async updateAccount(id, updateData) {
        try {
            return await request(`/api/vault/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            })
        } catch (e) {
            throw new vaultError('Failed to update account', 'ACCOUNT_UPDATE_FAILED', e)
        }
    },

    /**
     * 删除单个账号
     * @param {string} id
     * @returns {Promise<{success: boolean}>}
     * @throws {vaultError}
     */
    async deleteAccount(id) {
        try {
            return await request(`/api/vault/${id}`, { method: 'DELETE' })
        } catch (e) {
            throw new vaultError('Failed to delete account', 'ACCOUNT_DELETE_FAILED', e)
        }
    },

    /**
     * 批量删除账号
     * @param {string[]} ids
     * @returns {Promise<{success: boolean, deleted: number}>}
     * @throws {vaultError}
     */
    async batchDelete(ids) {
        try {
            return await request('/api/vault/batch-delete', {
                method: 'POST',
                body: JSON.stringify({ ids })
            })
        } catch (e) {
            throw new vaultError('Failed to batch delete accounts', 'ACCOUNTS_BATCH_DELETE_FAILED', e)
        }
    },

    /**
     * 通过 URI 添加账号
     * @param {string} uri - otpauth://totp/... URI string
     * @param {string} [category='扫码添加']
     * @returns {Promise<{success: boolean, id: string}>}
     * @throws {vaultError}
     */
    async addFromUri(uri, category = '扫码添加') {
        try {
            return await request('/api/vault/add-from-uri', {
                method: 'POST',
                body: JSON.stringify({ uri, category })
            })
        } catch (e) {
            throw new vaultError('Failed to add account from URI', 'ACCOUNT_ADD_URI_FAILED', e)
        }
    },

    /**
     * 导入账号数据
     * @param {VaultAccount[]|string} vault - 账号数组或加密字符串
     * @param {'raw'|'encrypted'} [type='raw']
     * @returns {Promise<{success: boolean, count: number}>}
     * @throws {vaultError}
     */
    async importVault(vault, type = 'raw') {
        try {
            return await request('/api/vault/import', {
                method: 'POST',
                body: JSON.stringify({
                    type,
                    content: typeof vault === 'string' ? vault : JSON.stringify(vault)
                })
            })
        } catch (e) {
            throw new vaultError('Failed to import vault data', 'VAULT_IMPORT_FAILED', e)
        }
    }
}
