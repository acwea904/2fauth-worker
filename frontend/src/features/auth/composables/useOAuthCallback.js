import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthUserStore } from '@/features/auth/store/authUserStore'
import { setIdbItem } from '@/shared/utils/idb'
import { authService } from '@/features/auth/service/authService'

/**
 * 处理 OAuth 授权重定向回来的回调逻辑 (验证、防伪造、Token 兑换)
 */
export function useOAuthCallback() {
    const route = useRoute()
    const router = useRouter()
    const errorMsg = ref('')
    const providerName = ref('身份提供商')

    onMounted(async () => {
        const code = route.query.code
        const state = route.query.state
        const error = route.query.error
        const hash = route.query.hash // Telegram 特有参数

        // 1. 智能识别 Provider
        let providerId = route.params.provider
        if (!providerId) {
            if (hash) providerId = 'telegram'
            else providerId = localStorage.getItem('oauth_provider') || 'github'
        }

        // 优化：优先从缓存读取提供商名称
        try {
            const cached = localStorage.getItem('oauth_providers_cache')
            if (cached) {
                const providers = JSON.parse(cached)
                const p = providers.find(x => x.id === providerId)
                if (p) providerName.value = p.name
            } else {
                const res = await authService.getProviders()
                const p = res.providers?.find(x => x.id === providerId)
                if (p) providerName.value = p.name
            }
        } catch (e) {
            // Ignore cache errors
        }

        if (error) {
            errorMsg.value = route.query.error_description || `您拒绝了 ${providerName.value} 的授权请求`
            return
        }

        // 2. 参数结构校验 (策略分发)
        let payload = {}

        if (providerId === 'telegram') {
            if (!hash) {
                errorMsg.value = 'Telegram 登录缺少签名参数'
                return
            }
            const savedState = localStorage.getItem('oauth_state')
            payload = { ...route.query, state: savedState }
        } else {
            if (!code || !state) {
                errorMsg.value = 'URL 缺少必要的授权凭证参数'
                return
            }

            // 防御 CSRF：必须检查 State 匹不匹配
            const savedState = localStorage.getItem('oauth_state')
            if (!savedState || savedState !== state) {
                errorMsg.value = '安全警告：State 校验失败，请求可能被篡改'
                return
            }

            const codeVerifier = localStorage.getItem('oauth_code_verifier')
            payload = { code, state, codeVerifier }
        }

        // 无论成功与否，用过一次立马清除防止重放 (Replay Attack)
        localStorage.removeItem('oauth_state')
        localStorage.removeItem('oauth_provider')
        localStorage.removeItem('oauth_code_verifier')

        try {
            const startTime = Date.now()
            // Telegram 用户体验优化：强制展示 1.5s 的 Loading 画风
            const MIN_DISPLAY_TIME = providerId === 'telegram' ? 1500 : 0

            // 向后端服务进行 Token 兑换
            const data = await authService.loginWithToken(providerId, payload)

            const elapsed = Date.now() - startTime
            if (elapsed < MIN_DISPLAY_TIME) {
                await new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_TIME - elapsed))
            }

            if (data.success) {
                // 持久化设备指纹标识 (用于双端加密验证)
                if (data.deviceKey) {
                    await setIdbItem('device_salt', data.deviceKey)
                }

                // 更新状态机进入应用主流程
                const authUserStore = useAuthUserStore()
                await authUserStore.fetchUserInfo()
                router.push('/')
            } else {
                errorMsg.value = data.error || '登录验证被后端拒绝'
            }
        } catch (err) {
            console.error('OAuth Callback Error:', err)
            // Error Managed by request interceptor and authError mapping
            errorMsg.value = err.message || '网络请求异常，请稍后再试'
        }
    })

    const goBackToLogin = () => {
        router.push('/login')
    }

    return {
        errorMsg,
        providerName,
        goBackToLogin
    }
}
