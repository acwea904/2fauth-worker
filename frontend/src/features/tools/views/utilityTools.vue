<template>
  <div class="tools-wrapper">
    <div class="tab-card-wrapper">
      <div class="tools-header">
        <el-button v-if="currentTool" link @click="currentTool = null" class="back-btn">
          <el-icon><ArrowLeft /></el-icon> {{ $t('common.back') }}
        </el-button>
        <h2>{{ currentTool ? getToolTitle(currentTool) : `🛠️ ${$t('tools.title')}` }}</h2>
      </div>

      <!-- 工具列表 (卡片视图) -->
      <div v-if="!currentTool" class="tools-grid">
        <el-card 
          v-for="tool in tools" 
          :key="tool.id" 
          shadow="hover" 
          class="tool-card" 
          @click="currentTool = tool.id"
        >
          <div class="tool-card-content">
            <div class="icon-wrapper" :style="{ backgroundColor: tool.bgColor }">
              <el-icon :size="32" :color="tool.iconColor"><component :is="tool.icon" /></el-icon>
            </div>
            <div class="text-info">
              <h3>{{ tool.title }}</h3>
              <p>{{ tool.desc }}</p>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 具体工具内容 -->
      <div v-else class="tool-container">
        
        <!-- 动态组件加载 -->
        <component :is="activeComponent" />

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { Key, ArrowLeft, Timer, Lock, Camera } from '@element-plus/icons-vue'
import { i18n } from '@/locales'
const ToolPassword = defineAsyncComponent(() => import('@/features/tools/components/passwordGenerator.vue'))
const ToolTimeSync = defineAsyncComponent(() => import('@/features/tools/components/timeSync.vue'))
const ToolQrParser = defineAsyncComponent(() => import('@/features/tools/components/qrParser.vue'))
const ToolTotpSecret = defineAsyncComponent(() => import('@/features/tools/components/totpSecret.vue'))

const currentTool = ref(null)

const { t } = i18n.global

const tools = computed(() => [
  { 
    id: 'totp-secret', 
    title: t('tools.totp_secret_title'), 
    desc: t('tools.totp_secret_desc'), 
    icon: Lock, 
    iconColor: '#67C23A',
    bgColor: 'var(--el-color-success-light-9)'
  },
  { 
    id: 'password', 
    title: t('tools.password_gen_title'), 
    desc: t('tools.password_gen_desc'), 
    icon: Key, 
    iconColor: '#409EFF',
    bgColor: 'var(--el-color-primary-light-9)'
  },
  {
    id: 'time-sync',
    title: t('tools.time_sync_title'),
    desc: t('tools.time_sync_desc'),
    icon: Timer,
    iconColor: '#E6A23C',
    bgColor: 'var(--el-color-warning-light-9)'
  },
  {
    id: 'qr-parser',
    title: t('tools.qr_parser_title'),
    desc: t('tools.qr_parser_desc'),
    icon: Camera,
    iconColor: '#F56C6C',
    bgColor: 'var(--el-color-danger-light-9)'
  }
])

const getToolTitle = (id) => {
  const t = tools.value.find(tool => tool.id === id)
  return t ? t.title : '工具'
}

const activeComponent = computed(() => {
  switch (currentTool.value) {
    case 'password': return ToolPassword;
    case 'time-sync': return ToolTimeSync;
    case 'qr-parser': return ToolQrParser;
    case 'totp-secret': return ToolTotpSecret;
    default: return null
  }
})
</script>
