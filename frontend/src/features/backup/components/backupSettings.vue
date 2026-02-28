<template>
  <div class="backup-container">
    <!-- 顶部操作 -->
    <div class="header-actions">
      <h3>云端备份管理</h3>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon> 添加备份源
      </el-button>
    </div>

    <!-- 全局加载状态 -->
    <div v-if="isLoading && providers.length === 0" class="loading-state" style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 200px; color: var(--el-text-color-secondary);">
      <el-icon class="is-loading" :size="48" style="margin-bottom: 20px; color: var(--el-color-primary);"><Loading /></el-icon>
      <p style="font-size: 16px; letter-spacing: 1px;">备份源获取中, 请稍候...</p>
    </div>

    <!-- 列表区域 (有数据情况) -->
    <el-row v-else-if="providers.length > 0" :gutter="20">
      <el-col :xs="24" :sm="12" :md="8" v-for="provider in providers" :key="provider.id" style="margin-bottom: 20px;">
        <el-card shadow="hover" class="provider-card">
          <template #header>
            <div class="card-header">
              <div class="provider-info">
                <div class="provider-title">
                  <el-tag size="small" effect="dark" :type="getProviderTypeTag(provider.type)">{{ provider.type.toUpperCase() }}</el-tag>
                  <span class="provider-name">{{ provider.name }}</span>
                  <el-tooltip v-if="provider.auto_backup" content="自动备份已开启" placement="top">
                    <el-icon color="#67C23A" size="16" style="cursor: help"><Timer /></el-icon>
                  </el-tooltip>
                </div>
              </div>
              <div class="provider-actions">
                <el-button link type="primary" @click="editProvider(provider)"><el-icon><Edit /></el-icon></el-button>
                <el-button link type="danger" @click="deleteProvider(provider)"><el-icon><Delete /></el-icon></el-button>
              </div>
            </div>
          </template>
          
          <div class="card-content">
            <p class="status-text">
              上次备份: 
              <span v-if="provider.lastBackupAt">{{ new Date(provider.lastBackupAt).toLocaleString() }}</span>
              <span v-else>从未</span>
              <el-tag v-if="provider.lastBackupStatus" size="small" :type="provider.lastBackupStatus === 'success' ? 'success' : 'danger'" style="margin-left: 5px;">
                {{ provider.lastBackupStatus }}
              </el-tag>
            </p>
            
            <div class="action-buttons">
              <el-button type="success" plain size="small" @click="openBackupDialog(provider)">立即备份</el-button>
              <el-button type="warning" plain size="small" @click="openRestoreDialog(provider)">恢复数据</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
      
    </el-row>

    <!-- 空状态 -->
    <div v-else class="empty-state" style="margin-top: 40px;">
      <el-empty description="暂无备份源，请点击右上角添加" />
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="showConfigDialog" :title="isEditing ? '编辑备份源' : '添加备份源'" :width="layoutStore.isMobile ? '90%' : '500px'" destroy-on-close>
      <el-form :model="form" label-position="top" ref="formRef">
        <el-form-item label="类型">
          <el-select v-model="form.type" :disabled="isEditing">
            <el-option label="WebDAV" value="webdav" />
            <el-option label="S3 对象存储" value="s3" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称 (别名)">
          <el-input v-model="form.name" placeholder="例如: OpenList" />
        </el-form-item>
        
        <!-- WebDAV 配置 -->
        <template v-if="form.type === 'webdav'">
          <el-form-item label="WebDAV 地址">
            <el-input v-model="form.config.url" placeholder="https://pan.example.com/dav/" />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="form.config.username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.config.password" type="password" show-password />
          </el-form-item>
          <el-form-item label="保存目录">
            <el-input v-model="form.config.saveDir" placeholder="/2fauth-backups" />
          </el-form-item>
        </template>

        <!-- S3 配置 -->
        <template v-if="form.type === 's3'">
          <el-form-item label="Endpoint (API 地址)">
            <el-input v-model="form.config.endpoint" placeholder="https://<account>.r2.cloudflarestorage.com" />
          </el-form-item>
          <el-form-item label="Bucket (存储桶名称)">
            <el-input v-model="form.config.bucket" placeholder="my-backup-bucket" />
          </el-form-item>
          <el-form-item label="Region (区域)">
            <el-input v-model="form.config.region" placeholder="auto 或 us-east-1" />
          </el-form-item>
          <el-form-item label="Access Key ID">
            <el-input v-model="form.config.accessKeyId" />
          </el-form-item>
          <el-form-item label="Secret Access Key">
            <el-input v-model="form.config.secretAccessKey" type="password" show-password />
          </el-form-item>
          <el-form-item label="存储路径前缀 (可选)">
            <el-input v-model="form.config.saveDir" placeholder="backups/" />
          </el-form-item>
        </template>

        <el-divider content-position="left">自动备份配置</el-divider>
        <el-form-item label="自动备份">
          <el-switch v-model="form.autoBackup" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="加密密码" v-if="form.autoBackup">
          <div v-if="isEditing && hasExistingAutoPwd" style="margin-bottom: 15px; width: 100%;">
            <el-radio-group v-model="configUseExistingAutoPwd">
              <el-radio :label="true">保持原密码不变</el-radio>
              <el-radio :label="false">设置新密码</el-radio>
            </el-radio-group>
          </div>
          <div v-if="!(isEditing && hasExistingAutoPwd && configUseExistingAutoPwd)" style="width: 100%;">
            <el-input v-model="form.autoBackupPassword" type="password" show-password placeholder="输入加密密码" />
            <div class="form-tip"><span style="color: #F56C6C;">*</span> 必填项，长度必须 &ge; 12 位。</div>
          </div>
          <div v-else class="success-tip">
            <el-icon><CircleCheck /></el-icon><span>系统将继续使用原有的自动备份密码。</span>
          </div>
        </el-form-item>
        <el-form-item label="保留最近份数" v-if="form.autoBackup">
          <el-input-number v-model="form.autoBackupRetain" :min="0" :max="999" label="保留分数"></el-input-number>
          <div class="form-tip" style="width: 100%">填 0 表示不对历史备份做任何限制与清理</div>
        </el-form-item>

      </el-form>
      <template #footer>
        <el-button @click="testConnection" :loading="isTesting">测试连接</el-button>
        <el-button type="primary" @click="saveProvider" :loading="isSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 备份弹窗 -->
    <el-dialog v-model="showBackupDialog" title="加密备份" :width="layoutStore.isMobile ? '90%' : '400px'">
      <el-alert title="数据安全" type="info" description="请输入加密密码用于保护备份文件。" show-icon :closable="false" style="margin-bottom: 20px;" />
      
      <div v-if="currentActionProvider?.auto_backup" style="margin-bottom: 15px;">
        <el-radio-group v-model="useAutoPassword">
          <el-radio :label="true">使用自动备份密码</el-radio>
          <el-radio :label="false">使用新密码</el-radio>
        </el-radio-group>
      </div>

      <el-input v-if="!currentActionProvider?.auto_backup || !useAutoPassword" v-model="backupPassword" type="password" show-password placeholder="输入自定义加密密码 (至少12位)" />

      <template #footer>
        <el-button @click="showBackupDialog = false">取消</el-button>
        <el-button type="primary" @click="handleBackup" :loading="isBackingUp">开始备份</el-button>
      </template>
    </el-dialog>

    <!-- 恢复列表弹窗 -->
    <el-dialog v-model="showRestoreListDialog" title="选择备份文件恢复" :width="layoutStore.isMobile ? '95%' : '600px'">
      <el-table :data="backupFiles" v-loading="isLoadingFiles" height="300px" style="width: 100%">
        <el-table-column prop="filename" label="文件名" show-overflow-tooltip />
        <el-table-column label="大小" width="100">
          <template #default="scope">
            {{ formatSize(scope.row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastModified" label="时间" width="180" />
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button link type="primary" @click="selectRestoreFile(scope.row)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 恢复确认弹窗 -->
    <el-dialog v-model="showRestoreConfirmDialog" title="解密恢复" :width="layoutStore.isMobile ? '90%' : '400px'">
      <el-alert title="警告" type="warning" description="恢复操作将覆盖当前所有数据！" show-icon :closable="false" style="margin-bottom: 15px;" />
      <el-input v-model="restorePassword" type="password" show-password placeholder="输入备份时的加密密码" />
      <template #footer>
        <el-button @click="showRestoreConfirmDialog = false">取消</el-button>
        <el-button type="danger" @click="handleRestore" :loading="isRestoring">确认覆盖恢复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, CircleCheck, Timer, Loading } from '@element-plus/icons-vue'
import { request } from '@/shared/utils/request'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { migrationService } from '@/features/backup/service/migrationService'

const emit = defineEmits(['restore-success'])
const layoutStore = useLayoutStore()
const vaultStore = useVaultStore()

// --- 状态定义 ---
const providers = ref([])
const isLoading = ref(false)

// 配置弹窗
const showConfigDialog = ref(false)
const isEditing = ref(false)
const isTesting = ref(false)
const isSaving = ref(false)
const form = ref({ type: 'webdav', name: '', config: { url: '', username: '', password: '', saveDir: '/', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '' }, autoBackup: false, autoBackupPassword: '', autoBackupRetain: 30 })
const currentProviderId = ref(null)
const hasExistingAutoPwd = ref(false)
const configUseExistingAutoPwd = ref(false)

// 备份/恢复弹窗
const showBackupDialog = ref(false)
const backupPassword = ref('')
const isBackingUp = ref(false)
const useAutoPassword = ref(false)
const currentActionProvider = ref(null)

const showRestoreListDialog = ref(false)
const isLoadingFiles = ref(false)
const backupFiles = ref([])
const showRestoreConfirmDialog = ref(false)
const restorePassword = ref('')
const selectedFile = ref(null)
const isRestoring = ref(false)

// --- API 交互 ---
const fetchProviders = async () => {
  // 1. 离线优先：尝试加载加密缓存
  const cachedEncrypted = await vaultStore.getEncryptedBackupProviders()
  if (cachedEncrypted && Array.isArray(cachedEncrypted)) {
    providers.value = cachedEncrypted
    // 有缓存时静默更新，不转圈圈
  } else {
    isLoading.value = true
  }

  try {
    const res = await request('/api/backups/providers')
    if (res.success) {
      providers.value = res.providers
      // 2. 更新加密缓存
      await vaultStore.saveEncryptedBackupProviders(res.providers)
    }
  } finally { isLoading.value = false }
}

const getProviderTypeTag = (type) => type === 'webdav' ? 'primary' : (type === 's3' ? 'warning' : 'info')

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const openAddDialog = () => {
  isEditing.value = false
  form.value = { type: 'webdav', name: '', config: { url: '', username: '', password: '', saveDir: '/', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '' }, autoBackup: false, autoBackupPassword: '', autoBackupRetain: 30 }
  hasExistingAutoPwd.value = false
  configUseExistingAutoPwd.value = false
  showConfigDialog.value = true
}

const editProvider = (provider) => {
  isEditing.value = true
  currentProviderId.value = provider.id
  form.value = JSON.parse(JSON.stringify({
    type: provider.type,
    name: provider.name,
    config: provider.config,
    autoBackup: !!provider.auto_backup,
    autoBackupPassword: '', // 编辑时不回显密码，留空表示不修改
    autoBackupRetain: provider.auto_backup_retain ?? 30
  }))
  hasExistingAutoPwd.value = !!provider.auto_backup_password
  configUseExistingAutoPwd.value = true // 默认保持原密码
  showConfigDialog.value = true
}

const validateForm = () => {
  if (!form.value.name) return '请输入名称'
  const c = form.value.config
  if (form.value.type === 'webdav') {
    if (!c.url) return '请输入 WebDAV 地址'
    if (!c.username) return '请输入用户名'
    if (!c.password) return '请输入密码'
  } else if (form.value.type === 's3') {
    if (!c.endpoint) return '请输入 Endpoint'
    if (!c.bucket) return '请输入 Bucket'
    if (!c.accessKeyId) return '请输入 Access Key ID'
    if (!c.secretAccessKey) return '请输入 Secret Access Key'
  }
  
  if (form.value.autoBackup) {
    // 如果是编辑模式且有旧密码，并且用户选择保持原密码，则跳过校验
    if (isEditing.value && hasExistingAutoPwd.value && configUseExistingAutoPwd.value) {
      return null
    }
    // 其他情况（新增、编辑无旧密码、编辑选择设置新密码）都必须校验
    if (!form.value.autoBackupPassword || form.value.autoBackupPassword.length < 12) {
      return '自动备份密码长度必须至少 12 位'
    }
  }
  return null
}

const testConnection = async () => {
  const error = validateForm()
  if (error) return ElMessage.warning(error)

  isTesting.value = true
  try {
    const res = await request('/api/backups/providers/test', {
      method: 'POST', body: JSON.stringify({ type: form.value.type, config: form.value.config })
    })
    if (res.success) ElMessage.success('连接成功')
  } catch (e) {} finally { isTesting.value = false }
}

const saveProvider = async () => {
  const error = validateForm()
  if (error) return ElMessage.warning(error)

  // 若保持原密码，清空密码字段避免覆盖
  if (isEditing.value && hasExistingAutoPwd.value && configUseExistingAutoPwd.value) {
    form.value.autoBackupPassword = ''
  }

  isSaving.value = true
  try {
    const url = isEditing.value ? `/api/backups/providers/${currentProviderId.value}` : '/api/backups/providers'
    const method = isEditing.value ? 'PUT' : 'POST'
    const res = await request(url, { method, body: JSON.stringify(form.value) })
    if (res.success) {
      ElMessage.success('保存成功')
      showConfigDialog.value = false
      fetchProviders()
    }
  } catch (e) {} finally { isSaving.value = false }
}

const deleteProvider = async (provider) => {
  try {
    await ElMessageBox.confirm('确定删除该备份源吗？', '警告', { type: 'warning' })
    await request(`/api/backups/providers/${provider.id}`, { method: 'DELETE' })
    fetchProviders()
  } catch (e) {}
}

const openBackupDialog = (provider) => {
  currentActionProvider.value = provider
  backupPassword.value = ''
  useAutoPassword.value = !!provider.auto_backup
  showBackupDialog.value = true
}

const handleBackup = async () => {
  if (!useAutoPassword.value && backupPassword.value.length < 12) {
    return ElMessage.warning('密码至少12位')
  }
  
  const pwdToSend = useAutoPassword.value ? '' : backupPassword.value
  
  isBackingUp.value = true
  try {
    const res = await request(`/api/backups/providers/${currentActionProvider.value.id}/backup`, {
      method: 'POST', body: JSON.stringify({ password: pwdToSend })
    })
    if (res.success) {
      ElMessage.success('备份成功')
      showBackupDialog.value = false
      fetchProviders() // Refresh status
    }
  } catch (e) {} finally { isBackingUp.value = false }
}

const openRestoreDialog = async (provider) => {
  currentActionProvider.value = provider
  showRestoreListDialog.value = true
  isLoadingFiles.value = true
  try {
    const res = await request(`/api/backups/providers/${provider.id}/files`)
    if (res.success) backupFiles.value = res.files
  } finally { isLoadingFiles.value = false }
}

const selectRestoreFile = (file) => {
  selectedFile.value = file
  restorePassword.value = ''
  showRestoreConfirmDialog.value = true
}

const handleRestore = async () => {
  isRestoring.value = true
  try {
    // 1. 下载加密文件
    const downloadRes = await request(`/api/backups/providers/${currentActionProvider.value.id}/download`, {
      method: 'POST', body: JSON.stringify({ 
        filename: selectedFile.value.filename
      })
    })
    
    // 2. 前端解密
    let contentToDecrypt = downloadRes.content
    try {
      // 备份文件是 JSON 包装格式，需要提取内部的 data 字段 (Base64)
      // 修复：如果 contentToDecrypt 已经是对象，直接使用，避免 JSON.parse([object Object]) 报错
      const json = typeof contentToDecrypt === 'string' ? JSON.parse(contentToDecrypt) : contentToDecrypt
      if (json && json.encrypted && json.data) {
        contentToDecrypt = json.data
      }
    } catch (e) {}
    const vault = await migrationService.parseImportData(contentToDecrypt, 'encrypted', restorePassword.value)
    
    // 3. 保存数据
    const saveRes = await migrationService.saveImportedVault(vault)
    
    if (saveRes.success) {
      ElMessage.success(`恢复成功，已导入 ${saveRes.count} 个账号`)
      showRestoreConfirmDialog.value = false
      showRestoreListDialog.value = false
      emit('restore-success')
    }
  } catch (e) {
    ElMessage.error(e.message || '恢复失败')
  } finally { isRestoring.value = false }
}

onMounted(fetchProviders)
</script>