<template>
  <div class="data-export-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>数据导出</h2>
        <p style="color: var(--el-text-color-secondary);">选择您需要的导出格式。请注意，明文导出存在安全风险。</p>
      </div>

      <div class="export-groups" v-loading="isExporting" :element-loading-text="loadingText">
        
        <!-- 1. 本系统备份 -->
        <div class="export-group-card">
          <div class="group-header">
            <el-icon><Lock /></el-icon>
            <span>本系统备份</span>
          </div>
          <div class="button-row">
            <el-button plain @click="openExportDialog('encrypted')" class="button-with-icon">
              <el-icon><Lock /></el-icon> 加密备份 (.json)
            </el-button>
            <el-button plain @click="openWarningDialog('json')" class="button-with-icon">
              <el-icon><Unlock /></el-icon> 明文备份 (.json)
            </el-button>
          </div>
        </div>

        <!-- 2. 移动端 2FA App -->
        <div class="export-group-card">
          <div class="group-header">
            <el-icon><Iphone /></el-icon>
            <span>移动端 2FA App</span>
          </div>
          <div class="button-row">
            <el-button plain @click="openWarningDialog('2fas')" class="button-with-icon">
              <el-icon><icon2FAS /></el-icon> 2FAS (.2fas)
            </el-button>
            <el-button plain @click="openWarningDialog('aegis')" class="button-with-icon">
              <el-icon><iconAegis /></el-icon> Aegis (.json)
            </el-button>
            <el-button plain @click="openGaDialogDirectly" class="button-with-icon">
              <el-icon><iconGoogleAuth /></el-icon> 迁移到 Google Auth
            </el-button>
            <el-button plain @click="openWarningDialog('bwauth')" class="button-with-icon">
              <el-icon><iconBitwarden /></el-icon> Bitwarden Auth (.json)
            </el-button>
          </div>
        </div>

        <!-- 3. 通用格式 -->
        <div class="export-group-card">
          <div class="group-header">
            <el-icon><Document /></el-icon>
            <span>通用格式</span>
          </div>
          <div class="button-row">
            <el-button plain @click="openWarningDialog('generic_json')" class="button-with-icon">
              <el-icon><Document /></el-icon> 通用格式 (.json)
            </el-button>
            <el-button plain @click="openWarningDialog('text')" class="button-with-icon">
              <el-icon><Tickets /></el-icon> OTPAuth URI (.txt)
            </el-button>
            <el-button plain @click="openWarningDialog('csv', 'generic')" class="button-with-icon">
              <el-icon><Grid /></el-icon> 电子表格 (.csv)
            </el-button>
            <el-button plain @click="openWarningDialog('html')" class="button-with-icon">
              <el-icon><Monitor /></el-icon> 普通网页 (.html)
            </el-button>
          </div>
        </div>

      </div>
    </div>

    <!-- 加密导出密码弹窗 -->
    <el-dialog v-model="showPasswordDialog" title="设置导出密码" width="400px" destroy-on-close>
      <el-form :model="exportForm" label-position="top">
        <el-form-item label="加密密码 (至少 12 位)">
          <el-input v-model="exportForm.password" type="password" show-password placeholder="请输入高强度密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="exportForm.confirm" type="password" show-password @keyup.enter="executeExport" placeholder="请再次输入" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="isExporting" @click="executeExport">开始加密并下载</el-button>
      </template>
    </el-dialog>

    <!-- 明文导出风险提示弹窗 -->
    <el-dialog v-model="showWarningDialog" title="⚠️ 安全警告" width="400px" destroy-on-close>
      <el-alert title="风险提示" type="error" :closable="false" description="您正在导出未加密的明文数据。任何获取该文件/图片的人都可以直接访问您的账号验证码！" show-icon />
      <template #footer>
        <el-button @click="showWarningDialog = false">取消</el-button>
        <el-button type="danger" @click="executeExport" :loading="isExporting">确定导出</el-button>
      </template>
    </el-dialog>

    <!-- Google Auth 二维码弹窗 -->
    <el-dialog v-model="showGaDialog" title="迁移到 Google Authenticator" width="450px" style="text-align: center" destroy-on-close>
      <div v-if="gaQrDataUrls.length > 0">
        <p style="margin-bottom: 10px; color: var(--el-text-color-secondary);">
          打开手机上的 Google Authenticator，选择"扫描二维码"进行导入<br/>
          <span v-if="gaQrDataUrls.length > 1" style="color: var(--el-color-warning); font-weight: bold;">
            (账号较多，已分批生成，请依次扫码)
          </span>
        </p>
        <div v-loading="isExporting" style="min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <img :src="gaQrDataUrls[gaCurrentIndex]" alt="Google Auth Migration QR" style="max-width: 100%; padding: 10px; margin-bottom: 15px;" />
          
          <div v-if="gaQrDataUrls.length > 1" style="display: flex; align-items: center; gap: 15px; justify-content: center;">
            <el-button :disabled="gaCurrentIndex === 0" @click="gaCurrentIndex--" size="small">上一张</el-button>
            <span style="font-size: 14px; font-weight: bold;">{{ gaCurrentIndex + 1 }} / {{ gaQrDataUrls.length }}</span>
            <el-button :disabled="gaCurrentIndex === gaQrDataUrls.length - 1" @click="gaCurrentIndex++" size="small" type="primary">下一张</el-button>
          </div>
        </div>
      </div>
      <div v-else v-loading="isExporting" style="min-height: 200px;"></div>
      <template #footer>
        <el-button @click="showGaDialog = false">完成</el-button>
      </template>
    </el-dialog>
    <!-- 账号选择弹窗 (用于 Google Auth 选择性导出) -->
    <el-dialog v-model="showAccountSelectDialog" title="选择要导出的账号" width="450px" destroy-on-close>
      <div class="account-select-toolbar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索服务或账号..." 
          clearable 
          :prefix-icon="Search"
          style="margin-bottom: 15px;"
        />
        <div class="toolbar-actions">
          <el-checkbox 
            v-model="isAllSelected" 
            :indeterminate="isIndeterminate"
            @change="toggleSelectAll"
          >
            {{ selectAllText }}
          </el-checkbox>
          <span class="selected-count">已选: {{ selectedAccountIds.length }} / {{ fullVault.length }}</span>
        </div>
      </div>
      
      <div class="account-list-container">
        <el-checkbox-group v-model="selectedAccountIds">
          <el-scrollbar max-height="300px">
            <template v-if="filteredVault.length > 0">
              <div v-for="acc in filteredVault" :key="acc.id" class="account-item">
                <el-checkbox :label="acc.id" size="large">
                  <div class="account-item-content">
                    <span class="service-name">{{ acc.service || 'Unknown Service' }}</span>
                    <span v-if="acc.account" class="account-name">{{ acc.account }}</span>
                  </div>
                </el-checkbox>
              </div>
            </template>
            <el-empty v-else description="无匹配账号" :image-size="60" />
          </el-scrollbar>
        </el-checkbox-group>
      </div>
      
      <template #footer>
        <el-button @click="showAccountSelectDialog = false">取消</el-button>
        <el-button type="primary" :loading="isExporting" @click="executeGaExport">迁移 {{ selectedAccountIds.length }} 个账号</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { 
  Lock, Iphone, Document, Search, 
  Unlock, Tickets, Grid, Monitor 
} from '@element-plus/icons-vue'
import icon2FAS from '@/shared/components/icons/icon2FAS.vue'
import iconAegis from '@/shared/components/icons/iconAegis.vue'
import iconGoogleAuth from '@/shared/components/icons/iconGoogleAuth.vue'
import iconBitwarden from '@/shared/components/icons/iconBitwarden.vue'
import { useDataExport } from '@/features/migration/composables/useDataExport'

const {
  showPasswordDialog,
  showWarningDialog,
  showAccountSelectDialog,
  showGaDialog,
  isExporting,
  exportForm,
  loadingText,
  gaQrDataUrls,
  gaCurrentIndex,
  
  fullVault,
  searchKeyword,
  selectedAccountIds,
  filteredVault,
  
  openExportDialog,
  openWarningDialog,
  openGaDialogDirectly,
  executeExport,
  executeGaExport,
  toggleSelectAll
} = useDataExport()

// 动态计算“全选”按钮文案
const selectAllText = computed(() => {
  if (!searchKeyword.value || searchKeyword.value.trim() === '') {
    return '全选所有账号'
  } else {
    return `全选搜索出的 ${filteredVault.value.length} 个账号`
  }
})

// 计算当前过滤列表的全选状态
const isAllSelected = computed({
  get: () => {
    if (filteredVault.value.length === 0) return false
    return filteredVault.value.every(acc => selectedAccountIds.value.includes(acc.id))
  },
  set: (val) => {
    // 触发由 toggleSelectAll 在 handle change 时处理
  }
})

// 半选状态
const isIndeterminate = computed(() => {
  const selectedInFilter = filteredVault.value.filter(acc => selectedAccountIds.value.includes(acc.id)).length
  return selectedInFilter > 0 && selectedInFilter < filteredVault.value.length
})
</script>

<style scoped>
.export-groups {
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.export-group-card {
  padding: 20px;
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  flex-direction: column;
}

.group-header {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
  color: var(--el-text-color-primary);
}

.group-header .el-icon {
  margin-right: 8px;
  font-size: 18px;
  color: var(--el-color-primary);
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.button-row .el-button {
  margin-left: 0;
}

.button-with-icon {
  display: inline-flex;
  align-items: center;
}

.button-with-icon .el-icon {
  margin-right: 6px;
  font-size: 16px;
}

/* 账号选择列表样式 */
.account-select-toolbar {
  margin-bottom: 10px;
}

.toolbar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 5px;
  margin-bottom: 10px;
}

.selected-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.account-list-container {
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  padding: 5px;
}

.account-item {
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.account-item:last-child {
  border-bottom: none;
}

.account-item-content {
  display: flex;
  flex-direction: column;
  margin-left: 8px;
  line-height: 1.2;
}

.service-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.account-name {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

/* 修复由于 el-checkbox content-box 导致的文字变形 */
:deep(.el-checkbox__label) {
  display: flex;
  align-items: center;
}
</style>
