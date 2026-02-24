import { createApp } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import { registerSW } from 'virtual:pwa-register'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './main.css'
import './dark.css'
import App from './App.vue'
import router from './router'
import { initTheme } from './states/theme'

const app = createApp(App)

// 初始化主题状态 (从 localStorage 恢复)
initTheme()

// PWA Service Worker 注册
registerSW({
  onOfflineReady() {
    // 当 App 所有的资源都被缓存完毕，可以离线访问时触发
    ElMessage.success({
      message: '应用已缓存，支持离线访问',
      duration: 3000
    })
  },
})

app.use(router)
app.mount('#app')