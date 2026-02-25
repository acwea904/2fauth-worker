<template>
  <div class="account-list-wrapper" style="min-height: 400px;">
    <div v-if="!loading && accounts.length === 0 && !searchQuery" class="empty-state">
      <el-empty description="空空如也，快去添加你的第一个 2FA 账号吧！">
        <el-button type="primary" @click="$emit('switch-tab', 'add-account')">去添加账号</el-button>
      </el-empty>
    </div>

    <div v-else>
      <div class="toolbar" style="margin-bottom: 20px; display: flex; gap: 15px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
        <el-input 
          v-model="searchQuery" 
          placeholder="🔍 搜索服务名称、账号或分类..." 
          clearable 
          style="max-width: 400px; flex: 1;" 
        />
        
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

      <div 
        class="list-container" 
        style="min-height: 200px;"
        v-infinite-scroll="loadMore"
        :infinite-scroll-disabled="disabled"
        :infinite-scroll-distance="100"
      >
        <el-row :gutter="20" v-if="accounts.length > 0">
          <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="account in accounts" :key="account.id" style="margin-bottom: 20px;">
          <el-card class="account-card" :class="{ 'is-selected': selectedIds.includes(account.id) }" shadow="hover" @click="copyCode(account)">
            <div class="card-header">
              <div class="service-info">
                <el-checkbox :model-value="selectedIds.includes(account.id)" @change="toggleSelection(account.id)" @click.stop />
                <h3 class="service-name" :title="account.service">{{ account.service }}</h3>
                <el-tag size="small" v-if="account.category" effect="light">{{ account.category }}</el-tag>
              </div>
              
              <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, account)">
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
            
            <p class="account-name">{{ account.account }}</p>
            
            <div class="code-display-area">
              <div class="code-left">
                <div class="current-code">{{ account.currentCode || '------' }}</div>
                <div class="next-code" v-if="account.nextCode">
                  {{ account.nextCode }}
                </div>
              </div>
              <div class="code-right">
                <el-progress 
                  type="circle" 
                  :percentage="account.percentage || 0" 
                  :width="30" 
                  :stroke-width="3" 
                  :color="account.color || '#67C23A'"
                >
                  <template #default>
                    <span class="timer-text">{{ account.remaining || 30 }}</span>
                  </template>
                </el-progress>
              </div>
            </div>
          </el-card>
          </el-col>
        </el-row>

        <div v-if="loadingMore" style="text-align: center; padding: 20px; color: var(--el-text-color-secondary);">
          <el-icon class="is-loading"><Loading /></el-icon> 正在加载更多...
        </div>
        <div v-if="noMore && accounts.length > 0" style="text-align: center; padding: 20px; color: var(--el-text-color-secondary); font-size: 12px;">
          - 到底了，没有更多账号了 -
        </div>

        <el-empty v-if="!loading && accounts.length === 0 && searchQuery" description="没有找到匹配的账号" />
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="showEditDialog" title="✏️ 编辑账号" :width="layoutState.isMobile ? '90%' : '400px'" destroy-on-close>
      <el-form :model="editAccountData" label-position="top">
        <el-form-item label="服务名称 (如 Google, GitHub)">
          <el-input v-model="editAccountData.service" />
        </el-form-item>
        <el-form-item label="账号标识 (如 邮箱地址)">
          <el-input v-model="editAccountData.account" />
        </el-form-item>
        <el-form-item label="分类 (可选)">
          <el-input v-model="editAccountData.category" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditDialog = false">取消</el-button>
          <el-button type="primary" :loading="isEditing" @click="submitEditAccount">保存修改</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 账号导出弹窗 -->
    <el-dialog v-model="showQrDialog" title="账号导出" :width="layoutState.isMobile ? '90%' : '350px'" center align-center destroy-on-close @closed="showSecret = false">
      <div class="qr-container" v-if="currentQrAccount">
        <div class="qr-info">
          <h3 class="qr-service">{{ currentQrAccount.service }}</h3>
          <p class="qr-account">{{ currentQrAccount.account }}</p>
        </div>
        
        <div class="qr-image-wrapper">
          <img :src="qrCodeUrl" class="qr-code-img" />
        </div>
        
        <p class="qr-tip">使用任意 2FA 应用扫描二维码即可添加此账户</p>
        
        <div class="secret-section">
          <div class="secret-box">
            <div class="secret-text">{{ showSecret ? formatSecret(currentQrAccount.secret) : '•••• •••• •••• ••••' }}</div>
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled, Edit, Delete, Picture, View, Hide, CopyDocument, Loading } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import { request } from '../utils/request'
import { layoutState } from '../states/layout'

const emit = defineEmits(['switch-tab'])

// --- 状态定义 ---
const accounts = ref([])
const allFetchedAccounts = ref([]) // 新增：用于存储所有已获取的数据（缓存+网络）
const loading = ref(true)
const loadingMore = ref(false)
const total = ref(0)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const isOfflineMode = ref(false)

// --- 批量操作 ---
const selectedIds = ref([])
const isBulkDeleting = ref(false)

// --- 弹窗状态 ---
const showEditDialog = ref(false)
const isEditing = ref(false)
const editAccountData = ref({ id: '', service: '', account: '', category: '' })

const showQrDialog = ref(false)
const currentQrAccount = ref(null)
const showSecret = ref(false)
const qrCodeUrl = ref('')

let globalTimer = null
let loadingMessageHandle = null
let loadingTimer = null

// --- 工具函数 ---
// TOTP 算法 (Web Crypto API)
const base32ToBytes = (str) => {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let index = 0
  const buffer = new Uint8Array(Math.ceil(str.length * 5 / 8))
  for (let i = 0; i < str.length; i++) {
    const val = base32chars.indexOf(str[i].toUpperCase())
    if (val === -1) continue
    value = (value << 5) | val
    bits += 5
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 0xFF
      bits -= 8
    }
  }
  return buffer.slice(0, index)
}

const generateTOTP = async (secret, period, digits, offset = 0) => {
  if (!secret) return '------'
  try {
    const now = Date.now() / 1000
    const epoch = Math.floor(now / period) + offset
    const timeBuffer = new ArrayBuffer(8)
    const view = new DataView(timeBuffer)
    view.setBigUint64(0, BigInt(epoch), false)

    const keyBytes = base32ToBytes(secret)
    const key = await window.crypto.subtle.importKey(
      'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    )
    const signature = await window.crypto.subtle.sign('HMAC', key, timeBuffer)
    
    const sigView = new DataView(signature)
    const offsetByte = sigView.getUint8(19) & 0xf
    const binary = ((sigView.getUint8(offsetByte) & 0x7f) << 24) |
                   ((sigView.getUint8(offsetByte + 1) & 0xff) << 16) |
                   ((sigView.getUint8(offsetByte + 2) & 0xff) << 8) |
                   (sigView.getUint8(offsetByte + 3) & 0xff)
    
    const otp = binary % Math.pow(10, digits)
    return otp.toString().padStart(digits, '0')
  } catch (e) { return 'ERROR' }
}

let searchTimer = null

// 计算属性：是否禁用无限滚动
const noMore = computed(() => accounts.value.length >= total.value && total.value > 0)
const disabled = computed(() => loading.value || loadingMore.value || noMore.value)

// --- Loading 提示控制 ---
const showTopLoading = () => {
  // 防抖：如果已经在显示或正在等待显示，则不重复触发
  if (loadingMessageHandle || loadingTimer) return

  loadingMessageHandle = ElMessage({
    message: '数据正在加载...',
    icon: Loading,
    duration: 0, // 设为 0 则不会自动关闭
    type: 'info',
    grouping: true
  })
}

const hideTopLoading = () => {
  if (loadingTimer) clearTimeout(loadingTimer) // 清除等待中的 Loading
  loadingTimer = null

  if (loadingMessageHandle) {
    loadingMessageHandle.close()
    loadingMessageHandle = null
  }
}

// --- 核心逻辑 ---
// 获取账号列表
const fetchAccounts = async (append = false, useCache = true) => {
  // 如果不是追加模式（即刷新或搜索），重置页码
  if (!append) {
    currentPage.value = 1
  }
  if (!append) showTopLoading()

  const isInitLoad = !append && currentPage.value === 1
  const isNoSearch = !searchQuery.value
  let loadedFromCache = false
  
  // 本次请求的 limit (默认 pageSize，但如果是恢复缓存，则请求缓存的大小)
  let requestLimit = pageSize.value
  let requestPage = currentPage.value

  // 1. 离线优先策略：仅在初始化且无搜索时，尝试加载本地缓存
  if (useCache && isInitLoad && isNoSearch) {
    const cachedData = localStorage.getItem('cached_accounts')
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData)
        allFetchedAccounts.value = parsed.accounts || []
        if (parsed.pagination) total.value = parsed.pagination.total
        
        // 【性能优化关键点】
        // 即使缓存有 350 条，初始只渲染 pageSize (12条)，避免卡死
        accounts.value = allFetchedAccounts.value.slice(0, pageSize.value)
        
        // 后台仍然请求所有缓存的数据量，以保持数据新鲜度
        if (allFetchedAccounts.value.length > pageSize.value) {
          requestLimit = allFetchedAccounts.value.length
          // 修正 currentPage，以便后续网络请求能接上
          currentPage.value = Math.ceil(allFetchedAccounts.value.length / pageSize.value)
        }
        
        updateAccountsStatus() // 立即开始倒计时
        loadedFromCache = true
      } catch (e) { console.error('Cache load failed', e) }
    }
  }
  
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const query = new URLSearchParams({
      page: requestPage,
      limit: requestLimit,
      search: searchQuery.value
    }).toString()
    
    const data = await request(`/api/accounts?${query}`)
    if (data.success) {
      const newAccounts = data.accounts || []
      
      if (append) {
        // 追加模式：去重后添加到列表
        const existingIds = new Set(allFetchedAccounts.value.map(a => a.id))
        const uniqueNewAccounts = newAccounts.filter(a => !existingIds.has(a.id))
        allFetchedAccounts.value.push(...uniqueNewAccounts)
        // 同时追加到显示列表（因为用户正在滚动加载）
        accounts.value.push(...uniqueNewAccounts)
      } else {
        // 覆盖模式 (刷新/搜索/初始化)
        allFetchedAccounts.value = newAccounts
        // 更新显示列表：保持当前已渲染的数量，或者重置为 pageSize
        // 如果是初始化加载（tab切换回来），重置为 pageSize 以保证速度
        // 如果是搜索，也重置。
        const countToRender = isInitLoad ? pageSize.value : Math.max(accounts.value.length, pageSize.value)
        accounts.value = allFetchedAccounts.value.slice(0, countToRender)
      }
      
      if (data.pagination) total.value = data.pagination.total
      isOfflineMode.value = false
      updateAccountsStatus() // 立即计算一次
      
      // 2. 实时缓存：保存完整的内存数据
      if (isNoSearch) {
        const cacheData = {
          accounts: allFetchedAccounts.value,
          pagination: { total: total.value }
        }
        localStorage.setItem('cached_accounts', JSON.stringify(cacheData))
      }
    }
  } catch (error) {
    console.error('Failed to fetch accounts', error)
    // 3. 网络请求失败：如果是离线状态且已有缓存，则不报错
    if (!navigator.onLine || error.message.includes('Failed to fetch')) {
      isOfflineMode.value = true
      if (accounts.value.length > 0) {
        if (!loadedFromCache) ElMessage.warning('网络不可用，正在使用离线数据')
        return
      }
    }
  } finally {
    loading.value = false
    loadingMore.value = false
    if (!append) hideTopLoading()
  }
}

defineExpose({ fetchAccounts })

// 滚动加载更多
const loadMore = () => {
  if (disabled.value) return
  
  // 1. 优先从内存加载 (分批渲染)
  if (accounts.value.length < allFetchedAccounts.value.length) {
    // 为了展示 Loading 效果，人为增加一点延迟 (300ms)，提升交互感知
    loadingMore.value = true
    setTimeout(() => {
      const currentLen = accounts.value.length
      const nextBatch = allFetchedAccounts.value.slice(currentLen, currentLen + pageSize.value)
      accounts.value.push(...nextBatch)
      updateAccountsStatus() // 立即为新渲染的卡片计算验证码
      loadingMore.value = false
    }, 300)
  } else {
    // 2. 内存数据已全部显示，才请求服务器
    currentPage.value++
    fetchAccounts(true) // true 表示追加模式
  }
}

watch(searchQuery, () => {
  showTopLoading()
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchAccounts(), 300)
})

// 批量选择
const toggleSelection = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

const selectAllLoaded = () => {
  // 全选当前已加载的所有账号
  selectedIds.value = accounts.value.map(acc => acc.id)
}

// 批量删除
const handleBulkDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 个账号吗？`, '警告', { type: 'error' })
    isBulkDeleting.value = true
    const data = await request('/api/accounts/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedIds.value })
    })
    if (data.success) {
      ElMessage.success(`成功删除了 ${data.count} 个账号`)
      selectedIds.value = []
      fetchAccounts(false, false) // 删除后不使用缓存，防止已删数据闪现
    }
  } catch (e) {} finally { isBulkDeleting.value = false }
}

// 单个账号操作 (删除/编辑/导出)
const handleCommand = async (command, account) => {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除 [${account.service}] 吗？`, '警告', { type: 'error' })
      const data = await request(`/api/accounts/${account.id}`, { method: 'DELETE' })
      if (data.success) {
        ElMessage.success('账号已删除')
        fetchAccounts(false, false) // 删除后不使用缓存
      }
    } catch (e) {}
  } else if (command === 'edit') {
    editAccountData.value = { ...account, category: account.category || '' }
    showEditDialog.value = true
  } else if (command === 'qr') {
    currentQrAccount.value = account
    try {
      const uri = getOtpAuthUrl(account)
      qrCodeUrl.value = await QRCode.toDataURL(uri, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      showQrDialog.value = true
    } catch (e) {
      console.error(e)
      ElMessage.error('二维码生成失败')
    }
  }
}

// 提交编辑
const submitEditAccount = async () => {
  if (!editAccountData.value.service || !editAccountData.value.account) return ElMessage.warning('必填项不能为空')
  isEditing.value = true
  try {
    const data = await request(`/api/accounts/${editAccountData.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        service: editAccountData.value.service,
        account: editAccountData.value.account,
        category: editAccountData.value.category
      })
    })
    if (data.success) {
      ElMessage.success('账号修改成功')
      showEditDialog.value = false
      fetchAccounts(false, false) // 编辑后也不使用缓存，确保显示最新信息
    }
  } catch (e) {} finally { isEditing.value = false }
}

// --- 定时更新 ---
// 更新倒计时与验证码
const updateAccountsStatus = async () => {
  const now = Date.now() / 1000
  for (const acc of accounts.value) {
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
    if (acc.lastEpoch !== currentEpoch || !acc.currentCode) {
       acc.currentCode = await generateTOTP(acc.secret, period, acc.digits)
       acc.lastEpoch = currentEpoch
    }
    
    // 剩余5秒时计算下一个验证码
    if (remaining <= 5) {
       if (!acc.nextCode || acc.lastNextEpoch !== currentEpoch + 1) {
           acc.nextCode = await generateTOTP(acc.secret, period, acc.digits, 1)
           acc.lastNextEpoch = currentEpoch + 1
       }
    } else {
       acc.nextCode = null
    }
  }
}

// --- 辅助功能 ---
const copyCode = async (account) => {
  const code = (account.remaining <= 5 && account.nextCode) ? account.nextCode : account.currentCode
  if (!code || code === '------') return
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success('验证码已复制')
  } catch (e) {}
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
  const url = getOtpAuthUrl(currentQrAccount.value)
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('otpauth已复制')
  } catch (e) {}
}

const formatSecret = (secret) => {
  return secret ? secret.replace(/(.{4})/g, '$1 ').trim() : ''
}

const copySecret = async () => {
  if (!currentQrAccount.value?.secret) return
  try {
    await navigator.clipboard.writeText(currentQrAccount.value.secret)
    ElMessage.success('密钥已复制')
  } catch (e) {}
}

onMounted(() => {
  fetchAccounts()
  globalTimer = setInterval(updateAccountsStatus, 1000)
})

onUnmounted(() => {
  if (globalTimer) clearInterval(globalTimer)
  if (searchTimer) clearTimeout(searchTimer)
  hideTopLoading()
})
</script>

