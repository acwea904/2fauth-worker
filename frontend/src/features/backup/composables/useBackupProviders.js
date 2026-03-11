import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { backupService } from '@/features/backup/service/backupService'
import { i18n } from '@/locales'
import { useBackupStore } from '@/features/backup/store/backupStore'

export function useBackupProviders() {
    const { t } = i18n.global
    const vaultStore = useVaultStore()
    const backupStore = useBackupStore()

    const { providers, isLoading } = storeToRefs(backupStore)
    const { fetchProviders: storeFetch } = backupStore
    const availableTypes = ref(['s3', 'telegram', 'webdav']) // Default types

    // Form and Dialog State
    const showConfigDialog = ref(false)
    const isEditing = ref(false)
    const isTesting = ref(false)
    const isSaving = ref(false)
    const isEditingWebdavPwd = ref(false)
    const isEditingS3Secret = ref(false)
    const isEditingTelegramToken = ref(false)
    const isEditingGoogleDrive = ref(false)
    const isEditingOneDrive = ref(false)
    const isAuthenticatingGoogle = ref(false)
    const isAuthenticatingMicrosoft = ref(false)
    const authStatus = ref(null) // null, 'success', 'error'
    const authStatusMicrosoft = ref(null)
    const authErrorMessage = ref('')
    const authErrorMessageMicrosoft = ref('')

    const initialFormState = () => ({
        type: 's3',
        name: '',
        config: { url: '', username: '', password: '', saveDir: '/2fauth-worker-backup', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '', botToken: '', chatId: '', refreshToken: '', folderId: '' },
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
        // Use cached data first if available
        const cachedEncrypted = await vaultStore.getEncryptedBackupProviders()
        if (cachedEncrypted && Array.isArray(cachedEncrypted)) {
            backupStore.providers = cachedEncrypted
        }

        try {
            await storeFetch()
            // Sync available types if backend provides them
            const res = await backupService.getProviders() // Re-fetch to get availableTypes
            if (res.availableTypes) {
                availableTypes.value = res.availableTypes
            }
            await vaultStore.saveEncryptedBackupProviders(backupStore.providers)
        } catch (e) {
            console.error('[useBackupProviders] fetch failed:', e)
        }
    }

    const openAddDialog = () => {
        isEditing.value = false
        isEditingWebdavPwd.value = false
        isEditingS3Secret.value = false
        isEditingTelegramToken.value = false
        isEditingGoogleDrive.value = false
        isEditingOneDrive.value = false
        form.value = initialFormState()
        hasExistingAutoPwd.value = false
        configUseExistingAutoPwd.value = false
        showConfigDialog.value = true
    }

    const editProvider = (provider) => {
        isEditing.value = true
        isEditingWebdavPwd.value = false
        isEditingS3Secret.value = false
        isEditingTelegramToken.value = false
        isEditingGoogleDrive.value = false
        isEditingOneDrive.value = false
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
        if (!form.value.name) return t('backup.require_name')
        const c = form.value.config
        if (form.value.type === 'webdav') {
            if (!c.url) return t('backup.require_webdav_url')
            if (!c.username) return t('backup.require_username')
            if (!c.password) return t('backup.require_password')
        } else if (form.value.type === 's3') {
            if (!c.endpoint) return t('backup.require_endpoint')
            if (!c.bucket) return t('backup.require_bucket')
            if (!c.accessKeyId) return t('backup.require_access_key')
            if (!c.secretAccessKey) return t('backup.require_secret_key')
        } else if (form.value.type === 'telegram') {
            if (!c.botToken) return t('backup.require_telegram_token')
            if (!c.chatId) return t('backup.require_telegram_chat_id')
        } else if (form.value.type === 'gdrive') {
            if (!c.refreshToken) return t('backup.require_google_auth')
        } else if (form.value.type === 'onedrive') {
            if (!c.refreshToken) return t('backup.require_microsoft_auth')
        }

        if (form.value.autoBackup) {
            if (isEditing.value && hasExistingAutoPwd.value && configUseExistingAutoPwd.value) {
                return null
            }
            if (!form.value.autoBackupPassword || form.value.autoBackupPassword.length < 12) {
                return t('backup.password_min_length')
            }
        }
        return null
    }

    const testConnection = async () => {
        const error = validateForm()
        if (error) return ElMessage.warning(error)

        isTesting.value = true;
        // Reset old error states before starting a new test to ensure UI reflects current result
        authStatus.value = null;
        authErrorMessage.value = '';
        authStatusMicrosoft.value = null;
        authErrorMessageMicrosoft.value = '';

        try {
            const res = await backupService.testConnection(
                form.value.type,
                form.value.config,
                isEditing.value ? currentProviderId.value : null
            )
            if (res.success) ElMessage.success(t('backup.test_success'))
        } catch (e) {
            // Error is handled here natively since we silenced the global request.js interceptor for testConnection
            const rawMsg = e?.details?.message || e?.message || e?.response?.data?.message || (typeof e === 'string' ? e : t('common.error'));
            const errMsg = rawMsg.toLowerCase();

            // Listen for the standard project-level OAuth revocation signal
            if (errMsg.includes('oauth_token_revoked')) {
                const type = form.value.type;
                console.error(`[OAuth Auth Check] The authorization token for ${type} is revoked or expired. Attempting UI reset...`, e);

                // Reset the internal token holder
                form.value.config.refreshToken = '';

                // Switch UI back to authentication state
                if (type === 'gdrive') {
                    authStatus.value = 'error';
                    authErrorMessage.value = t('backup.token_expired_or_revoked');
                } else if (type === 'onedrive') {
                    authStatusMicrosoft.value = 'error';
                    authErrorMessageMicrosoft.value = t('backup.token_expired_or_revoked');
                }

                // If we are editing an existing provider, update the global store to reflect the state
                if (isEditing.value && currentProviderId.value) {
                    backupStore.markAsRevoked(currentProviderId.value);
                }
            } else {
                ElMessage.error(t(`api_errors.${errMsg}`) || rawMsg);
            }
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
                ElMessage.success(t('backup.save_success'))
                showConfigDialog.value = false
                await fetchProviders()
            }
        } catch (e) {
            // Already handled by request.js
        } finally { isSaving.value = false }
    }

    const deleteProvider = async (provider) => {
        try {
            await ElMessageBox.confirm(t('backup.delete_provider_confirm'), t('common.warning'), { type: 'warning' })
            await backupService.deleteProvider(provider.id)
            await fetchProviders()
        } catch (e) {
            // Error handled by request.js (unless it's 'cancel' from ElMessageBox)
        }
    }

    const startGoogleAuth = async () => {
        isAuthenticatingGoogle.value = true
        authStatus.value = null
        authErrorMessage.value = ''
        try {
            const res = await backupService.getGoogleAuthUrl()
            if (res.success && res.authUrl) {
                const name = 'google_auth'
                const specs = 'width=600,height=700,left=200,top=100'
                const authWindow = window.open(res.authUrl, name, specs)

                // 检查窗口是否被关闭
                const timer = setInterval(() => {
                    try {
                        // COOP 可能导致访问 authWindow.closed 报错，这里用 try-catch 保护
                        if (authWindow && authWindow.closed) {
                            clearInterval(timer)
                            // 若窗口关闭且仍未成功，重置加载状态
                            if (isAuthenticatingGoogle.value && !authStatus.value) {
                                isAuthenticatingGoogle.value = false
                            }
                        }
                    } catch (e) {
                        // 访问被拒绝说明窗口已经跳转到不同策略的域
                        // 我们不需要报错，因为我们有 BroadcastChannel 兜底
                    }
                }, 1000)
            } else {
                isAuthenticatingGoogle.value = false
            }
        } catch (e) {
            isAuthenticatingGoogle.value = false
        }
    }

    const startMicrosoftAuth = async () => {
        isAuthenticatingMicrosoft.value = true
        authStatusMicrosoft.value = null
        authErrorMessageMicrosoft.value = ''
        try {
            const res = await backupService.getMicrosoftAuthUrl()
            if (res.success && res.authUrl) {
                const name = 'microsoft_auth'
                const specs = 'width=600,height=700,left=200,top=100'
                const authWindow = window.open(res.authUrl, name, specs)

                const timer = setInterval(() => {
                    try {
                        if (authWindow && authWindow.closed) {
                            clearInterval(timer)
                            if (isAuthenticatingMicrosoft.value && !authStatusMicrosoft.value) {
                                isAuthenticatingMicrosoft.value = false
                            }
                        }
                    } catch (e) { }
                }, 1000)
            } else {
                isAuthenticatingMicrosoft.value = false
            }
        } catch (e) {
            isAuthenticatingMicrosoft.value = false
        }
    }

    const handleAuthMessage = async (event) => {
        const data = event instanceof MessageEvent ? event.data : event
        if (!data || !data.type) return

        if (data.type === 'GDRIVE_AUTH_SUCCESS') {
            isAuthenticatingGoogle.value = false
            authStatus.value = 'success'
            form.value.config.refreshToken = data.refreshToken
            if (!form.value.config.saveDir) {
                form.value.config.saveDir = '/2fauth-worker-backup'
            }
        } else if (data.type === 'GDRIVE_AUTH_ERROR') {
            isAuthenticatingGoogle.value = false
            authStatus.value = 'error'
            authErrorMessage.value = data.message || t('backup.google_auth_failed')
        } else if (data.type === 'MS_AUTH_SUCCESS') {
            isAuthenticatingMicrosoft.value = false
            authStatusMicrosoft.value = 'success'
            form.value.config.refreshToken = data.refreshToken
            if (!form.value.config.saveDir) {
                form.value.config.saveDir = '/2fauth-worker-backup'
            }
        } else if (data.type === 'MS_AUTH_ERROR') {
            isAuthenticatingMicrosoft.value = false
            authStatusMicrosoft.value = 'error'
            authErrorMessageMicrosoft.value = data.message || t('backup.microsoft_auth_failed')
        }
    }

    const setupAuthListener = (onMessage) => {
        const handleMsg = (e) => {
            // Security: Always verify origin for window message events
            if (e instanceof MessageEvent && e.origin !== window.location.origin && e.source !== window) {
                // BroadcastChannel events are same-origin by design, but window.postMessage needs this check
                if (e.origin !== window.location.origin) return;
            }
            onMessage(e)
            handleAuthMessage(e)
        }

        // 1. Listen via postMessage
        window.addEventListener('message', handleMsg)

        // 2. Listen via BroadcastChannel (More robust)
        const bc = new BroadcastChannel('gdrive_oauth_channel')
        bc.onmessage = handleMsg

        const bcMs = new BroadcastChannel('ms_oauth_channel')
        bcMs.onmessage = handleMsg

        return () => {
            window.removeEventListener('message', handleMsg)
            bc.close()
            bcMs.close()
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
        isEditingWebdavPwd,
        isEditingS3Secret,
        isEditingTelegramToken,
        isEditingGoogleDrive,
        isEditingOneDrive,
        isAuthenticatingGoogle,
        isAuthenticatingMicrosoft,
        authStatus,
        authStatusMicrosoft,
        authErrorMessage,
        authErrorMessageMicrosoft,
        form,
        hasExistingAutoPwd,
        configUseExistingAutoPwd,
        fetchProviders,
        openAddDialog,
        editProvider,
        testConnection,
        saveProvider,
        deleteProvider,
        startGoogleAuth,
        startMicrosoftAuth,
        handleAuthMessage,
        setupAuthListener,
        availableTypes
    }
}
