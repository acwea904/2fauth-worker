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

      <!-- 1. 加载状态 (本地缓存尚未挂载，或者正在首次/后台请求时但无数据) -->
      <div v-if="(isLoading || isFetching) && vault.length === 0" class="loading-state" style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 400px; color: var(--el-text-color-secondary);">
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
          <el-card class="vault-card" :class="{ 'is-selected': selectedIds.includes(vaultItem.id) }" shadow="hover" @click="copyCode(vaultItem)">
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
            
            <p class="vault-name">{{ vaultItem.account }}</p>
            
            <div class="code-display-area">
              <div class="code-left">
                <div class="current-code">{{ vaultItem.currentCode || '------' }}</div>
                <div class="next-code" v-if="vaultItem.nextCode">
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
import { ref, shallowRef, onMounted, onUnmounted, watch, computed, defineAsyncComponent, nextTick, triggerRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled, Edit, Delete, Picture, View, Hide, CopyDocument, Loading, Search } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import { request } from '@/shared/utils/request'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { generateTOTP } from '@/shared/utils/totp'
import { copyToClipboard } from '@/shared/utils/common'

const emit = defineEmits(['switch-tab'])
const queryClient = useQueryClient()
const vaultStore = useVaultStore()
const layoutStore = useLayoutStore()

// --- 状态定义 ---
const vault = shallowRef([])
const searchQuery = ref('')
const pageSize = ref(12)

// --- 批量操作 ---
const selectedIds = ref([])
const isBulkDeleting = ref(false)

// --- 弹窗状态 ---
const showEditDialog = ref(false)
const isEditing = ref(false)
const editVaultData = ref({ id: '', service: '', account: '', category: '' })

const showQrDialog = ref(false)
const currentQrItem = ref(null)
const showSecret = ref(false)
const qrCodeUrl = ref('')

let globalTimer = null

// --- 定时更新 (提升定义顺序) ---
// 更新倒计时与验证码
const updateVaultStatus = async (targetList) => {
  // 支持传入特定列表进行预计算（用于渲染前），如果不传则默认更新当前显示的 vault
  const list = Array.isArray(targetList) ? targetList : vault.value
  if (!list || list.length === 0) return

  const now = Date.now() / 1000
  
  // 关键修复：使用 Promise.all 并行处理所有账号的计算，避免列表较长时串行 await 导致验证码生成延迟或卡顿
  await Promise.all(list.map(async (acc) => {
    const period = acc.period || 30
    const remaining = Math.ceil(period - (now % period))
    acc.remaining = remaining
    acc.percentage = (remaining / period) * 100
    
    // 颜色逻辑
    if (remaining > 10) acc.color = '#67C23A'
    else if (remaining > 5) acc.color = '#E6A23C'
    else acc.color = '#F56C6C'

    // 计算当前验证码 (如果 epoch 变了或者还没计算)
    const currentEpoch = Math.floor(now / period)
    const algorithm = acc.algorithm ? acc.algorithm.replace('SHA', 'SHA-').replace('SHA--', 'SHA-') : 'SHA-1'
    if (acc.lastEpoch !== currentEpoch || !acc.currentCode || acc.currentCode === '------') {
       acc.currentCode = await generateTOTP(acc.secret, period, acc.digits, algorithm)
       acc.lastEpoch = currentEpoch
    }
    
    // 剩余5秒时计算下一个验证码
    if (remaining <= 5) {
       if (!acc.nextCode || acc.lastNextEpoch !== currentEpoch + 1) {
           acc.nextCode = await generateTOTP(acc.secret, period, acc.digits, algorithm, 1)
           acc.lastNextEpoch = currentEpoch + 1
       }
    } else {
       acc.nextCode = null
    }
  }))

  // 关键优化：因为 vault 是 shallowRef，必须在每轮更新完毕后执行一次通知
  // 从而使得 1000 次深层属性变更合并成 1 次 UI 组件挂载重绘
  if (list === vault.value) {
    triggerRef(vault)
  }
}

// --- 工具函数 ---
let searchTimer = null

// --- Vue Query 集成 ---

// 1. 定义数据获取函数
const fetchVaultPage = async ({ pageParam = 1 }) => {
  // 如果未解锁，直接返回空
  if (!vaultStore.isUnlocked) return { vault: [], pagination: { totalPages: 0 } }

  const query = new URLSearchParams({
    page: pageParam,
    limit: pageSize.value,
    search: searchQuery.value
  }).toString()
    
  return await request(`/api/vault?${query}`)
}

// 2. 使用 useInfiniteQuery
const { 
  data, 
  fetchNextPage, 
  hasNextPage, 
  isFetchingNextPage, 
  isLoading, 
  isFetching,
  isError,
  refetch 
} = useInfiniteQuery({
  queryKey: ['vault', searchQuery], // 搜索词变化自动触发重载
  queryFn: fetchVaultPage,
  getNextPageParam: (lastPage) => {
    if (!lastPage || !lastPage.pagination) return undefined
    const { page, totalPages } = lastPage.pagination
    return page < totalPages ? page + 1 : undefined
  },
  enabled: computed(() => vaultStore.isUnlocked), // 仅在解锁后启用查询
  staleTime: 0, // 始终视为过期，确保 invalidateQueries 能立即触发重新请求
})

// 3. 监听数据变化，同步到本地 vault 引用和保险箱
watch(data, async (newData) => {
  if (!newData) return

  // 展平分页数据
  const flatVault = newData.pages.flatMap(page => page.vault || [])
  
  // 智能合并：保留现有的 TOTP 计算状态 (currentCode, remaining 等)，仅更新静态字段
  // 这样可以避免每次 fetch 导致倒计时重置
  const merged = flatVault.map(newAcc => {
    const existing = vault.value.find(a => a.id === newAcc.id)
    if (existing) {
      return { ...existing, ...newAcc }
    }
    // Initialize new vault with all reactive properties to ensure Vue tracks them
    return {
      ...newAcc,
      currentCode: '------',
      nextCode: null,
      remaining: 30,
      percentage: 0,
      color: ''
    }
  })

  // 1. Pre-calculate codes before assigning to the reactive ref
  await updateVaultStatus(merged)
  
  // 2. Update the view
  vault.value = merged
  
  // 3. Force trigger reactivity as a safeguard against missed updates
  triggerRef(vault)

  // 4. 加密保存到保险箱 (仅在无搜索词时保存，作为全量缓存)
  if (!searchQuery.value && vaultStore.isUnlocked) {
    try {
      await vaultStore.saveData({ vault: merged })
      vaultStore.clearDirty() // 此次获取的是最新数据，清除 dirty 标记
    } catch (e) {
      // Silently fail, or add more robust error handling if needed
    }
  }
})

// 5. 解锁回调
const handleUnlocked = async () => {
  // 若有未保存的变更，跳过旧缓存，直接等待服务器数据
  if (vaultStore.isDirty) return

  // 1. 优先加载离线数据，实现秒开 (移除耗时的 await updateVaultStatus 控制权)
  const vaultData = await vaultStore.getData()
  if (vaultData && vaultData.vault) {
    vault.value = vaultData.vault
    triggerRef(vault) // 瞬间触发 UI 大列表首屏渲染 (携带缓存旧状态)
    
    // 把耗时的 200次+ HMACS Hash 计算扔进异步宏任务/微任务中，让出关键渲染主线程
    setTimeout(() => updateVaultStatus(), 0)
  }
  
  // 2. Vue Query 的 enabled 变为 true，会自动触发网络请求更新数据
}

// 6. 滚动加载处理
const isLoadMoreDisabled = computed(() => {
  return isLoading.value || isFetchingNextPage.value || !hasNextPage.value || !vaultStore.isUnlocked || isError.value
})

const handleLoadMore = () => {
  if (!isLoadMoreDisabled.value) {
    fetchNextPage()
  }
}

// 暴露给父组件的方法 (保持兼容性)
defineExpose({ 
  fetchVault: () => queryClient.invalidateQueries({ queryKey: ['vault'] })
})

watch(searchQuery, () => {
  // Vue Query 会自动处理列表更新
})

// 批量选择
const toggleSelection = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

const selectAllLoaded = () => {
  // 全选当前已加载的所有账号
  selectedIds.value = vault.value.map(acc => acc.id)
}

// 批量删除
const handleBulkDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 个账号吗？`, '警告', { type: 'error' })
    isBulkDeleting.value = true
    const res = await request('/api/vault/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedIds.value })
    })
    if (res.success) {
      ElMessage.success(`成功删除了 ${res.count} 个账号`)
      selectedIds.value = []
      vaultStore.markDirty()
      queryClient.invalidateQueries({ queryKey: ['vault'] }) // 强制过期，绕过 staleTime
    }
  } catch (e) {} finally { isBulkDeleting.value = false }
}

// 单个账号操作 (删除/编辑/导出)
const handleCommand = async (command, item) => {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除 [${item.service}] 吗？`, '警告', { type: 'error' })
      const data = await request(`/api/vault/${item.id}`, { method: 'DELETE' })
      if (data.success) {
        ElMessage.success('账号已删除')
        vaultStore.markDirty()
        queryClient.invalidateQueries({ queryKey: ['vault'] }) // 强制过期，绕过 staleTime
      }
    } catch (e) {}
  } else if (command === 'edit') {
    editVaultData.value = { ...item, category: item.category || '' }
    showEditDialog.value = true
  } else if (command === 'qr') {
    currentQrItem.value = item
    try {
      const uri = getOtpAuthUrl(item)
      qrCodeUrl.value = await QRCode.toDataURL(uri, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      showQrDialog.value = true
    } catch (e) {
      ElMessage.error('二维码生成失败')
    }
  }
}

// 提交编辑
const submitEditVault = async () => {
  if (!editVaultData.value.service || !editVaultData.value.account) return ElMessage.warning('必填项不能为空')
  isEditing.value = true
  try {
    const data = await request(`/api/vault/${editVaultData.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        service: editVaultData.value.service,
        account: editVaultData.value.account,
        category: editVaultData.value.category
      })
    })
    if (data.success) {
      ElMessage.success('账号修改成功')
      showEditDialog.value = false
      vaultStore.markDirty()
      queryClient.invalidateQueries({ queryKey: ['vault'] }) // 强制过期，绕过 staleTime
    }
  } catch (e) {} finally { isEditing.value = false }
}

// --- 辅助功能 ---
const copyCode = async (item) => {
  const code = (item.remaining <= 5 && item.nextCode) ? item.nextCode : item.currentCode
  if (!code || code === '------') return
  copyToClipboard(code, '验证码已复制')
}

const getOtpAuthUrl = (acc) => {
  if (!acc) return ''
  const label = encodeURIComponent(`${acc.service}:${acc.account}`)
  const params = new URLSearchParams()
  params.set('secret', acc.secret)
  params.set('issuer', acc.service)
  if (acc.algorithm) params.set('algorithm', acc.algorithm)
  if (acc.digits) params.set('digits', acc.digits)
  if (acc.period) params.set('period', acc.period)
  return `otpauth://totp/${label}?${params.toString()}`
}

const copyOtpUrl = async () => {
  const url = getOtpAuthUrl(currentQrItem.value)
  copyToClipboard(url, 'otpauth已复制')
}

const formatSecret = (secret) => {
  return secret ? secret.replace(/(.{4})/g, '$1 ').trim() : ''
}

const copySecret = async () => {
  if (!currentQrItem.value?.secret) return
  copyToClipboard(currentQrItem.value.secret, '密钥已复制')
}

onMounted(() => {
  // 组件加载即尝试读取本地离线数据
  handleUnlocked()
  globalTimer = setInterval(updateVaultStatus, 1000)
})

onUnmounted(() => {
  if (globalTimer) clearInterval(globalTimer)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>
