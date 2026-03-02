import { ElMessage } from 'element-plus'
import router from '@/app/router'
import { useAuthUserStore } from '@/features/auth/store/authUserStore'

// 辅助函数：从 document.cookie 中安全地读取指定的 cookie 值
export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

let isNavigatingToLogin = false; // 增加防重入锁，避免并发 401 触发无限弹窗和跳转

export async function request(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    }

    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    // --- 离线拦截逻辑 ---
    // 拦截破坏性/写操作，在无网络时提供温和提示并短路执行
    const method = (options.method || 'GET').toUpperCase();
    if (!navigator.onLine && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        if (!options.silent) {
            ElMessage.warning('当前处于离线模式，无法进行此操作');
        }
        throw new Error('Offline: Cannot perform mutative action');
    }

    try {
        const response = await fetch(url, { ...options, headers, credentials: 'include' })

        // 针对 204 No Content，没有 body，直接返回成功
        if (response.status === 204) {
            return { success: true };
        }

        const data = await response.json()

        // 处理 401 Unauthorized (后端统一抛出的 AppError 会被 index.ts 捕获并返回 { code: 401, success: false, message: ...})
        if (response.status === 401 || data.code === 401) {
            if (options.silent) {
                throw new Error(data.message || data.error || 'Unauthorized/Forbidden')
            }

            if (!isNavigatingToLogin) {
                isNavigatingToLogin = true;
                ElMessage.error(data.message || data.error || '会话已过期，请重新登录')

                // 调用 Pinia Action 清空用户信息、缓存、以及重置内存状态，防止路由守卫死循环打回
                try {
                    const authUserStore = useAuthUserStore()
                    authUserStore.clearUserInfo()
                } catch (e) {
                    // Fallback to manual localstorage clear if store is unavailable
                    localStorage.removeItem('userInfo')
                    localStorage.removeItem('secure_vault')
                    localStorage.removeItem('backup_providers_cache')
                    sessionStorage.removeItem('vault_session_key')
                }

                if (router && router.currentRoute.value.path !== '/login') {
                    router.replace('/login').then(() => {
                        // 给个延迟再释放锁，防止快速回溯
                        setTimeout(() => { isNavigatingToLogin = false }, 1000)
                    }).catch(() => {
                        setTimeout(() => { isNavigatingToLogin = false }, 1000)
                    })
                } else {
                    setTimeout(() => { isNavigatingToLogin = false }, 1000)
                }
            }
            throw new Error(data.message || data.error || 'Unauthorized/Forbidden')
        }

        // 处理其他业务报错或 HTTP 错误
        // 注意：兼容旧的 data.error 和新的 data.message
        if (!response.ok || data.success === false) {
            if (!options.silent) {
                ElMessage.error(data.message || data.error || '请求失败')
            }
            throw new Error(data.message || data.error || '请求失败')
        }

        // 解构新的标准响应格式。如果后端返回 { success: true, data: [...] }，这里直接将 data 铺平返回，保持对原有旧代码的兼容性。
        // 或如果未被包装，直接 fallback 回 data 本身
        if (data.data !== undefined && Object.keys(data).includes('code')) {
            return { success: true, ...data.data }
        }

        return data
    } catch (error) {
        // 屏蔽被 silent 处理过的 Auth Error
        if (error.message !== 'Unauthorized/Forbidden' && !options.silent) {
            console.error('API Request Error:', error)
        }
        throw error
    }
}