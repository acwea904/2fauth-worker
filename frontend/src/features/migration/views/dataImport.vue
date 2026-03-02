<template>
  <div class="data-import-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>数据导入</h2>
        <p style="color: var(--el-text-color-secondary);">支持从各类 2FA 软件或本系统的备份文件中恢复数据。</p>
      </div>

      <div style="max-width: 600px; margin: 0 auto;">
        
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
            将备份文件或迁移二维码截图拖到此处，或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="import-tips">
              <el-alert 
                title="💡 自动识别文件类型进行导入" 
                type="success" 
                :closable="false" 
                style="margin-bottom: 20px;" 
              />
              
              <div class="format-groups">
                <div class="format-group">
                  <h4>📁 本系统备份</h4>
                  <div class="tags">
                    <el-tag type="info" effect="light"><el-icon><Lock /></el-icon> 加密备份 (.json)</el-tag>
                    <el-tag type="info" effect="light"><el-icon><Unlock /></el-icon> 明文备份 (.json)</el-tag>
                  </div>
                </div>

                <div class="format-group">
                  <h4>📱 移动端 2FA App</h4>
                  <div class="tags">
                    <el-tag type="info" effect="light"><icon2FAS /> 2FAS (.2fas)</el-tag>
                    <el-tag type="info" effect="light"><iconAegis /> Aegis (.json/.txt)</el-tag>
                    <el-tag type="info" effect="light"><iconBitwarden /> Bitwarden Auth (.json/.csv)</el-tag>
                    <el-tag type="info" effect="light"><iconGoogleAuth /> Google Auth (.png/.jpg)</el-tag>
                    <el-tag type="info" effect="light"><iconMicrosoftAuth /> Microsoft Auth (PhoneFactor)</el-tag>
                  </div>
                  <div class="ga-tip">
                    <span>Google Authenticator</span>
                    <p>请在 App 内导出"迁移二维码"，将截图直接上传 (.png / .jpg)</p>
                  </div>
                  <div class="ms-tip">
                    <span>Microsoft Authenticator <small>(仅支持 Android)</small></span>
                    <p>将 PhoneFactor 文件直接上传，Android 手机该文件路径为： <code>/data/data/com.azure.authenticator/databases/PhoneFactor</code></p>
                  </div>
                </div>

                <div class="format-group">
                  <h4>📄 通用格式</h4>
                  <div class="tags">
                    <el-tag type="info" effect="light"><el-icon><Document /></el-icon> OTPAuth URI (.txt)</el-tag>
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
      title="📦 批量导入处理中"
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
          {{ batchProcessedJobs }} / {{ batchTotalJobs }} 任务已完成
        </h3>
        <p style="color: var(--el-text-color-secondary); margin-top: 10px;">
          {{ batchCurrentTaskName }}
        </p>
      </div>
    </el-dialog>

    <!-- 加密文件密码输入弹窗 -->
    <el-dialog v-model="showDecryptDialog" title="🔓 解密备份文件" width="400px" @close="handleDecryptDialogClose" destroy-on-close>
      <el-alert v-if="currentImportType === 'aegis_encrypted'" title="检测到 Aegis 加密备份" type="warning" :closable="false" style="margin-bottom: 15px;" />
      <el-alert v-else title="检测到本系统加密备份" type="success" :closable="false" style="margin-bottom: 15px;" />
      <el-form label-position="top" v-loading="isDecrypting" :element-loading-text="loadingText">
        <el-form-item label="请输入该备份的解密密码：">
          <el-input v-model="importPassword" type="password" show-password @keyup.enter="submitEncryptedData" placeholder="输入当时设置的导出密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDecryptDialog = false">取消</el-button>
        <el-button type="primary" :loading="isDecrypting" @click="submitEncryptedData">确认解密并导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { UploadFilled, Lock, Unlock, Document } from '@element-plus/icons-vue'
import { useDataImport } from '@/features/migration/composables/useDataImport'

// icons for import options (follow export page style)
import icon2FAS from '@/shared/components/icons/icon2FAS.vue'
import iconAegis from '@/shared/components/icons/iconAegis.vue'
import iconGoogleAuth from '@/shared/components/icons/iconGoogleAuth.vue'
import iconBitwarden from '@/shared/components/icons/iconBitwarden.vue'
import iconMicrosoftAuth from '@/shared/components/icons/iconMicrosoftAuth.vue'

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
  padding: 20px;
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
