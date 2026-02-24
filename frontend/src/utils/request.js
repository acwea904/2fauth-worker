import { ElMessage } from 'element-plus'
import router from '../router'

// 辅助函数：从 document.cookie 中安全地读取指定的 cookie 值
export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

export async function request(url, options = {}) {
    // 1. 移除旧的 localStorage Token 逻辑
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    }
    
    // 2. 新增：读取 CSRF Token 并添加到请求头
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    try {
        // 3. 新增：配置 credentials: 'include' 以自动发送 cookie
        const response = await fetch(url, { ...options, headers, credentials: 'include' })

        // 针对 204 No Content 等情况，没有 body，直接返回成功
        if (response.status === 204) {
            return { success: true };
        }

        const data = await response.json()

        // 4. 更新：处理 401/403 未登录或 CSRF 失败
        if (response.status === 401 || response.status === 403) {
            ElMessage.error(data.error || '会话已过期或权限不足，请重新登录')
            localStorage.removeItem('userInfo')
            if (router.currentRoute.value.path !== '/login') router.push('/login')
            throw new Error(data.error || 'Unauthorized/Forbidden')
        }

        // 处理其他报错
        if (!response.ok) {
            ElMessage.error(data.error || data.message || '请求失败')
            throw new Error(data.error || '请求失败')
        }

        return data
    } catch (error) {
        if (error.message !== 'Unauthorized/Forbidden') console.error('API Request Error:', error)
        throw error
    }
}