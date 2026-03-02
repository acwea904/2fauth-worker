<template>
  <el-container class="home-container">
    <el-container class="main-body">

      <!-- 侧边栏（桌面 + 移动端抽屉，统一由 AppSidebar 管理） -->
      <AppSidebar :active-tab="activeTab" @select="activeTab = $event" />

      <el-main class="main-content">
        <!-- 视图：我的账户 -->
        <div v-if="activeTab === 'vault'" class="view-container">
          <VaultList ref="vaultListRef" @switch-tab="activeTab = $event" />
        </div>

        <!-- 视图：添加账号 -->
        <div v-if="activeTab === 'add-vault-scan'" class="view-container">
          <AddVaultScan @success="handleSuccess" />
        </div>
        <div v-if="activeTab === 'add-vault-manual'" class="view-container">
          <AddVaultManual @success="handleSuccess" />
        </div>

        <!-- 视图：数据导出 -->
        <div v-if="activeTab === 'migration-export'" class="view-container">
          <DataExport />
        </div>

        <!-- 视图：数据导入 -->
        <div v-if="activeTab === 'migration-import'" class="view-container">
          <DataImport @success="handleSuccess" />
        </div>

        <!-- 视图：云端备份 -->
        <div v-if="activeTab === 'backups'" class="view-container">
          <DataBackup @success="handleSuccess" />
        </div>

        <!-- 视图：实用工具 -->
        <div v-if="activeTab === 'tools'" class="view-container">
          <UtilityTools />
        </div>

      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, nextTick, defineAsyncComponent, watch } from 'vue'
import AppSidebar from '@/features/vault/components/appSidebar.vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'

const layoutStore = useLayoutStore()

const VaultList     = defineAsyncComponent(() => import('@/features/vault/components/vaultList.vue'))
const AddVaultScan  = defineAsyncComponent(() => import('@/features/vault/components/addVaultScan.vue'))
const AddVaultManual= defineAsyncComponent(() => import('@/features/vault/components/addVaultManual.vue'))
const DataExport    = defineAsyncComponent(() => import('@/features/migration/views/dataExport.vue'))
const DataImport    = defineAsyncComponent(() => import('@/features/migration/views/dataImport.vue'))
const DataBackup    = defineAsyncComponent(() => import('@/features/backup/views/dataBackup.vue'))
const UtilityTools  = defineAsyncComponent(() => import('@/features/tools/views/utilityTools.vue'))

const activeTab    = ref('vault')
const vaultListRef = ref(null)

// 操作成功后：跳回账户列表并刷新数据
let pendingRefetch = false

const handleSuccess = () => {
  activeTab.value = 'vault'
  if (vaultListRef.value) {
    nextTick(() => vaultListRef.value?.fetchVault())
  } else {
    // VaultList 是懒加载组件，标记待刷新，等 ref 绑定后执行
    pendingRefetch = true
  }
}

watch(vaultListRef, (ref) => {
  if (ref && pendingRefetch) {
    pendingRefetch = false
    nextTick(() => ref.fetchVault())
  }
})

// 监听头部 Logo 点击事件，无刷新跳回主列表
watch(() => layoutStore.homeTabReset, () => {
  if (activeTab.value !== 'vault') {
    activeTab.value = 'vault'
  }
  // 强制刷新一下列表数据
  if (vaultListRef.value) {
    nextTick(() => vaultListRef.value?.fetchVault())
  } else {
    pendingRefetch = true
  }
})
</script>