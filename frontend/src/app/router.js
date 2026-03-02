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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：拦截未登录用户的访问
router.beforeEach(async (to, from, next) => {
  const authUserStore = useAuthUserStore()

  // 1. 检查内存中是否有用户信息 (乐观检查)
  let isAuthenticated = !!(authUserStore.userInfo && authUserStore.userInfo.id)

  // 2. 如果内存无状态，但目标页需要登录 OR 是仅游客页面(如登录页)，尝试通过 Cookie 恢复会话
  // (Option 1B: 即使访问登录页，也先确认是否已登录，防止误判)
  if (!isAuthenticated && (to.meta.requiresAuth || to.meta.guestOnly)) {
    try {
      await authUserStore.fetchUserInfo()
      isAuthenticated = !!(authUserStore.userInfo && authUserStore.userInfo.id)
    } catch (e) { }
  }

  // 3. 处理需要登录的页面
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
    return
  }

  // 4. 处理仅限游客的页面 (Option 2B: 已登录用户访问登录页则跳转首页)
  if (to.meta.guestOnly && isAuthenticated) {
    next('/')
    return
  }

  next()
})

export default router