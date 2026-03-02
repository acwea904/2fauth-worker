<template>
  <footer class="global-footer">
    <div class="footer-content">
      <p>
        &copy;{{ new Date().getFullYear() }} <a href="https://github.com/nap0o/2fauth-worker" target="_blank" rel="noopener noreferrer">2FAuth Worker</a>
        <span v-if="!layoutStore.isMobile">
          <span class="divider">|</span>
          A Secure 2FA Management Tool
        </span>
        <span v-if="commitHash && commitHash !== 'unknown'">
          <span class="divider">|</span>
          Hash-{{ commitHash }}
        </span>
      </p>
    </div>
  </footer>
</template>

<script setup>
import { useLayoutStore } from '@/shared/stores/layoutStore'

const layoutStore = useLayoutStore()
// 注入在 vite.config.js 中定义的全局构建环境变量
const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'unknown'
</script>