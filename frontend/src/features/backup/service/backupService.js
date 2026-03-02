import { request } from '@/shared/utils/request'
import { backupError } from '@/shared/utils/errors/backupError'

/**
 * @typedef {Object} BackupProviderConfig
 * @property {string} url - WebDAV URL
 * @property {string} username - WebDAV Username
 * @property {string} password - WebDAV Password
 * @property {string} saveDir - Save Directory
 * @property {string} endpoint - S3 Endpoint
 * @property {string} bucket - S3 Bucket
 * @property {string} region - S3 Region
 * @property {string} accessKeyId - S3 Access Key ID
 * @property {string} secretAccessKey - S3 Secret Access Key
 */

/**
 * @typedef {Object} BackupProvider
 * @property {string} [id] - Provider ID
 * @property {string} name - Provider Name
 * @property {string} type - Provider Type ('webdav' | 's3')
 * @property {BackupProviderConfig} config - Provider Configuration
 * @property {boolean} auto_backup - Auto backup enabled
 * @property {string} [auto_backup_password] - Auto backup encryption password
 * @property {number} [auto_backup_retain] - Number of backups to retain
 */

export const backupService = {
    /**
     * 获取所有备份源配置
     * @returns {Promise<{success: boolean, providers: BackupProvider[]}>}
     * @throws {backupError}
     */
    async getProviders() {
        try {
            return await request('/api/backups/providers')
        } catch (e) {
            throw new backupError('Failed to fetch backup providers', 'PROVIDERS_FETCH_FAILED', e)
        }
    },

    /**
     * 测试备份源连接
     * @param {string} type - 'webdav' 或 's3'
     * @param {BackupProviderConfig} config
     * @returns {Promise<{success: boolean}>}
     * @throws {backupError}
     */
    async testConnection(type, config) {
        try {
            return await request('/api/backups/providers/test', {
                method: 'POST',
                body: JSON.stringify({ type, config })
            })
        } catch (e) {
            throw new backupError('Failed to test connection', 'CONNECTION_TEST_FAILED', e)
        }
    },

    /**
     * 创建新的备份源
     * @param {BackupProvider} providerData
     * @returns {Promise<{success: boolean, provider: BackupProvider}>}
     * @throws {backupError}
     */
    async createProvider(providerData) {
        try {
            return await request('/api/backups/providers', {
                method: 'POST',
                body: JSON.stringify(providerData)
            })
        } catch (e) {
            throw new backupError('Failed to create provider', 'PROVIDER_CREATE_FAILED', e)
        }
    },

    /**
     * 更新现有备份源
     * @param {string} id
     * @param {BackupProvider} providerData
     * @returns {Promise<{success: boolean}>}
     * @throws {backupError}
     */
    async updateProvider(id, providerData) {
        try {
            return await request(`/api/backups/providers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(providerData)
            })
        } catch (e) {
            throw new backupError('Failed to update provider', 'PROVIDER_UPDATE_FAILED', e)
        }
    },

    /**
     * 删除备份源
     * @param {string} id
     * @returns {Promise<{success: boolean}>}
     * @throws {backupError}
     */
    async deleteProvider(id) {
        try {
            return await request(`/api/backups/providers/${id}`, { method: 'DELETE' })
        } catch (e) {
            throw new backupError('Failed to delete provider', 'PROVIDER_DELETE_FAILED', e)
        }
    },

    /**
     * 手动触发一次备份
     * @param {string} id
     * @param {string} password - 备份加密密码 (若使用自动备份密码则为空)
     * @returns {Promise<{success: boolean}>}
     * @throws {backupError}
     */
    async triggerBackup(id, password = '') {
        try {
            return await request(`/api/backups/providers/${id}/backup`, {
                method: 'POST',
                body: JSON.stringify({ password })
            })
        } catch (e) {
            throw new backupError('Failed to trigger backup', 'BACKUP_TRIGGER_FAILED', e)
        }
    },

    /**
     * 获取备份历史文件列表
     * @param {string} id
     * @returns {Promise<{success: boolean, files: Object[]}>}
     * @throws {backupError}
     */
    async getBackupFiles(id) {
        try {
            return await request(`/api/backups/providers/${id}/files`)
        } catch (e) {
            throw new backupError('Failed to fetch backup files', 'FILES_FETCH_FAILED', e)
        }
    },

    /**
     * 下载加密的备份文件
     * @param {string} id
     * @param {string} filename
     * @returns {Promise<{success: boolean, content: string|Object}>}
     * @throws {backupError}
     */
    async downloadBackupFile(id, filename) {
        try {
            return await request(`/api/backups/providers/${id}/download`, {
                method: 'POST',
                body: JSON.stringify({ filename })
            })
        } catch (e) {
            throw new backupError('Failed to download backup file', 'FILE_DOWNLOAD_FAILED', e)
        }
    }
}
