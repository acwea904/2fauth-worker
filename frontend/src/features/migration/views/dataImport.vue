<template>
  <div class="data-import-wrapper">
    <div class="tab-card-wrapper">
      <div class="text-center mb-30">
        <h2>{{ $t('migration.center_title') }}</h2>
        <p class="text-secondary">{{ $t('migration.center_desc') }}</p>
      </div>

      <div class="max-w-100p m-auto">
        
        <!-- 统一的拖拽上传区域 -->
        <el-upload
          ref="uploadRef"
          class="migration-import-upload"
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
        </el-upload>

        <!-- 支持情况说明 (直接展示版) -->
        <div class="migration-ecosystem mt-30">
          <el-divider border-style="dashed">
            <span class="text-secondary font-12 flex-center gap-5">
              <el-icon><QuestionFilled /></el-icon>
              {{ $t('migration.support_desc') }}
            </span>
          </el-divider>

          <div class="compatibility-container mt-20">
            <div class="ecosystem-groups">
              <!-- 组1: 本系统 -->
              <div class="ecosystem-group-card">
                <h4 class="group-title">
                  <el-icon><Folder /></el-icon>
                  {{ $t('migration.system_backup_format') }}
                </h4>
                <div class="ecosystem-grid">
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload">
                    <el-icon><Lock /></el-icon> {{ $t('migration.encrypted_backup_json') }}
                  </el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload">
                    <el-icon><Unlock /></el-icon> {{ $t('migration.plaintext_backup_json') }}
                  </el-button>
                </div>
              </div>

              <!-- 组2: 密码管理器 -->
              <div class="ecosystem-group-card">
                <h4 class="group-title">
                  <el-icon><Monitor /></el-icon>
                  {{ $t('migration.password_manager_format') }}
                </h4>
                <div class="ecosystem-grid">
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconBitwarden /></el-icon> Bitwarden Vault (.json/.csv)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><icon1Password /></el-icon> {{ $t('migration.onepassword_format') }}</el-button>
                </div>
              </div>

              <!-- 组3: 移动端 2FA App -->
              <div class="ecosystem-group-card">
                <h4 class="group-title">
                  <el-icon><Iphone /></el-icon>
                  {{ $t('migration.mobile_app_format') }}
                </h4>
                <div class="ecosystem-grid">
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><icon2FAS /></el-icon> 2FAS (.2fas)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconAegis /></el-icon> Aegis (.json/.txt)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconBitwarden /></el-icon> Bitwarden Auth (.json/.csv)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconProtonAuth /></el-icon> Proton Auth(.json)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconEnte /></el-icon> Ente Auth(.txt)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconGoogleAuth /></el-icon> Google Auth (.png/.jpg)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconMicrosoftAuth /></el-icon> Microsoft Auth (PhoneFactor)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><iconLastPassAuth /></el-icon> LastPass Auth (.json)</el-button>
                </div>
              </div>

              <!-- 组3: 通用格式 -->
              <div class="ecosystem-group-card">
                <h4 class="group-title">
                  <el-icon><Document /></el-icon>
                  {{ $t('migration.generic_format') }}
                </h4>
                <div class="ecosystem-grid">
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><Document /></el-icon> {{ $t('migration.generic_json') }}</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><Tickets /></el-icon> OTPAuth URI (.txt)</el-button>
                  <el-button plain class="migration-button-with-icon" @click="triggerUpload"><el-icon><Grid /></el-icon> {{ $t('migration.spreadsheet_csv') }}</el-button>
                </div>
              </div>
            </div>

            <!-- 详细引导 -->
            <el-divider border-style="dashed" content-position="center" class="mt-30">
              <span class="text-secondary font-12">{{ $t('migration.ga_ms_import_guide') }}</span>
            </el-divider>

            <div class="guide-section">
              <div class="migration-ga-tip">
                <span><el-icon><iconGoogleAuth /></el-icon> Google Authenticator</span>
                <p>{{ $t('migration.ga_auth_desc') }}</p>
              </div>
              <div class="migration-ms-tip">
                <span><el-icon><iconMicrosoftAuth /></el-icon> {{ $t('migration.ms_auth_desc') }}</span>
                <p>{{ $t('migration.ms_auth_detail') }}:</p>
                <div class="code-block-wrapper">
                  <code>/data/data/com.azure.authenticator/databases/PhoneFactor</code>
                  <code>/data/data/com.azure.authenticator/databases/PhoneFactor-wal</code>
                  <code>/data/data/com.azure.authenticator/databases/PhoneFactor-shm</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量导入进度弹窗 -->
    <el-dialog
      v-model="showBatchProgress"
      :title="$t('migration.batch_import_processing')"
      :width="layoutStore.isMobile ? '90%' : '450px'"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div class="text-center py-10">
        <el-progress 
          type="dashboard" 
          :percentage="batchProgressPercent" 
          :status="batchProgressPercent === 100 ? 'success' : ''" 
        />
        <h3 class="mt-20">
          {{ $t('migration.batch_progress', { processed: batchProcessedJobs, total: batchTotalJobs }) }}
        </h3>
        <p class="text-secondary mt-10">
          {{ batchCurrentTaskName }}
        </p>
      </div>
    </el-dialog>

    <!-- 加密文件密码输入弹窗 -->
    <el-dialog v-model="showDecryptDialog" :title="$t('migration.decrypt_backup_title')" :width="layoutStore.isMobile ? '90%' : '400px'" @close="handleDecryptDialogClose" destroy-on-close>
      <el-alert v-if="currentImportType === 'aegis_encrypted'" :title="$t('migration.detect_aegis')" type="warning" :closable="false" class="mb-15" />
      <el-alert v-else-if="currentImportType === 'proton_encrypted'" :title="$t('migration.detect_proton')" type="warning" :closable="false" class="mb-15" />
      <el-alert v-else-if="currentImportType === '2fas_encrypted'" :title="$t('migration.detect_2fas')" type="warning" :closable="false" class="mb-15" />
      <el-alert v-else-if="currentImportType === 'ente_encrypted'" :title="$t('migration.detect_ente')" type="warning" :closable="false" class="mb-15" />
      <el-alert v-else-if="currentImportType === 'bitwarden_vault_encrypted'" :title="$t('migration.detect_bitwarden_vault')" type="warning" :closable="false" class="mb-15" />
      <el-alert v-else :title="$t('migration.detect_system')" type="success" :closable="false" class="mb-15" />
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
import { ref } from 'vue'
import { UploadFilled, Lock, Unlock, Document, Tickets, Grid, Warning, Folder, Iphone, QuestionFilled, Monitor } from '@element-plus/icons-vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useDataImport } from '@/features/migration/composables/useDataImport'

const layoutStore = useLayoutStore()
const uploadRef = ref(null)

const triggerUpload = () => {
  // Use the nested input element inside el-upload component to trigger the file picker
  uploadRef.value?.$el.querySelector('input')?.click()
}

// icons for import options (follow export page style)
import icon2FAS from '@/shared/components/icons/icon2FAS.vue'
import iconAegis from '@/shared/components/icons/iconAegis.vue'
import iconGoogleAuth from '@/shared/components/icons/iconGoogleAuth.vue'
import iconBitwarden from '@/shared/components/icons/iconBitwarden.vue'
import iconMicrosoftAuth from '@/shared/components/icons/iconMicrosoftAuth.vue'
import iconProtonAuth from '@/shared/components/icons/iconProtonAuth.vue'
import iconEnte from '@/shared/components/icons/iconEnte.vue'
import icon1Password from '@/shared/components/icons/icon1Password.vue'
import iconLastPassAuth from '@/shared/components/icons/iconLastPassAuth.vue'

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


