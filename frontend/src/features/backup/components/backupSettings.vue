<template>
  <div class="backup-container">
    <!-- 顶部操作 -->
    <div class="backup-header-actions">
      <h3>{{ $t('backup.management') }}</h3>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon> {{ $t('backup.add_source') }}
      </el-button>
    </div>

    <!-- 全局加载状态 -->
    <div v-if="isLoading && providers.length === 0" class="flex-column flex-center min-h-200 text-secondary">
      <el-icon class="is-loading mb-20 text-primary" :size="48"><Loading /></el-icon>
      <p class="text-16 ls-1">{{ $t('backup.fetching_sources') }}</p>
    </div>

    <!-- 列表区域 (有数据情况) -->
    <el-row v-else-if="providers.length > 0" :gutter="20">
      <el-col :xs="24" :sm="12" :md="8" v-for="provider in providers" :key="provider.id" class="mb-20">
        <el-card shadow="hover" class="backup-provider-card">
          <template #header>
            <div class="backup-card-header">
              <div class="flex flex-items-center">
                <div class="backup-provider-title flex-wrap">
                  <el-tag size="small" effect="dark" :type="getProviderTypeTag(provider.type)">{{ provider.type.toUpperCase() }}</el-tag>
                  <span class="font-bold text-16">{{ provider.name }}</span>
                  <el-tooltip v-if="provider.auto_backup" :content="$t('backup.auto_backup_on')" placement="top">
                    <el-icon color="#67C23A" size="16" class="pointer-help"><Timer /></el-icon>
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
            <p class="backup-status-text">
              {{ $t('backup.last_backup') }} 
              <span v-if="provider.lastBackupAt">{{ new Date(provider.lastBackupAt).toLocaleString() }}</span>
              <span v-else>{{ $t('backup.never_backed_up') }}</span>
              <el-tag v-if="provider.lastBackupStatus" size="small" :type="provider.lastBackupStatus === 'success' ? 'success' : 'danger'" class="ml-5">
                {{ provider.lastBackupStatus }}
              </el-tag>
            </p>

            <div class="backup-action-buttons">
              <el-button
                type="success" plain size="small"
                :loading="checkingBackupProviderId === provider.id"
                @click="openBackupDialog(provider)"
              >{{ $t('backup.backup_now') }}</el-button>
              <el-button
                type="warning" plain size="small"
                :loading="checkingRestoreProviderId === provider.id"
                @click="openRestoreDialog(provider)"
              >{{ $t('backup.restore_data') }}</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
      
    </el-row>

    <!-- 空状态 -->
    <div v-else class="empty-state mt-40">
      <el-empty :description="$t('backup.empty_source')" />
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="showConfigDialog" :title="isEditing ? $t('backup.edit_source') : $t('backup.add_source')" :width="layoutStore.isMobile ? '90%' : '500px'" destroy-on-close>
      <el-form :model="form" label-position="top" ref="formRef">
        <el-form-item :label="$t('backup.type_label')">
          <el-select v-model="form.type" :disabled="isEditing">
            <el-option v-if="availableTypes.includes('s3')" :label="$t('backup.type_s3')" value="s3" />
            <el-option v-if="availableTypes.includes('telegram')" label="Telegram" value="telegram" />
            <el-option v-if="availableTypes.includes('webdav')" label="WebDAV" value="webdav" />
            <el-option v-if="availableTypes.includes('gdrive')" label="Google Drive" value="gdrive" />
            <el-option v-if="availableTypes.includes('onedrive')" label="OneDrive" value="onedrive" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('backup.name_label')">
          <el-input v-model="form.name" :placeholder="$t('backup.name_placeholder')" />
        </el-form-item>

        <!-- S3 配置 -->
        <template v-if="form.type === 's3'">
          <el-form-item :label="$t('backup.s3_endpoint')">
            <el-input v-model="form.config.endpoint" placeholder="https://<account>.r2.cloudflarestorage.com" />
          </el-form-item>
          <el-form-item :label="$t('backup.s3_bucket')">
            <el-input v-model="form.config.bucket" placeholder="my-backup-bucket" />
          </el-form-item>
          <el-form-item :label="$t('backup.s3_region')">
            <el-input v-model="form.config.region" :placeholder="$t('backup.s3_region_placeholder')" />
          </el-form-item>
          <el-form-item label="Access Key ID">
            <el-input v-model="form.config.accessKeyId" />
          </el-form-item>
          <el-form-item label="Secret Access Key">
            <div v-if="isEditing && !isEditingS3Secret" class="flex flex-items-center flex-between bg-fill p-10 rounded-4 border-1 w-full h-32">
              <span class="font-mono ls-2">******</span>
              <el-button link type="primary" @click="isEditingS3Secret = true; form.config.secretAccessKey = ''">{{ $t('backup.modify') }}</el-button>
            </div>
            <el-input v-else v-model="form.config.secretAccessKey" type="password" show-password />
          </el-form-item>
          <el-form-item :label="$t('backup.s3_path_prefix')">
            <el-input v-model="form.config.saveDir" placeholder="/2fauth-worker-backup" />
          </el-form-item>
        </template>

        <!-- Telegram 配置 -->
        <template v-if="form.type === 'telegram'">
          <el-form-item :label="$t('backup.telegram_bot_token')">
            <div v-if="isEditing && !isEditingTelegramToken" class="flex flex-items-center flex-between bg-fill p-10 rounded-4 border-1 w-full h-32">
              <span class="font-mono ls-2">******</span>
              <el-button link type="primary" @click="isEditingTelegramToken = true; form.config.botToken = ''">{{ $t('backup.modify') }}</el-button>
            </div>
            <el-input v-else v-model="form.config.botToken" type="password" show-password :placeholder="$t('backup.telegram_bot_token_placeholder')" />
          </el-form-item>
          <el-form-item :label="$t('backup.telegram_chat_id')">
            <el-input v-model="form.config.chatId" :placeholder="$t('backup.telegram_chat_id_placeholder')" />
            <div class="backup-form-tip">
              <strong>{{ $t('backup.telegram_chat_id_tip_title') }}</strong><br/>
              <span>{{ $t('backup.telegram_chat_id_tip_1') }}</span><br/>
              <span>{{ $t('backup.telegram_chat_id_tip_2') }}</span>
            </div>
          </el-form-item>
        </template>

        <!-- WebDAV 配置 -->
        <template v-if="form.type === 'webdav'">
          <el-form-item :label="$t('backup.webdav_url')">
            <el-input v-model="form.config.url" placeholder="https://pan.example.com/dav/" />
          </el-form-item>
          <el-form-item :label="$t('backup.username')">
            <el-input v-model="form.config.username" />
          </el-form-item>
          <el-form-item :label="$t('backup.password')">
            <div v-if="isEditing && !isEditingWebdavPwd" class="flex flex-items-center flex-between bg-fill p-10 rounded-4 border-1 w-full h-32">
              <span class="font-mono ls-2">******</span>
              <el-button link type="primary" @click="isEditingWebdavPwd = true; form.config.password = ''">{{ $t('backup.modify') }}</el-button>
            </div>
            <el-input v-else v-model="form.config.password" type="password" show-password />
          </el-form-item>
          <el-form-item :label="$t('backup.save_dir')">
            <el-input v-model="form.config.saveDir" placeholder="/2fauth-worker-backup" />
          </el-form-item>
        </template>

        <!-- Google Drive 配置 -->
        <template v-if="form.type === 'gdrive'">
          <!-- 1. 授权引导/状态区域 (仅在表单中没有 Token 或 正在授权 或 授权成功但未保存时显示) -->
          <div v-if="!form.config.refreshToken" class="p-10 mb-20 text-center bg-fill rounded-8 border-1 border-dashed min-h-120 flex flex-center flex-column">
             <!-- 初始/加载状态 -->
             <template v-if="!authStatus">
               <p class="mb-15 text-secondary text-13">{{ $t('backup.gdrive_auth_tip') }}</p>
               <button 
                 type="button" 
                 class="btn-oauth-auth btn-google-auth pointer" 
                 :class="{ 'is-loading': isAuthenticatingGoogle }"
                 :disabled="isAuthenticatingGoogle"
                 @click="startGoogleAuth"
               >
                 <el-icon v-if="isAuthenticatingGoogle" class="is-loading"><Loading /></el-icon>
                 <component v-else :is="iconGoogle" width="20" height="20" />
                 <span>{{ isAuthenticatingGoogle ? $t('backup.waiting_authorization') : $t('backup.auth_with_google') }}</span>
               </button>
             </template>

             <!-- 授权失败反馈 -->
             <template v-else-if="authStatus === 'error'">
                <div class="text-danger flex flex-items-center flex-column py-10">
                  <el-icon size="42"><CircleClose /></el-icon>
                  <p class="mt-15 font-bold">{{ authErrorMessage }}</p>
                  <el-button type="primary" link class="mt-10" @click="startGoogleAuth">{{ $t('backup.re_authorize') }}</el-button>
                </div>
             </template>
          </div>

          <!-- 2. 已授权标识 (仅在新增模式下授权成功后显示) -->
          <el-form-item v-if="!isEditing && authStatus === 'success'" class="animate-fade-in">
            <div class="backup-status-box is-success">
              <div class="backup-status-content">
                <el-icon class="status-icon"><CircleCheck /></el-icon>
                <span class="status-text">{{ $t('backup.authorized_success_gd') }}</span>
              </div>
              <el-button type="primary" link @click="startGoogleAuth">{{ $t('backup.re_authorize') }}</el-button>
            </div>
          </el-form-item>

          <!-- 3. 配置项区域 (有 Token 时才显示) -->
          <div v-if="form.config.refreshToken">
            <el-form-item :label="$t('backup.save_dir')">
              <el-input v-model="form.config.saveDir" :placeholder="$t('backup.save_dir_placeholder')" />
              <div class="backup-form-tip">{{ $t('backup.gdrive_folder_tip') }}</div>
            </el-form-item>

            <!-- 令牌管理 (仅在编辑模式显示，且用户通常无需操作，仅提供重新授权) -->
            <el-form-item v-if="isEditing" :label="$t('backup.gdrive_refresh_token')">
              <div class="backup-status-box">
                <div class="backup-status-content">
                  <el-icon class="status-icon" color="var(--el-text-color-secondary)"><CircleCheck /></el-icon>
                  <span class="status-text text-secondary">{{ $t('backup.gdrive_token_active') }}</span>
                </div>
                <el-button type="primary" link @click="startGoogleAuth">{{ $t('backup.re_authorize') }}</el-button>
              </div>
            </el-form-item>
          </div>
        </template>

        <!-- Microsoft OneDrive 配置 -->
        <template v-if="form.type === 'onedrive'">
          <!-- 1. 授权引导/状态区域 (仅在表单中没有 Token 或 正在授权 或 授权成功但未保存时显示) -->
          <div v-if="!form.config.refreshToken" class="p-10 mb-20 text-center bg-fill rounded-8 border-1 border-dashed min-h-120 flex flex-center flex-column">
             <!-- 初始/加载状态 -->
             <template v-if="!authStatusMicrosoft">
               <p class="mb-15 text-secondary text-13">{{ $t('backup.onedrive_auth_tip') }}</p>
               <button 
                 type="button" 
                 class="btn-oauth-auth btn-microsoft-auth pointer" 
                 :class="{ 'is-loading': isAuthenticatingMicrosoft }"
                 :disabled="isAuthenticatingMicrosoft"
                 @click="startMicrosoftAuth"
               >
                 <el-icon v-if="isAuthenticatingMicrosoft" class="is-loading"><Loading /></el-icon>
                 <component v-else :is="iconMicrosoftAuth" width="20" height="20" />
                 <span>{{ isAuthenticatingMicrosoft ? $t('backup.waiting_authorization') : $t('backup.auth_with_microsoft') }}</span>
               </button>
             </template>

             <!-- 授权失败反馈 -->
             <template v-else-if="authStatusMicrosoft === 'error'">
                <div class="text-danger flex flex-items-center flex-column py-10">
                  <el-icon size="42"><CircleClose /></el-icon>
                  <p class="mt-15 font-bold">{{ authErrorMessageMicrosoft }}</p>
                  <el-button type="primary" link class="mt-10" @click="startMicrosoftAuth">{{ $t('backup.re_authorize') }}</el-button>
                </div>
             </template>
          </div>

          <!-- 2. 已授权标识 (仅在新增模式下授权成功后显示) -->
          <el-form-item v-if="!isEditing && authStatusMicrosoft === 'success'" class="animate-fade-in">
            <div class="backup-status-box is-success">
              <div class="backup-status-content">
                <el-icon class="status-icon"><CircleCheck /></el-icon>
                <span class="status-text">{{ $t('backup.authorized_success_ms') }}</span>
              </div>
              <el-button type="primary" link @click="startMicrosoftAuth">{{ $t('backup.re_authorize') }}</el-button>
            </div>
          </el-form-item>

          <!-- 3. 配置项区域 (有 Token 时才显示) -->
          <div v-if="form.config.refreshToken">
            <el-form-item :label="$t('backup.save_dir')">
              <el-input v-model="form.config.saveDir" :placeholder="$t('backup.save_dir_placeholder')" />
              <div class="backup-form-tip">{{ $t('backup.onedrive_folder_tip') }}</div>
            </el-form-item>

            <!-- 令牌管理 (仅在编辑模式显示，且用户通常无需操作，仅提供重新授权) -->
            <el-form-item v-if="isEditing" :label="$t('backup.onedrive_refresh_token')">
              <div class="backup-status-box">
                <div class="backup-status-content">
                  <el-icon class="status-icon" color="var(--el-text-color-secondary)"><CircleCheck /></el-icon>
                  <span class="status-text text-secondary">{{ $t('backup.onedrive_token_active') }}</span>
                </div>
                <el-button type="primary" link @click="startMicrosoftAuth">{{ $t('backup.re_authorize') }}</el-button>
              </div>
            </el-form-item>
          </div>
        </template>

        <el-divider content-position="left">{{ $t('backup.auto_backup_config') }}</el-divider>
        <el-form-item :label="$t('backup.auto_backup')">
          <el-switch v-model="form.autoBackup" :active-text="$t('backup.switch_on')" :inactive-text="$t('backup.switch_off')" />
        </el-form-item>
        <el-form-item :label="$t('backup.encrypt_password')" v-if="form.autoBackup">
          <div v-if="isEditing && hasExistingAutoPwd" style="margin-bottom: 15px; width: 100%;">
            <el-radio-group v-model="configUseExistingAutoPwd">
              <el-radio :value="true">{{ $t('backup.keep_old_pwd') }}</el-radio>
              <el-radio :value="false">{{ $t('backup.set_new_pwd') }}</el-radio>
            </el-radio-group>
          </div>
          <div v-if="!(isEditing && hasExistingAutoPwd && configUseExistingAutoPwd)" class="w-full">
            <el-input v-model="form.autoBackupPassword" type="password" show-password :placeholder="$t('backup.input_encrypt_pwd')" />
            <div class="backup-form-tip"><span class="text-danger">*</span> {{ $t('backup.password_length_req') }}</div>
          </div>
          <div v-else class="backup-status-box is-success mb-10">
            <div class="backup-status-content">
               <el-icon class="status-icon"><CircleCheck /></el-icon>
               <span class="status-text">{{ $t('backup.continue_use_old_pwd') }}</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item :label="$t('backup.retain_count_label')" v-if="form.autoBackup">
          <el-input-number v-model="form.autoBackupRetain" :min="0" :max="999" :label="$t('backup.retain_count_label')"></el-input-number>
          <div class="backup-form-tip w-full">{{ $t('backup.retain_zero_tip') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="testConnection" :loading="isTesting">{{ $t('backup.test_connection') }}</el-button>
        <el-button type="primary" @click="saveProvider" :loading="isSaving">{{ $t('backup.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 备份弹窗 -->
    <el-dialog v-model="showBackupDialog" :title="$t('backup.encrypted_backup')" :width="layoutStore.isMobile ? '90%' : '400px'">
      <el-alert :title="$t('common.data_security')" type="info" :description="$t('backup.backup_security_tip')" show-icon :closable="false" class="mb-20" />
      
      <div v-if="currentActionProvider?.auto_backup" style="margin-bottom: 15px;">
        <el-radio-group v-model="useAutoPassword">
          <el-radio :value="true">{{ $t('backup.use_auto_pwd') }}</el-radio>
          <el-radio :value="false">{{ $t('backup.use_new_pwd') }}</el-radio>
        </el-radio-group>
      </div>

      <el-input v-if="!currentActionProvider?.auto_backup || !useAutoPassword" v-model="backupPassword" type="password" show-password :placeholder="$t('backup.input_custom_pwd')" />

      <template #footer>
        <el-button @click="showBackupDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleBackup" :loading="isBackingUp">{{ $t('backup.start_backup') }}</el-button>
      </template>
    </el-dialog>

    <!-- 恢复列表弹窗 -->
    <el-dialog v-model="showRestoreListDialog" :title="$t('backup.select_restore_file')" :width="layoutStore.isMobile ? '95%' : '600px'">
      <el-table :data="backupFiles" v-loading="isLoadingFiles" height="300px" style="width: 100%">
        <el-table-column prop="filename" :label="$t('backup.filename')" show-overflow-tooltip />
        <el-table-column :label="$t('backup.size')" width="100">
          <template #default="scope">
            {{ formatSize(scope.row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastModified" :label="$t('backup.time')" width="180" />
        <el-table-column :label="$t('backup.action')" width="100">
          <template #default="scope">
            <el-button link type="primary" @click="selectRestoreFile(scope.row)">{{ $t('backup.restore') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 恢复确认弹窗 -->
    <el-dialog v-model="showRestoreConfirmDialog" :title="$t('backup.decrypt_restore')" :width="layoutStore.isMobile ? '90%' : '400px'">
      <el-alert :title="$t('common.warning')" type="warning" :description="$t('backup.restore_warning')" show-icon :closable="false" class="mb-15" />
      <el-input v-model="restorePassword" type="password" show-password :placeholder="$t('backup.input_restore_pwd')" />
      <template #footer>
        <el-button @click="showRestoreConfirmDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="danger" @click="handleRestore" :loading="isRestoring">{{ $t('backup.confirm_restore') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { Plus, Edit, Delete, CircleCheck, CircleClose, Timer, Loading } from '@element-plus/icons-vue'
import iconGoogle from '@/shared/components/icons/iconGoogle.vue'
import iconMicrosoftAuth from '@/shared/components/icons/iconMicrosoftAuth.vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useBackupProviders } from '@/features/backup/composables/useBackupProviders'
import { useBackupActions } from '@/features/backup/composables/useBackupActions'

const emit = defineEmits(['restore-success'])
const layoutStore = useLayoutStore()

const {
  providers, isLoading, showConfigDialog, isEditing, isTesting, isSaving,
  isEditingWebdavPwd, isEditingS3Secret, isEditingTelegramToken, isEditingGoogleDrive, isEditingOneDrive, form,
  hasExistingAutoPwd, configUseExistingAutoPwd, fetchProviders, openAddDialog,
  editProvider, testConnection, saveProvider, deleteProvider,
  startGoogleAuth, startMicrosoftAuth, handleAuthMessage, isAuthenticatingGoogle, isAuthenticatingMicrosoft, authStatus, authStatusMicrosoft, authErrorMessage, authErrorMessageMicrosoft,
  setupAuthListener, availableTypes
} = useBackupProviders()

const {
  showBackupDialog, backupPassword, isBackingUp, checkingBackupProviderId, useAutoPassword, currentActionProvider,
  openBackupDialog, handleBackup, showRestoreListDialog, isLoadingFiles, checkingRestoreProviderId, backupFiles,
  showRestoreConfirmDialog, restorePassword, selectedFile, isRestoring, openRestoreDialog,
  selectRestoreFile, handleRestore
} = useBackupActions(emit, fetchProviders, (provider) => editProvider(provider))

let cleanupAuthListener = null

onMounted(() => {
  cleanupAuthListener = setupAuthListener((e) => {
    const data = e instanceof MessageEvent ? e.data : e
    console.log('[BackupSettings] Received auth signal:', data?.type)
  })
})

onUnmounted(() => {
  if (cleanupAuthListener) cleanupAuthListener()
})


const getProviderTypeTag = (type) => {
  const map = {
    webdav: 'primary',
    s3: 'warning',
    telegram: 'success',
    gdrive: 'danger',
    onedrive: ''
  }
  return map[type] || 'info'
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>