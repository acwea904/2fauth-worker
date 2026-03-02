import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { backupService } from '@/features/backup/service/backupService'

export function useBackupProviders() {
    const vaultStore = useVaultStore()

    const providers = ref([])
    const isLoading = ref(false)

    // Form and Dialog State
    const showConfigDialog = ref(false)
    const isEditing = ref(false)
    const isTesting = ref(false)
    const isSaving = ref(false)

    const initialFormState = () => ({
        type: 'webdav',
        name: '',
        config: { url: '', username: '', password: '', saveDir: '/', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '' },
        autoBackup: false,
        autoBackupPassword: '',
        autoBackupRetain: 30
    })

    const form = ref(initialFormState())
    const currentProviderId = ref(null)
    const hasExistingAutoPwd = ref(false)
    const configUseExistingAutoPwd = ref(false)

    // Methods
    const fetchProviders = async () => {
        const cachedEncrypted = await vaultStore.getEncryptedBackupProviders()
        if (cachedEncrypted && Array.isArray(cachedEncrypted)) {
            providers.value = cachedEncrypted
        } else {
            isLoading.value = true
        }

        try {
            const res = await backupService.getProviders()
            if (res.success) {
                providers.value = res.providers
                await vaultStore.saveEncryptedBackupProviders(res.providers)
            }
        } finally { isLoading.value = false }
    }

    const openAddDialog = () => {
        isEditing.value = false
        form.value = initialFormState()
        hasExistingAutoPwd.value = false
        configUseExistingAutoPwd.value = false
        showConfigDialog.value = true
    }

    const editProvider = (provider) => {
        isEditing.value = true
        currentProviderId.value = provider.id
        form.value = JSON.parse(JSON.stringify({
            type: provider.type,
            name: provider.name,
            config: provider.config,
            autoBackup: !!provider.auto_backup,
            autoBackupPassword: '',
            autoBackupRetain: provider.auto_backup_retain ?? 30
        }))
        hasExistingAutoPwd.value = !!provider.auto_backup_password
        configUseExistingAutoPwd.value = true
        showConfigDialog.value = true
    }

    const validateForm = () => {
        if (!form.value.name) return '请输入名称'
        const c = form.value.config
        if (form.value.type === 'webdav') {
            if (!c.url) return '请输入 WebDAV 地址'
            if (!c.username) return '请输入用户名'
            if (!c.password) return '请输入密码'
        } else if (form.value.type === 's3') {
            if (!c.endpoint) return '请输入 Endpoint'
            if (!c.bucket) return '请输入 Bucket'
            if (!c.accessKeyId) return '请输入 Access Key ID'
            if (!c.secretAccessKey) return '请输入 Secret Access Key'
        }

        if (form.value.autoBackup) {
            if (isEditing.value && hasExistingAutoPwd.value && configUseExistingAutoPwd.value) {
                return null
            }
            if (!form.value.autoBackupPassword || form.value.autoBackupPassword.length < 12) {
                return '自动备份密码长度必须至少 12 位'
            }
        }
        return null
    }

    const testConnection = async () => {
        const error = validateForm()
        if (error) return ElMessage.warning(error)

        isTesting.value = true
        try {
            const res = await backupService.testConnection(form.value.type, form.value.config)
            if (res.success) ElMessage.success('连接成功')
        } catch (e) {
            ElMessage.error(e.message || '连接失败')
        } finally { isTesting.value = false }
    }

    const saveProvider = async () => {
        const error = validateForm()
        if (error) return ElMessage.warning(error)

        if (isEditing.value && hasExistingAutoPwd.value && configUseExistingAutoPwd.value) {
            form.value.autoBackupPassword = ''
        }

        isSaving.value = true
        try {
            const res = isEditing.value
                ? await backupService.updateProvider(currentProviderId.value, form.value)
                : await backupService.createProvider(form.value)
            if (res.success) {
                ElMessage.success('保存成功')
                showConfigDialog.value = false
                await fetchProviders()
            }
        } catch (e) {
            ElMessage.error(e.message || '保存失败')
        } finally { isSaving.value = false }
    }

    const deleteProvider = async (provider) => {
        try {
            await ElMessageBox.confirm('确定删除该备份源吗？', '警告', { type: 'warning' })
            await backupService.deleteProvider(provider.id)
            await fetchProviders()
        } catch (e) {
            if (e !== 'cancel') {
                ElMessage.error(e.message || '删除失败')
            }
        }
    }

    onMounted(fetchProviders)

    return {
        providers,
        isLoading,
        showConfigDialog,
        isEditing,
        isTesting,
        isSaving,
        form,
        hasExistingAutoPwd,
        configUseExistingAutoPwd,
        fetchProviders,
        openAddDialog,
        editProvider,
        testConnection,
        saveProvider,
        deleteProvider
    }
}
