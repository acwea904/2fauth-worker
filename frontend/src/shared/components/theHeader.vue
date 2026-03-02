<template>
  <header class="header">
    <div class="logo">
      <el-button v-if="layoutStore.isMobile && !!authUserStore.userInfo?.username" @click="layoutStore.showMobileMenu = true" style="margin-right: 10px; padding: 5px 8px; border: 1px solid var(--el-border-color); height: auto;">
        <el-icon :size="14" class="menu-icon" style="color: var(--el-text-color-primary);">
          <svg viewBox="0 0 16 16" version="1.1" width="100%" height="100%" aria-hidden="true" fill="currentColor">
            <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z"></path>
          </svg>
        </el-icon>
      </el-button>
      <a href="#" @click.prevent="goHome" style="display: flex; align-items: center; text-decoration: none; color: inherit;">
        <el-icon :size="24" color="#409EFC" style="margin-right: 10px;"><Lock /></el-icon>
        <h2>2FAuth Worker</h2>
      </a>
    </div>
    <div class="user-actions" v-if="route.path !== '/login'">
      <div class="user-profile" v-if="!layoutStore.isMobile">
        <el-avatar :size="32" :src="authUserStore.userInfo?.avatar">
          {{ authUserStore.userInfo?.username?.charAt(0)?.toUpperCase() }}
        </el-avatar>
        <span class="username">{{ authUserStore.userInfo?.username }}</span>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock } from '@element-plus/icons-vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useAuthUserStore } from '@/features/auth/store/authUserStore'

const route = useRoute()
const router = useRouter()
const layoutStore = useLayoutStore()
const authUserStore = useAuthUserStore()

const goHome = () => {
  if (route.path === '/') {
    layoutStore.homeTabReset++
  } else {
    router.push('/')
  }
}
</script>