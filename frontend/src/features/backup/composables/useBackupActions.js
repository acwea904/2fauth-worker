import { ref } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { backupService } from '@/features/backup/service/backupService'
import { dataMigrationService } from '@/features/migration/service/dataMigrationService'
import { useVaultStore } from '@/features/vault/store/vaultStore'

export function useBackupActions(emit, fetchProviders) {
    const vaultStore = useVaultStore()

    // Backup Action State
    const showBackupDialog = ref(false)
    const backupPassword = ref('')
    const isBackingUp = ref(false)
    const useAutoPassword = ref(false)
    const currentActionProvider = ref(null)

    // Restore Action State
    const showRestoreListDialog = ref(false)
    const isLoadingFiles = ref(false)
    const backupFiles = ref([])
    const showRestoreConfirmDialog = ref(false)
    const restorePassword = ref('')
    const selectedFile = ref(null)
    const isRestoring = ref(false)

    // Backup methods
    const openBackupDialog = (provider) => {
        currentActionProvider.value = provider
        backupPassword.value = ''
        useAutoPassword.value = !!provider.auto_backup
        showBackupDialog.value = true
    }

    const handleBackup = async () => {
        if (!useAutoPassword.value && backupPassword.value.length < 12) {
            return ElMessage.warning('密码至少12位')
        }

        const pwdToSend = useAutoPassword.value ? '' : backupPassword.value

        isBackingUp.value = true
        try {
            const res = await backupService.triggerBackup(currentActionProvider.value.id, pwdToSend)
            if (res.success) {
                ElNotification({
                    title: '云端备份完成',
                    message: `<div style="color:var(--el-color-success)">🎉 成功备份了数据</div>`,
                    dangerouslyUseHTMLString: true,
                    type: 'success',
                    duration: 5000
                })
                showBackupDialog.value = false
                if (fetchProviders) await fetchProviders()
            }
        } catch (e) {
            ElMessage.error(e.message || '备份失败')
        } finally { isBackingUp.value = false }
    }

    // Restore methods
    const openRestoreDialog = async (provider) => {
        currentActionProvider.value = provider
        showRestoreListDialog.value = true
        isLoadingFiles.value = true
        try {
            const res = await backupService.getBackupFiles(provider.id)
            if (res.success) backupFiles.value = res.files
        } catch (e) {
            ElMessage.error(e.message || '获取备份文件失败')
        } finally { isLoadingFiles.value = false }
    }

    const selectRestoreFile = (file) => {
        selectedFile.value = file
        restorePassword.value = ''
        showRestoreConfirmDialog.value = true
    }

    const handleRestore = async () => {
        isRestoring.value = true
        try {
            const downloadRes = await backupService.downloadBackupFile(currentActionProvider.value.id, selectedFile.value.filename)

            let contentToDecrypt = downloadRes.content
            try {
                const json = typeof contentToDecrypt === 'string' ? JSON.parse(contentToDecrypt) : contentToDecrypt
                if (json && json.encrypted && json.data) {
                    contentToDecrypt = json.data
                }
            } catch (e) { }

            const vault = await dataMigrationService.parseImportData(contentToDecrypt, 'encrypted', restorePassword.value)
            const saveRes = await dataMigrationService.saveImportedVault(vault)

            if (saveRes.success) {
                let msgHtml = `<div>共处理 <b>1</b> 个备份文件 (${vault.length} 个基准账号)。</div>`
                if (saveRes.count > 0) {
                    msgHtml += `<div style="color:var(--el-color-success)">🎉 成功导入 <b>${saveRes.count}</b> 个新账户！</div>`
                } else {
                    msgHtml += `<div style="color:var(--el-color-warning)">⚠️ 恢复的账户皆已存在，无新添项。</div>`
                }
                if (saveRes.duplicates > 0) msgHtml += `<div style="color:var(--el-text-color-secondary)">ℹ️ 自动跳过了 <b>${saveRes.duplicates}</b> 个已有账户。</div>`

                ElNotification({
                    title: '恢复数据结束',
                    message: msgHtml,
                    dangerouslyUseHTMLString: true,
                    type: 'success',
                    duration: 8000
                })

                showRestoreConfirmDialog.value = false
                showRestoreListDialog.value = false
                if (saveRes.count > 0) {
                    vaultStore.markDirty()
                    emit('restore-success')
                }
            }
        } catch (e) {
            ElMessage.error(e.message || '恢复失败')
        } finally { isRestoring.value = false }
    }

    return {
        // Backup
        showBackupDialog,
        backupPassword,
        isBackingUp,
        useAutoPassword,
        currentActionProvider,
        openBackupDialog,
        handleBackup,

        // Restore
        showRestoreListDialog,
        isLoadingFiles,
        backupFiles,
        showRestoreConfirmDialog,
        restorePassword,
        selectedFile,
        isRestoring,
        openRestoreDialog,
        selectRestoreFile,
        handleRestore
    }
}
