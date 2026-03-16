import { createRouter, createWebHistory } from 'vue-router'
import { useAuthUserStore } from '@/features/auth/store/authUserStore'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/features/vault/views/home.vue'),
    meta: { requiresAuth: true } // 需要登录才能访问
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/features/auth/views/login.vue'),
    meta: { guestOnly: true } // 仅限游客访问 (已登录会自动跳转首页)
  },
  {
    path: '/oauth/callback', // 统一的回调路径 (GitHub, Telegram, etc.)
    name: 'OAuthCallback',
    component: () => import('@/features/auth/views/oauthCallback.vue')
  },
  {
    path: '/callback/:provider', // 兼容特定 Provider 的回调路径 (如 /callback/telegram)
    name: 'ProviderCallback',
    component: () => import('@/features/auth/views/oauthCallback.vue')
  },
  {
    path: '/health',
    name: 'HealthCheck',
    component: () => import('@/features/health/views/healthCheck.vue'),
    meta: { guestOnly: false, requiresAuth: false }
  },
  {
    path: '/emergency',
    name: 'Emergency',
    component: () => import('@/features/auth/views/emergency.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：拦截未登录用户的访问
router.beforeEach(async (to) => {
  const authUserStore = useAuthUserStore()

  // 1. 检查内存中是否有用户信息 (乐观检查)
  let isAuthenticated = !!(authUserStore.userInfo && authUserStore.userInfo.id)

  // 2. 如果内存无状态，但目标页需要登录 OR 是仅游客页面(如登录页)，尝试通过 Cookie 恢复会话
  if (!isAuthenticated && (to.meta.requiresAuth || to.meta.guestOnly)) {
    try {
      await authUserStore.fetchUserInfo()
      isAuthenticated = !!(authUserStore.userInfo && authUserStore.userInfo.id)
    } catch (e) {
      if (e.isSecurity || e.message === 'Security Check Failed') {
        return '/health'
      }
    }
  }

  // 3. 处理需要登录的页面
  if (to.meta.requiresAuth && !isAuthenticated) {
    return '/login'
  }

  // 4. 处理强制初始化逻辑 (核心密钥备份)
  if (isAuthenticated) {
    if (authUserStore.needsEmergency && to.path !== '/emergency') {
      return '/emergency'
    }
    if (!authUserStore.needsEmergency && to.path === '/emergency') {
      return '/'
    }
  }

  // 5. 处理仅限游客的页面
  if (to.meta.guestOnly && isAuthenticated) {
    return '/'
  }

  return true
})

export default router