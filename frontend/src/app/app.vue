<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { Warning } from '@element-plus/icons-vue'
import TheHeader from '@/shared/components/theHeader.vue'
import TheFooter from '@/shared/components/theFooter.vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'

const { locale } = useI18n()
const elementLocale = computed(() => {
  return locale.value === 'zh-CN' ? zhCn : en
})

const route = useRoute()
const layoutStore = useLayoutStore()

const checkMobile = () => {
  layoutStore.isMobile = window.innerWidth < 768
}

const isOffline = ref(false)
const setOnline = () => { isOffline.value = false }
const setOffline = () => { isOffline.value = true }

onMounted(() => {
  checkMobile()
  isOffline.value = !navigator.onLine
  window.addEventListener('resize', checkMobile)
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('online', setOnline)
  window.removeEventListener('offline', setOffline)
})
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-container">
      <!-- 方案A: 全局离线横幅 -->
    <div v-if="isOffline" class="global-offline-banner" style="background-color: #fdf6ec; color: #e6a23c; padding: 10px 15px; text-align: center; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; border-bottom: 1px solid #faecd8; position: sticky; top: 0; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
      <el-icon><Warning /></el-icon> <span>{{ $t('common.offline_mode') }}</span>
    </div>

    <!-- 登录页通常不显示头部，可以通过路由 meta 控制，这里简单示例默认显示 -->
    <TheHeader v-if="!route.meta.hideHeader" />
    
    <main>
      <RouterView />
    </main>
      <TheFooter />
    </div>
  </el-config-provider>
</template>
