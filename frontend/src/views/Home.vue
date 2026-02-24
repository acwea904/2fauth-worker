<template>
  <el-container class="home-container">
    <el-container class="main-body">
      <!-- 侧边栏 (Desktop) -->
      <el-aside width="240px" class="left-aside" v-if="!layoutState.isMobile">
        <el-menu
          :default-active="activeTab"
          class="side-menu"
          @select="handleMenuSelect"
          background-color="#fff"
          text-color="#606266"
          active-text-color="#409EFF"
        >
          <el-menu-item index="accounts">
            <el-icon><Iphone /></el-icon>
            <span>我的账户</span>
          </el-menu-item>

          <el-sub-menu index="add-account">
            <template #title>
              <el-icon><Plus /></el-icon><span>添加账号</span>
            </template>
            <el-menu-item index="add-account-scan">
              <el-icon><Camera /></el-icon><span>扫码添加</span>
            </el-menu-item>
            <el-menu-item index="add-account-manual">
              <el-icon><Edit /></el-icon><span>手动输入</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="migration">
            <template #title>
              <el-icon><Sort /></el-icon><span>数据迁移</span>
            </template>
            <el-menu-item index="migration-export"><el-icon><Upload /></el-icon><span>数据导出</span></el-menu-item>
            <el-menu-item index="migration-import"><el-icon><Download /></el-icon><span>数据导入</span></el-menu-item>
          </el-sub-menu>

          <el-menu-item index="backups">
            <el-icon><Cloudy /></el-icon><span>云端备份</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 抽屉菜单 (Mobile) -->
      <el-drawer
        v-model="layoutState.showMobileMenu"
        direction="ltr"
        size="240px"
        :with-header="false"
      >
        <el-menu
          :default-active="activeTab"
          class="side-menu"
          @select="handleMenuSelect"
          style="border-right: none;"
        >
          <el-menu-item index="accounts">
            <el-icon><Iphone /></el-icon>
            <span>我的账户</span>
          </el-menu-item>
          <el-sub-menu index="add-account">
            <template #title>
              <el-icon><Plus /></el-icon><span>添加账号</span>
            </template>
            <el-menu-item index="add-account-scan">
              <el-icon><Camera /></el-icon><span>扫码添加</span>
            </el-menu-item>
            <el-menu-item index="add-account-manual">
              <el-icon><Edit /></el-icon><span>手动输入</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="migration">
            <template #title>
              <el-icon><Sort /></el-icon><span>数据迁移</span>
            </template>
            <el-menu-item index="migration-export"><el-icon><Upload /></el-icon><span>数据导出</span></el-menu-item>
            <el-menu-item index="migration-import"><el-icon><Download /></el-icon><span>数据导入</span></el-menu-item>
          </el-sub-menu>
          <el-menu-item index="backups">
            <el-icon><Cloudy /></el-icon><span>云端备份</span>
          </el-menu-item>
        </el-menu>
      </el-drawer>

      <el-main class="main-content">
        <!-- 视图：我的账户 -->
        <div v-if="activeTab === 'accounts'" class="view-container">
          <AccountList ref="accountListRef" @switch-tab="activeTab = $event" />
        </div>

        <!-- 视图：添加账号 -->
        <div v-if="activeTab === 'add-account-scan'" class="view-container">
          <AddAccountScan @success="handleSuccess" />
        </div>
        <div v-if="activeTab === 'add-account-manual'" class="view-container">
          <AddAccountManual @success="handleSuccess" />
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

      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { Iphone, Plus, Camera, Edit, Sort, Upload, Download, Cloudy } from '@element-plus/icons-vue'
import { layoutState } from '../states/layout'

import AccountList from '../components/AccountList.vue'
import AddAccountScan from '../components/AddAccountScan.vue'
import AddAccountManual from '../components/AddAccountManual.vue'
import DataExport from '../components/DataExport.vue'
import DataImport from '../components/DataImport.vue'
import DataBackup from '../components/DataBackup.vue'

const activeTab = ref('accounts')
const accountListRef = ref(null)

// 移动端菜单处理
const handleMenuSelect = (index) => {
  activeTab.value = index
  if (layoutState.isMobile) {
    layoutState.showMobileMenu = false
  }
}

// 操作成功回调 (刷新列表)
const handleSuccess = () => {
  activeTab.value = 'accounts'
  nextTick(() => {
    if (accountListRef.value) {
      accountListRef.value.fetchAccounts()
    }
  })
}
</script>

<style scoped>
.home-container {
  height: 100%; /* 占满父容器 (App.vue 的 main) */
  background-color: #f5f7fa;
}

.main-body {
  height: 100%; /* 自动填充 */
  display: flex;
  overflow: hidden; /* 内部滚动 */
}

.left-aside {
  background: white;
  border-right: 1px solid #e6e6e6;
}

.side-menu {
  border-right: none;
  padding-top: 10px;
}

.main-content {
  padding: 30px 20px;
  width: 100%;
  background-color: #f5f7fa;
  overflow-y: auto; /* 内容区独立滚动 */
}
</style>