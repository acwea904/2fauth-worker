// frontend/vite.config.js
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { execSync } from 'child_process'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

let commitHash = ''
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  commitHash = 'unknown'
}

export default defineConfig({
  plugins: [
    vue(),
    wasm(),
    topLevelAwait(),
    AutoImport({
      imports: ['vue', 'vue-router'],
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
    AutoImport({
      imports: ['vue', 'vue-router'],
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: false,
        }),
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon.png'],
      devOptions: {
        enabled: true
      },
      manifest: {
        id: '/',
        name: '2FAuth Worker',
        short_name: '2FAuth Worker',
        description: 'A Secure 2FA Management Tool',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['utilities', 'security'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: [
          '**/assets/wa-sqlite*.js',
          '**/assets/argon2*.js',
          '**/assets/sql*.js',
          '**/assets/jsQR*.js',
          '**/assets/dataImport*.js',
          '**/assets/dataMigrationService*.js'
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly'
          },
          {
            // 为大体积、非高频访问的 WASM 文件配置动态缓存
            urlPattern: /\.wasm$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-dynamic-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 天
              }
            }
          },
          {
            // 为被 globIgnores 忽略的大体积工具 JS chunk 配置动态缓存
            urlPattern: /assets\/(wa-sqlite|argon2|sql|jsQR|dataImport|dataMigrationService).*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-tools-js-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 精确匹配 Vue 与其核心生态相关包
            if (
              id.includes('/node_modules/vue/') ||
              id.includes('/node_modules/@vue/') ||
              id.includes('/node_modules/vue-router/') ||
              id.includes('/node_modules/pinia/')
            ) {
              return 'vue-core'
            }

            // 精确匹配 Element Plus 及其底层依赖
            if (
              id.includes('/node_modules/element-plus/') ||
              id.includes('/node_modules/@element-plus/')
            ) {
              return 'element-plus'
            }

            // 加密与数据库相关的超大模块抽象为主 Vendor Chunk
            if (id.includes('/node_modules/wa-sqlite/')) return 'wa-sqlite'
            if (id.includes('/node_modules/argon2-browser/')) return 'argon2-browser'
            if (id.includes('/node_modules/sql.js/')) return 'sql-js'

            // 剩余其他的第三方包交给 Rollup 按需路由或组件自动拆分 (移除强硬的 'vendor' 返回)
          }
        }
      }
    }
  }
})
