import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { authService } from '@/features/auth/service/authService'
import { i18n } from '@/locales'
import { setIdbItem, getIdbItem } from '@/shared/utils/idb'

const CACHE_KEY = 'sys:cache:providers'

/**
 * 处理 OAuth 提供商列表加载与授权重定向
 */
export function useOAuthProviders() {
    const loadingProvider = ref(null)
    const providers = ref([])
    const isFetchingProviders = ref(true)

    onMounted(async () => {
        // 1. 优先从缓存读取，实现秒开 (Offline-first / Stale-while-revalidate)
        const cached = await getIdbItem(CACHE_KEY)
        if (cached) {
            providers.value = cached
        }

        // 2. 后台请求接口更新数据
        try {
            const data = await authService.getProviders()
            if (data.success) {
                providers.value = data.providers
                // 只有当后端返回了有效配置时才更新缓存
                if (data.providers && data.providers.length > 0) {
                    await setIdbItem(CACHE_KEY, data.providers)
                }
            }
        } catch (e) {
            console.error('Failed to sync oauth providers:', e)
            ElMessage.error(i18n.global.t('auth.fetch_providers_failed'))
        } finally {
            isFetchingProviders.value = false
        }
    })

    const handleLogin = async (providerId) => {
        if (loadingProvider.value) return
        loadingProvider.value = providerId

        try {
            // 1. 获取授权链接及防篡改参数
            const data = await authService.getAuthorizeUrl(providerId)

            if (data.success && data.authUrl) {
                // 2. 存储 state 防御 CSRF 并跳转
                await setIdbItem('tmp:auth:state', data.state)
                await setIdbItem('tmp:auth:provider', providerId)

                // PKCE (Proof Key for Code Exchange) 支持
                if (data.codeVerifier) {
                    await setIdbItem('tmp:auth:verifier', data.codeVerifier)
                }

                window.location.href = data.authUrl
            } else {
                let errorMsg = data.error
                if (errorMsg && i18n.global.te(`api_errors.${errorMsg}`)) {
                    errorMsg = i18n.global.t(`api_errors.${errorMsg}`)
                }
                ElMessage.error(errorMsg || i18n.global.t('auth.oauth_failed'))
            }
        } catch (error) {
            // Error managed by axios request interceptor & authError
            let errorMsg = error.message
            if (errorMsg && i18n.global.te(`api_errors.${errorMsg}`)) {
                errorMsg = i18n.global.t(`api_errors.${errorMsg}`)
            }
            ElMessage.error(errorMsg || i18n.global.t('auth.oauth_network_error'))
        } finally {
            // The loading state mostly clears when the page navigates away, 
            // but we reset it here in case of errors.
            loadingProvider.value = null
        }
    }

    return {
        providers,
        loadingProvider,
        isFetchingProviders,
        handleLogin
    }
}
