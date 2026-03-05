import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import { registerSW } from 'virtual:pwa-register'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/app/styles/main.css'
import '@/app/styles/dark.css'
import App from '@/app/app.vue'
import router from '@/app/router'
import { useThemeStore } from '@/shared/stores/themeStore'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { i18n } from '@/locales'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)

// 初始化主题状态
const themeStore = useThemeStore()
themeStore.initTheme()

// PWA Service Worker 注册
registerSW({
  onOfflineReady() {
    import('element-plus').then(({ ElNotification }) => {
      ElNotification({
        title: i18n.global.t('common.update_available'),
        message: `
          <div style="line-height: 1.5; font-size: 14px; margin-bottom: 5px;">
            🎉 ${i18n.global.t('common.pwa_update_ready')}
          </div>
          <div>
            <button 
              style="background: var(--el-color-primary); color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;"
              onclick="window.location.reload()"
            >
              ${i18n.global.t('common.refresh_now')}
            </button>
          </div>
        `,
        dangerouslyUseHTMLString: true,
        type: 'success',
        duration: 0
      })
    })
  },
})

app.use(router)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false, // 避免切换窗口时频繁请求列表
        staleTime: 1000 * 60 * 5 // 5分钟内数据视为新鲜，不自动重发请求
      }
    }
  }
})

const vaultStore = useVaultStore()
vaultStore.init().then(() => {
  app.mount('#app')
})