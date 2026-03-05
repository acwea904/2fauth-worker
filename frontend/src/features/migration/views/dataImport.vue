<template>
  <div class="data-import-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>{{ $t('migration.center_title') }}</h2>
        <p style="color: var(--el-text-color-secondary);">{{ $t('migration.center_desc') }}</p>
      </div>

      <div style="max-width: 100%; margin: 0 auto;">
        
        <!-- 统一的拖拽上传区域 -->
        <el-upload
          class="import-upload"
          drag
          action="#"
          multiple
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileUpload"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            <p><el-tag type="success" effect="light">{{ $t('migration.auto_identify_tip') }}</el-tag></p>
            <p><span v-html="$t('migration.drag_drop_tip')"></span></p>
          </div>
          <template #tip>
            <div class="import-tips">
              <h4>{{ $t('migration.support_desc') }}</h4>
              <div class="format-groups">
                <div class="format-group">
                  <h4>📁 {{ $t('migration.system_backup_format') }}</h4>
                  <div class="tags">
                    <el-tag type="info" effect="light"><el-icon><Lock /></el-icon> {{ $t('migration.encrypted_backup_json') }}</el-tag>
                    <el-tag type="info" effect="light"><el-icon><Unlock /></el-icon> {{ $t('migration.plaintext_backup_json') }}</el-tag>
                  </div>
                </div>

                <div class="format-group">
                  <h4>📱 {{ $t('migration.mobile_app_format') }}</h4>
                  <div class="tags">
                    <el-tag type="info" effect="light"><icon2FAS /> 2FAS (.2fas)</el-tag>
                    <el-tag type="info" effect="light"><iconAegis /> Aegis (.json/.txt)</el-tag>
                    <el-tag type="info" effect="light"><iconBitwarden /> Bitwarden Auth (.json/.csv)</el-tag>
                    <el-tag type="info" effect="light"><iconProtonAuth /> Proton Auth (.json)</el-tag>
                    <el-tag type="info" effect="light"><iconGoogleAuth /> Google Auth (.png/.jpg)</el-tag>
                    <el-tag type="info" effect="light"><iconMicrosoftAuth /> Microsoft Auth (PhoneFactor)</el-tag>
                  </div>
                  <div class="ga-tip">
                    <span>Google Authenticator</span>
                    <p>{{ $t('migration.ga_auth_desc') }}</p>
                  </div>
                  <div class="ms-tip">
                    <span>{{ $t('migration.ms_auth_desc') }}</span>
                    <p>{{ $t('migration.ms_auth_detail') }}:<br />
                      <code>/data/data/com.azure.authenticator/databases/PhoneFactor</code><br />
                      <code>/data/data/com.azure.authenticator/databases/PhoneFactor-wal</code><br />
                      <code>/data/data/com.azure.authenticator/databases/PhoneFactor-shm</code>
                    </p>
                  </div>
                </div>

                <div class="format-group">
                  <h4>📄 {{ $t('migration.generic_format') }}</h4>
                  <div class="tags">
                    <el-tag type="info" effect="light"><el-icon><Document /></el-icon> {{ $t('migration.generic_json') }}</el-tag>
                    <el-tag type="info" effect="light"><el-icon><Tickets /></el-icon> OTPAuth URI (.txt)</el-tag>
                    <el-tag type="info" effect="light"><el-icon><Grid /></el-icon> {{ $t('migration.spreadsheet_csv') }}</el-tag>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </el-upload>

      </div>
    </div>

    <!-- 批量导入进度弹窗 -->
    <el-dialog
      v-model="showBatchProgress"
      :title="$t('migration.batch_import_processing')"
      width="450px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div style="text-align: center; padding: 10px 0;">
        <el-progress 
          type="dashboard" 
          :percentage="batchProgressPercent" 
          :status="batchProgressPercent === 100 ? 'success' : ''" 
        />
        <h3 style="margin-top: 20px;">
          {{ $t('migration.batch_progress', { processed: batchProcessedJobs, total: batchTotalJobs }) }}
        </h3>
        <p style="color: var(--el-text-color-secondary); margin-top: 10px;">
          {{ batchCurrentTaskName }}
        </p>
      </div>
    </el-dialog>

    <!-- 加密文件密码输入弹窗 -->
    <el-dialog v-model="showDecryptDialog" :title="$t('migration.decrypt_backup_title')" width="400px" @close="handleDecryptDialogClose" destroy-on-close>
      <el-alert v-if="currentImportType === 'aegis_encrypted'" :title="$t('migration.detect_aegis')" type="warning" :closable="false" style="margin-bottom: 15px;" />
      <el-alert v-else-if="currentImportType === 'proton_encrypted'" :title="$t('migration.detect_proton')" type="warning" :closable="false" style="margin-bottom: 15px;" />
      <el-alert v-else-if="currentImportType === '2fas_encrypted'" :title="$t('migration.detect_2fas')" type="warning" :closable="false" style="margin-bottom: 15px;" />
      <el-alert v-else :title="$t('migration.detect_system')" type="success" :closable="false" style="margin-bottom: 15px;" />
      <el-form label-position="top">
        <el-form-item :label="$t('migration.input_decrypt_pwd_label')">
          <el-input v-model="importPassword" type="password" show-password @keyup.enter="submitEncryptedData" :placeholder="$t('migration.input_decrypt_pwd_placeholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDecryptDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="isDecrypting" @click="submitEncryptedData">{{ $t('migration.confirm_decrypt_import') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { UploadFilled, Lock, Unlock, Document, Tickets, Grid } from '@element-plus/icons-vue'
import { useDataImport } from '@/features/migration/composables/useDataImport'

// icons for import options (follow export page style)
import icon2FAS from '@/shared/components/icons/icon2FAS.vue'
import iconAegis from '@/shared/components/icons/iconAegis.vue'
import iconGoogleAuth from '@/shared/components/icons/iconGoogleAuth.vue'
import iconBitwarden from '@/shared/components/icons/iconBitwarden.vue'
import iconMicrosoftAuth from '@/shared/components/icons/iconMicrosoftAuth.vue'
import iconProtonAuth from '@/shared/components/icons/iconProtonAuth.vue'

const emit = defineEmits(['success'])

const {
  currentImportType,
  showDecryptDialog,
  importPassword,
  isDecrypting,
  showBatchProgress,
  batchCurrentTaskName,
  batchProcessedJobs,
  batchTotalJobs,
  batchProgressPercent,
  handleFileUpload,
  submitEncryptedData,
  handleDecryptDialogClose
} = useDataImport(emit)

</script>

<style scoped>
.import-upload {
  margin-top: 20px;
}
:deep(.el-upload-dragger) {
  padding: 40px;
  background-color: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}
:deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary);
}
:deep(.el-icon--upload) {
  font-size: 48px;
  color: var(--el-text-color-secondary);
  margin-bottom: 20px;
}

/* 提示区美化 */
.import-tips {
  text-align: left;
  margin-top: 25px;
  background-color: var(--el-fill-color-lighter);
  padding: 0px 20px 20px 20px;
  border-radius: 8px;
  border: 1px dashed var(--el-border-color);
}

.format-groups {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.format-group h4 {
  margin: 0 0 10px 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tags span.el-tag {
  padding: 8px 15px;
  height: auto;
  color: var(--el-text-color-regular);
}

.tags span i.el-icon {
  display: inline-flex;
  flex-wrap: wrap;
}

.ga-tip {
  background-color: var(--el-color-primary-light-9);
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--el-color-primary);
  margin-top: 10px;
}

.ga-tip span {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-color-primary);
  display: block;
  margin-bottom: 4px;
}

.ga-tip p {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.ms-tip {
  background-color: var(--el-color-success-light-9);
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--el-color-success);
  margin-top: 10px;
}

.ms-tip span {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-color-success);
  display: block;
  margin-bottom: 4px;
}

.ms-tip p {
  margin: 0;
  font-size: 12px;
  color: var(--el-color-regular);
  line-height: 1.5;
}
.ms-tip p code {
  word-wrap: break-word;
}
</style>
