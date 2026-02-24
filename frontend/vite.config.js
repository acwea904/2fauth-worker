import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router'], // 自动导入 ref, computed, useRouter 等
      resolvers: [ElementPlusResolver({ importStyle: false })], // 关掉样式自动引入，交给 main.js
    }),
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: false,
        }),
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate', // 自动更新 Service Worker
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon.png'], // 静态资源缓存
      devOptions: {
        enabled: true // 开启开发环境支持
      },
      manifest: {
        name: '2FAuth - Secure 2FA Manager',
        short_name: '2FAuth',
        description: 'A secure, serverless 2FA management tool.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // 独立应用模式 (无浏览器地址栏)
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // 适应不同形状的图标 (圆角/圆形)
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], // 缓存所有静态资源
        navigateFallback: '/index.html' // 关键：SPA 单页应用离线必须回退到 index.html
      }
    })
  ],
  server: {
    host: '0.0.0.0', // 兼容 Docker DevContainer
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787', // 你的 Hono 后端地址
        changeOrigin: true
      }
    }
  }
})