<template>
  <div class="vault-list-wrapper" style="min-height: 400px;">
    <div class="vault-content">
      <div class="toolbar" style="margin-bottom: 20px; display: flex; gap: 15px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
          <el-input 
            v-model="searchQuery" 
            placeholder="搜索服务名称、账号或分类..." 
            clearable 
            style="max-width: 400px;" 
          >
            <template #prefix>
              <el-icon v-if="isFetching && searchQuery" class="is-loading"><Loading /></el-icon>
              <el-icon v-else><Search /></el-icon>
            </template>
          </el-input>
        </div>
        
        <div class="batch-actions" style="display: flex; align-items: center; gap: 10px;">
          <template v-if="selectedIds.length > 0">
            <span class="batch-text">已选 {{ selectedIds.length }} 项</span>
            <el-button type="danger" plain @click="handleBulkDelete" :loading="isBulkDeleting">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
            <el-button @click="selectedIds = []" plain>取消</el-button>
          </template>
          <el-button v-else @click="selectAllLoaded" plain>全选已加载</el-button>
        </div>
      </div>

      <!-- 1. 加载状态 -->
      <div v-if="(isInitializing || isLoading || isFetching) && vault.length === 0" class="loading-state" style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 400px; color: var(--el-text-color-secondary);">

        <el-icon class="is-loading" :size="48" style="margin-bottom: 20px; color: var(--el-color-primary);"><Loading /></el-icon>
        <p style="font-size: 16px; letter-spacing: 1px;">数据获取中, 请稍候...</p>
      </div>

      <!-- 2. 空状态 (明确加载完毕 + 数据真正为空 + 无搜索) -->
      <div v-else-if="!isLoading && !isFetching && vault.length === 0 && !searchQuery" class="empty-state">
        <el-empty description="空空如也，快去添加你的第一个 2FA 账号吧！">
          <el-button type="primary" @click="$emit('switch-tab', 'add-vault-scan')">去添加账号</el-button>
        </el-empty>
      </div>

      <!-- 3. 数据列表 (已解锁) -->
      <div v-else
        class="list-container" 
        style="min-height: 200px;"
        v-infinite-scroll="handleLoadMore"
        :infinite-scroll-disabled="isLoadMoreDisabled"
        :infinite-scroll-distance="100"
      >
        <el-row :gutter="20" v-if="vault.length > 0">
          <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="vaultItem in vault" :key="vaultItem.id" style="margin-bottom: 20px;">
          <el-card class="vault-card" :class="{ 'is-selected': selectedIds.includes(vaultItem.id) }" shadow="hover">
            <div class="card-header">
              <div class="service-info">
                <el-checkbox :model-value="selectedIds.includes(vaultItem.id)" @change="toggleSelection(vaultItem.id)" @click.stop />
                <h3 class="service-name" :title="vaultItem.service">{{ vaultItem.service }}</h3>
                <el-tag size="small" v-if="vaultItem.category" effect="light">{{ vaultItem.category }}</el-tag>
              </div>
              
              <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, vaultItem)">
                <el-icon class="more-icon" @click.stop><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="qr">
                      <el-icon><Picture /></el-icon> 账号导出
                    </el-dropdown-item>
                    <el-dropdown-item command="edit">
                      <el-icon><Edit /></el-icon> 编辑账号
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" style="color: #F56C6C;">
                      <el-icon><Delete /></el-icon> 删除账号
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            
            <p class="vault-name">{{ vaultItem.account?.includes(':') ? vaultItem.account.split(':').pop() : vaultItem.account }}</p>
            
            <div class="code-display-area" @click="copyCode(vaultItem)">
              <div class="code-left">
                <div class="current-code" :data-digits="vaultItem.digits">{{ vaultItem.currentCode || '------' }}</div>
                <div class="next-code" :data-digits="vaultItem.digits" v-if="vaultItem.nextCode">
                  {{ vaultItem.nextCode }}
                </div>
              </div>
              <div class="code-right">
                <el-progress 
                  type="circle" 
                  :percentage="vaultItem.percentage || 0" 
                  :width="30" 
                  :stroke-width="3" 
                  :color="vaultItem.color || '#67C23A'"
                >
                  <template #default>
                    <span class="timer-text">{{ vaultItem.remaining || 30 }}</span>
                  </template>
                </el-progress>
              </div>
            </div>
          </el-card>
          </el-col>
        </el-row>

        <div v-if="isFetchingNextPage" style="text-align: center; padding: 20px; color: var(--el-text-color-secondary);">
          <el-icon class="is-loading"><Loading /></el-icon> 正在加载更多...
        </div>
        <div v-if="!hasNextPage && vault.length > 0" style="text-align: center; padding: 20px; color: var(--el-text-color-secondary); font-size: 12px;">
          - 到底了，没有更多账号了 -
        </div>

        <el-empty v-if="!isLoading && vault.length === 0 && searchQuery" description="没有找到匹配的账号" />
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="showEditDialog" title="✏️ 编辑账号" :width="layoutStore.isMobile ? '90%' : '400px'" destroy-on-close>
      <el-form :model="editVaultData" label-position="top">
        <el-form-item label="服务名称 (如 Google, GitHub)">
          <el-input v-model="editVaultData.service" />
        </el-form-item>
        <el-form-item label="账号标识 (如 邮箱地址)">
          <el-input v-model="editVaultData.account" />
        </el-form-item>
        <el-form-item label="分类 (可选)">
          <el-input v-model="editVaultData.category" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditDialog = false">取消</el-button>
          <el-button type="primary" :loading="isEditing" @click="submitEditVault">保存修改</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 账号导出弹窗 -->
    <el-dialog v-model="showQrDialog" title="账号导出" :width="layoutStore.isMobile ? '90%' : '350px'" center align-center destroy-on-close @closed="showSecret = false">
      <div class="qr-container" v-if="currentQrItem">
        <div class="qr-info">
          <h3 class="qr-service">{{ currentQrItem.service }}</h3>
          <p class="qr-account">{{ currentQrItem.account }}</p>
        </div>
        
        <div class="qr-image-wrapper">
          <img :src="qrCodeUrl" class="qr-code-img" />
        </div>
        
        <p class="qr-tip">使用任意 2FA 应用扫描二维码即可添加此账户</p>
        
        <div class="secret-section">
          <div class="secret-box">
            <div class="secret-text">{{ showSecret ? formatSecret(currentQrItem.secret) : '•••• •••• •••• ••••' }}</div>
            <div class="secret-actions">
              <el-icon class="action-icon" @click="showSecret = !showSecret" :title="showSecret ? '隐藏' : '显示'"><View v-if="!showSecret" /><Hide v-else /></el-icon>
              <el-icon class="action-icon" @click="copySecret" title="复制密钥"><CopyDocument /></el-icon>
            </div>
          </div>
        </div>

        <div class="uri-link-wrapper">
          <el-button link type="info" size="small" @click="copyOtpUrl">复制原始 otpauth 链接</el-button>
        </div>
      </div>
    </el-dialog>

  </div>
</template>

<script setup>
/**
 * 核心金库列表组件 (Vault List Root Component)
 * 
 * 架构说明 (Architecture Notes):
 * 1. 离线优先与秒开 (Offline-First Initialization): 
 *    `isInitializing` 状态拦截了组件初筛。生命周期 `onMounted` 时优先呼叫 `handleUnlocked` 读取
 *    `localStorage` 加密缓存 (`vaultStore.getData()`)。读取闭环后关闭 `isInitializing` 使得 
 *    UI 瞬间呈现历史数据，随后交由 Vue Query 在后台默默触发真实网络同步 (`fetchVault`) 更新状态，
 *    达到丝滑“秒开”极致体验。
 * 2. 消除瀑布流计算 (Heavy Compute Deferment): 
 *    将获取到缓存后极其冗长的 Hash 计算任务 `updateVaultStatus()` 通过 `setTimeout(..., 0)`
 *    推至浏览器的后续事件队列中，彻底让出 JavaScript 渲染主线程，保障金库大列表在手机端冷启动不白屏、不阻塞。
 * 3. 循环依赖解构 (Dependency Inversion): 
 *    鉴于获取数据的 `useVaultList` 和执行计算的 `useTotpTimer` 各自闭环又存在先后依赖，此处以
 *    `afterLoadRef` 作媒介进行延迟绑定：
 *    `useVaultList` (接收 `afterLoadRef`) -> `useTotpTimer` 实例生成 -> 绑定回调 ->
 *    下一次 Vue Query 拉回新数据时，直接调用绑定的 `updateVaultStatus` 进行后台预运算。
 */
import { ref, onMounted } from 'vue'
import { MoreFilled, Edit, Delete, Picture, View, Hide, CopyDocument, Loading, Search } from '@element-plus/icons-vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { useVaultList } from '@/features/vault/composables/useVaultList'
import { useTotpTimer } from '@/features/vault/composables/useTotpTimer'
import { useVaultActions } from '@/features/vault/composables/useVaultActions'

const emit = defineEmits(['switch-tab'])
const layoutStore = useLayoutStore()
const vaultStore = useVaultStore()

// afterLoadRef 用于解决循环依赖：useVaultList 先于 useTotpTimer 创建，
// 通过 ref 延迟绑定 updateVaultStatus，确保每次分页加载后立即刷新验证码
const afterLoadRef = ref(null)

const {
    vault, searchQuery, isLoading, isFetching, isFetchingNextPage,
    hasNextPage, isLoadMoreDisabled, fetchVault, handleLoadMore
} = useVaultList(afterLoadRef)

const { updateVaultStatus } = useTotpTimer(vault)

// 绑定数据加载后的回调（数据合并完成后立即触发 TOTP 计算，无需等待 1 秒间隔）
afterLoadRef.value = updateVaultStatus

const {
    selectedIds, isBulkDeleting,
    showEditDialog, isEditing, editVaultData,
    showQrDialog, currentQrItem, showSecret, qrCodeUrl,
    toggleSelection, selectAllLoaded, handleBulkDelete, copyCode,
    submitEditVault, openQrDialog, copySecret, copyOtpUrl,
    formatSecret, handleCommand,
} = useVaultActions(fetchVault, vault)

// mount 到 handleUnlocked 完成前保持 true，确保本地缓存读取期间显示 loading 动画
const isInitializing = ref(true)

// --- 解锁回调：离线优先，秒开首屏 ---
const handleUnlocked = async () => {
    try {
        if (vaultStore.isDirty) return
        const vaultData = await vaultStore.getData()
        if (vaultData && vaultData.vault) {
            vault.value = vaultData.vault
            // 把耗时 TOTP 计算推进异步，让出关键渲染主线程
            setTimeout(() => updateVaultStatus(), 0)
        }
    } finally {
        isInitializing.value = false
    }
}

// 暴露给父组件的刷新方法（保持接口兼容）
defineExpose({ fetchVault })

onMounted(handleUnlocked)
</script>

