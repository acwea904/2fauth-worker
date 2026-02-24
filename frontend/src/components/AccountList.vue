<template>
  <div class="account-list-wrapper" v-loading="loading" element-loading-text="数据加载中..." style="min-height: 400px;">
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
        
        <div class="batch-actions" v-if="selectedIds.length > 0" style="display: flex; align-items: center; gap: 10px;">
          <span style="color: #606266; font-size: 14px;">已选择 {{ selectedIds.length }} 项</span>
          <el-button type="danger" plain @click="handleBulkDelete" :loading="isBulkDeleting">
            <el-icon><Delete /></el-icon> 批量删除
          </el-button>
          <el-button @click="selectedIds = []" plain>取消选择</el-button>
        </div>
        <div v-else>
          <el-button @click="selectAllVisible" plain>全选本页</el-button>
        </div>
      </div>

      <el-row :gutter="20" v-if="accounts.length > 0">
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="account in accounts" :key="account.id" style="margin-bottom: 20px;">
          <el-card class="account-card" :class="{ 'is-selected': selectedIds.includes(account.id) }" shadow="hover" @click="copyCode(account)">
            <div class="card-header">
              <div class="service-info" style="display: flex; align-items: center; gap: 10px;">
                <el-checkbox :model-value="selectedIds.includes(account.id)" @change="toggleSelection(account.id)" @click.stop />
                <h3 class="service-name">{{ account.service }}</h3>
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
            
            <p class="account-name" style="margin-left: 24px;">{{ account.account }}</p>
            
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
                    <span class="timer-text-small">{{ account.remaining || 30 }}</span>
                  </template>
                </el-progress>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <div class="pagination-wrapper" v-if="total > 0" style="margin-top: 10px; display: flex; justify-content: center;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[12, 24, 48, 96]"
          background
          :layout="layoutState.isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'"
          :small="layoutState.isMobile"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>

      <el-empty v-if="!loading && accounts.length === 0 && searchQuery" description="没有找到匹配的账号" />
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled, Edit, Delete, Picture, View, Hide, CopyDocument } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import { request } from '../utils/request'
import { layoutState } from '../states/layout'

const emit = defineEmits(['switch-tab'])

// --- 状态定义 ---
const accounts = ref([])
const loading = ref(true)
const total = ref(0)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(12)

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

// --- 核心逻辑 ---
// 获取账号列表
const fetchAccounts = async () => {
  loading.value = true
  try {
    const query = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value
    }).toString()
    
    const data = await request(`/api/accounts?${query}`)
    if (data.success) {
      accounts.value = data.accounts || []
      updateAccountsStatus() // 立即计算一次
      if (data.pagination) total.value = data.pagination.total
    }
  } catch (error) {
    console.error('Failed to fetch accounts', error)
  } finally {
    loading.value = false
  }
}

defineExpose({ fetchAccounts })

// 分页与搜索
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  fetchAccounts()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  fetchAccounts()
}

watch(searchQuery, () => {
  currentPage.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchAccounts(), 300)
})

// 批量选择
const toggleSelection = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

const selectAllVisible = () => {
  accounts.value.forEach(acc => {
    if (!selectedIds.value.includes(acc.id)) selectedIds.value.push(acc.id)
  })
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
      fetchAccounts()
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
        fetchAccounts()
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
      fetchAccounts()
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
})
</script>

<style scoped>
.account-card { border-radius: 12px; transition: all 0.3s ease; border: none; cursor: pointer; }
.account-card:hover { transform: translateY(-5px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.service-name { margin: 0 0 5px 0; font-size: 18px; color: #303133; }
.account-name { color: #909399; font-size: 14px; margin: 0 0 10px 0; word-break: break-all; }
.more-icon { cursor: pointer; color: #909399; padding: 5px; }
.more-icon:hover { color: #409EFF; }
.account-card.is-selected { border: 1px solid #409EFF; background-color: #f4f9ff; }

.code-display-area { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-left: 24px; }
.code-left { display: flex; flex-direction: column; justify-content: center; }
.current-code { font-size: 24px; font-weight: bold; color: #409EFF; letter-spacing: 2px; line-height: 1; font-family: monospace; }
.next-code { font-size: 16px; color: #909399; margin-top: 4px; font-family: monospace; }
.timer-text-small { font-size: 12px; color: #606266; font-weight: bold; display: block; text-align: center; }
:deep(.el-progress__text) { 
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: none; /* 移除默认的偏移，由 Flex 接管 */
  display: flex;
  align-items: center;
  justify-content: center;
  min-width:30px;
}

.qr-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
.qr-info { margin-bottom: 15px; }
.qr-service { margin: 0 0 5px 0; font-size: 20px; color: #303133; }
.qr-account { margin: 0; color: #909399; font-size: 14px; }
.qr-image-wrapper { margin: 10px 0; padding: 10px; background: #fff; border-radius: 8px; border: 1px solid #EBEEF5; }
.qr-code-img { display: block; width: 200px; height: 200px; }
.qr-tip { font-size: 12px; color: #606266; margin: 10px 0 20px 0; }

.secret-section { width: 100%; margin-bottom: 15px; }
.secret-box { display: flex; align-items: center; justify-content: space-between; background: #f5f7fa; padding: 10px 15px; border-radius: 6px; border: 1px solid #e4e7ed; }
.secret-text { font-family: monospace; font-size: 14px; color: #606266; letter-spacing: 1px; }
.secret-actions { display: flex; gap: 15px; }
.action-icon { cursor: pointer; font-size: 16px; color: #909399; transition: color 0.2s; }
.action-icon:hover { color: #409EFF; }
.uri-link-wrapper { margin-top: 5px; }
</style>