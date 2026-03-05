<template>
  <!-- 侧边栏 (Desktop) -->
  <el-aside :width="isCollapse ? '64px' : '240px'" class="left-aside" v-if="!layoutStore.isMobile">
    <el-menu
      :default-active="activeTab"
      class="side-menu"
      @select="$emit('select', $event)"
      :collapse="isCollapse"
    >
      <el-menu-item index="vault">
        <el-icon><CopyDocument /></el-icon>
        <template #title><span>{{ $t('menu.vault') }}</span></template>
      </el-menu-item>

      <el-sub-menu index="add-vault">
        <template #title>
          <el-icon><Plus /></el-icon><span>{{ $t('menu.add') }}</span>
        </template>
        <el-menu-item index="add-vault-scan">
          <el-icon><Camera /></el-icon><span>{{ $t('vault.scan_qr') }}</span>
        </el-menu-item>
        <el-menu-item index="add-vault-manual">
          <el-icon><Edit /></el-icon><span>{{ $t('vault.add_account') }}</span>
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="migration">
        <template #title>
          <el-icon><Sort /></el-icon><span>{{ $t('menu.migration') }}</span>
        </template>
        <el-menu-item index="migration-export"><el-icon><Upload /></el-icon><span>{{ $t('migration.export') }}</span></el-menu-item>
        <el-menu-item index="migration-import"><el-icon><Download /></el-icon><span>{{ $t('migration.import') }}</span></el-menu-item>
      </el-sub-menu>

      <el-menu-item index="backups">
        <el-icon><Cloudy /></el-icon><template #title><span>{{ $t('menu.backup') }}</span></template>
      </el-menu-item>

      <el-menu-item index="tools">
        <el-icon><Tools /></el-icon><template #title><span>{{ $t('menu.tools') }}</span></template>
      </el-menu-item>
    </el-menu>

    <!-- 底部操作按钮 -->
    <div class="sidebar-footer" :class="{ 'is-collapsed': isCollapse }">
      <el-button circle :icon="isCollapse ? Expand : Fold" @click="toggleCollapse" :title="isCollapse ? '展开' : '折叠'" />
      <el-button circle :icon="themeStore.isDark ? Sunny : Moon" @click="themeStore.toggleTheme" />
      <el-button circle size="medium" :icon="iconLocales" :title="$i18n.locale === 'zh-CN' ? 'English' : '切换语言'" @click="toggleLanguage" />
      <el-button circle @click="handleLogout" :title="$t('menu.logout')">
        <el-icon><SwitchButton /></el-icon>
      </el-button>
    </div>
  </el-aside>

  <!-- 抽屉菜单 (Mobile) -->
  <el-drawer
    v-model="layoutStore.showMobileMenu"
    direction="ltr"
    size="240px"
    :with-header="false"
    :lock-scroll="false"
  >
    <div class="drawer-content">
      <el-menu
        :default-active="activeTab"
        class="side-menu"
        @select="handleMobileSelect"
        style="border-right: none;"
      >
        <el-menu-item index="vault">
          <el-icon><CopyDocument /></el-icon>
          <span>{{ $t('menu.vault') }}</span>
        </el-menu-item>
        <el-sub-menu index="add-vault">
          <template #title>
            <el-icon><Plus /></el-icon><span>{{ $t('menu.add') }}</span>
          </template>
          <el-menu-item index="add-vault-scan">
            <el-icon><Camera /></el-icon><span>{{ $t('vault.scan_qr') }}</span>
          </el-menu-item>
          <el-menu-item index="add-vault-manual">
            <el-icon><Edit /></el-icon><span>{{ $t('vault.add_account') }}</span>
          </el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="migration">
          <template #title>
            <el-icon><Sort /></el-icon><span>{{ $t('menu.migration') }}</span>
          </template>
          <el-menu-item index="migration-export"><el-icon><Upload /></el-icon><span>{{ $t('migration.export') }}</span></el-menu-item>
          <el-menu-item index="migration-import"><el-icon><Download /></el-icon><span>{{ $t('migration.import') }}</span></el-menu-item>
        </el-sub-menu>
        <el-menu-item index="backups">
          <el-icon><Cloudy /></el-icon><span>{{ $t('menu.backup') }}</span>
        </el-menu-item>
        <el-menu-item index="tools">
          <el-icon><Tools /></el-icon><span>{{ $t('menu.tools') }}</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer" style="display: flex; gap: 15px; justify-content: center; padding: 20px 0;">
        <el-button circle size="medium" :icon="themeStore.isDark ? Sunny : Moon" @click="themeStore.toggleTheme" />
        <el-button circle size="medium" :icon="iconLocales" :title="$i18n.locale === 'zh-CN' ? 'English' : '切换语言'" @click="toggleLanguage" />
        <el-button circle size="medium" @click="handleLogout" :title="$t('menu.logout')">
          <el-icon><SwitchButton /></el-icon>
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  CopyDocument, Plus, Camera, Edit, Sort, Upload, Download,
  Cloudy, Sunny, Moon, SwitchButton, Fold, Expand, Tools
} from '@element-plus/icons-vue'
import iconLocales from '@/shared/components/icons/iconLocales.vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useThemeStore } from '@/shared/stores/themeStore'
import { useAuthUserStore } from '@/features/auth/store/authUserStore'
import { useI18n } from 'vue-i18n'
import { setLanguage } from '@/locales'

const { t, locale } = useI18n()

const props = defineProps({
  activeTab: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select'])

const layoutStore = useLayoutStore()
const themeStore = useThemeStore()
const authUserStore = useAuthUserStore()
const router = useRouter()

const isCollapse = ref(localStorage.getItem('sidebar_collapse') === 'true')

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
  localStorage.setItem('sidebar_collapse', isCollapse.value)
}

const toggleLanguage = () => {
  const targetLang = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  setLanguage(targetLang)
}

// 移动端：关闭抽屉后再通知父组件切换 Tab
const handleMobileSelect = (index) => {
  layoutStore.showMobileMenu = false
  emit('select', index)
}

const handleLogout = async () => {
  if (layoutStore.showMobileMenu) {
    layoutStore.showMobileMenu = false
  }
  await authUserStore.logout()
  router.replace('/login')
  ElMessage.success(t('auth.logout_success'))
}
</script>
