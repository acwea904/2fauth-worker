<template>
  <div class="tool-pane">
    <div class="totp-layout">
      <!-- Bottom: Configuration -->
      <div class="config-side">
        <!-- 1. Secret Input (Tabs) -->
        <div class="config-section">
          <div class="section-header">
            <h3 class="section-title">{{ $t('tools.secret_config') }}</h3>
            <el-button link type="primary" @click="showScanner = true">
              <el-icon><Camera /></el-icon> {{ $t('vault.scan_qr') }}
            </el-button>
          </div>
          
          <el-tabs v-model="activeTab" type="border-card" class="secret-tabs">
            <el-tab-pane label="Base32" name="base32">
              <el-input 
                v-model="secretBase32" 
                @input="handleBase32Input" 
                placeholder="JBSWY3DP..." 
                clearable
                type="textarea"
                :rows="3"
              />
              <div class="tab-actions">
                <el-button size="small" @click="refreshBase32"><el-icon><Refresh /></el-icon> {{ $t('tools.regenerate') }}</el-button>
                <el-button size="small" @click="copyToClipboard(secretBase32)"><el-icon><CopyDocument /></el-icon> {{ $t('common.copy') }}</el-button>
              </div>
            </el-tab-pane>
            
            <el-tab-pane :label="$t('tools.totp_hex')" name="hex">
              <el-input 
                v-model="secretHex" 
                @input="handleHexInput" 
                placeholder="48656c6c6f..." 
                clearable
                type="textarea"
                :rows="3"
              />
              <div class="tab-actions">
                <el-button size="small" @click="refreshHex"><el-icon><Refresh /></el-icon> {{ $t('tools.regenerate') }}</el-button>
                <el-button size="small" @click="copyToClipboard(secretHex)"><el-icon><CopyDocument /></el-icon> {{ $t('common.copy') }}</el-button>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="ASCII" name="ascii">
              <el-input 
                v-model="secretAscii" 
                @input="handleAsciiInput" 
                placeholder="Hello..." 
                clearable
                type="textarea"
                :rows="3"
              />
              <div class="tab-actions">
                <el-button size="small" @click="refreshAscii"><el-icon><Refresh /></el-icon> {{ $t('tools.regenerate') }}</el-button>
                <el-button size="small" @click="copyToClipboard(secretAscii)"><el-icon><CopyDocument /></el-icon> {{ $t('common.copy') }}</el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 2. Metadata -->
        <div class="config-section">
          <h3 class="section-title">{{ $t('tools.basic_info') }}</h3>
          <div class="meta-row">
            <el-input v-model="issuer" @input="updateUri">
              <template #prefix><span class="input-label">{{ $t('vault.service') }}</span></template>
            </el-input>
            <el-input v-model="account" @input="updateUri">
              <template #prefix><span class="input-label">{{ $t('vault.account') }}</span></template>
            </el-input>
          </div>
        </div>

        <!-- 3. Result Preview -->
        <div class="config-section">
          <div class="section-header">
            <h3 class="section-title">{{ $t('tools.preview') }}</h3>
            <el-button link type="primary" @click="downloadQrCode" :disabled="!qrCodeUrl">
              <el-icon><Download /></el-icon> {{ $t('common.save') }}
            </el-button>
          </div>
          <div class="preview-top-section">
            <div class="qr-wrapper" v-loading="!qrCodeUrl">
              <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR Code" class="qr-img" />
              <el-empty v-else :description="$t('tools.totp_config_preview')" :image-size="100" />
            </div>
            <div class="result-card">
              <div class="totp-code" :class="{ 'blur': !currentCode }">{{ currentCode || '------' }}</div>
              <div class="totp-timer" :class="{ 'urgent': remaining < 5 }">
                <el-icon><Timer /></el-icon> {{ remaining }}s {{ $t('tools.refresh_after') }}
              </div>
              <el-button type="primary" plain size="small" @click="copyToClipboard(currentCode, $t('vault.copy_success'))" :disabled="!currentCode" style="margin-top: 10px;">
                <el-icon><CopyDocument /></el-icon> {{ $t('common.copy') }}
              </el-button>
            </div>
          </div>
          <div class="uri-box" v-if="qrCodeUrl">
            <div class="uri-text">{{ currentUri }}</div>
            <el-button link type="primary" @click="copyToClipboard(currentUri)"><el-icon><CopyDocument /></el-icon></el-button>
          </div>
        </div>

        <!-- 4. Advanced Settings -->
        <div class="config-section">
          <el-collapse>
            <el-collapse-item :title="$t('tools.advanced_settings')" name="1">
              <div class="advanced-row">
                <el-select v-model="algorithm" @change="updateAll('settings')" :placeholder="$t('tools.totp_algorithm')" style="flex: 1">
                  <el-option :label="$t('tools.totp_algo_sha1_default')" value="SHA-1" />
                  <el-option label="SHA-256" value="SHA-256" />
                  <el-option label="SHA-512" value="SHA-512" />
                </el-select>
                <el-select v-model="digits" @change="updateAll('settings')" :placeholder="$t('tools.totp_digits')" style="width: 100px">
                  <el-option :label="$t('vault.digits_6')" :value="6" />
                  <el-option :label="$t('vault.digits_8')" :value="8" />
                </el-select>
                <el-select v-model="period" @change="updateAll('settings')" :placeholder="$t('tools.totp_period')" style="width: 100px">
                  <el-option :label="$t('vault.period_30s')" :value="30" />
                  <el-option :label="$t('vault.period_60s')" :value="60" />
                </el-select>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 5. Time Offset -->
        <div class="config-section">
          <div class="label-row">
            <span class="label-text">{{ $t('tools.time_offset') }} (Time Travel): {{ timeOffset > 0 ? '+' : '' }}{{ timeOffset }}s</span>
            <el-button link type="primary" @click="adjustTime(0, true)" size="small">{{ $t('tools.reset_time') }}</el-button>
          </div>
          <el-button-group style="width: 100%; display: flex;">
            <el-button @click="adjustTime(-period)" style="flex:1" size="small">{{ $t('tools.prev_period') }}</el-button>
            <el-button @click="adjustTime(period)" style="flex:1" size="small">{{ $t('tools.next_period') }}</el-button>
          </el-button-group>
        </div>

        <!-- Save Button -->
        <div class="config-section" style="margin-top: 20px;">
          <el-button type="success" size="large" @click="saveToVault" style="width: 100%;" :loading="isSaving">
            <el-icon><CircleCheck /></el-icon> {{ $t('tools.save_to_vault') }}
          </el-button>
        </div>
      </div>
    </div>
    
    <!-- 二维码扫描弹窗 -->
    <el-dialog v-model="showScanner" :title="$t('tools.totp_scan_qr_title')" width="500px" destroy-on-close append-to-body>
      <QrScanner @scan-success="handleScanSuccess" />
    </el-dialog>
  </div>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import { CopyDocument, Refresh, Timer, Camera, CircleCheck, Download } from '@element-plus/icons-vue'
import { useQueryClient } from '@tanstack/vue-query'
import { copyToClipboard, triggerDownload } from '@/shared/utils/common'
import { useTotpToolbox } from '@/features/tools/composables/useTotpToolbox'
import { useTotpToolboxActions } from '@/features/tools/composables/useTotpToolboxActions'

const QrScanner = defineAsyncComponent(() => import('@/shared/components/qrScanner.vue'))
const queryClient = useQueryClient()

// 1. 获取核心工具箱状态机 (纯运算逻辑与时钟循环)
const toolbox = useTotpToolbox()
const {
    activeTab,
    secretBase32, secretHex, secretAscii,
    issuer, account, algorithm, digits, period, timeOffset,
    currentUri, currentCode, remaining,
    handleBase32Input, handleHexInput, handleAsciiInput, updateUri,
    refreshBase32, refreshHex, refreshAscii,
    adjustTime
} = toolbox

// 2. 获取外部副作用处理器 (QR生成、扫码注入与后端保存)
const {
    isSaving,
    showScanner,
    qrCodeUrl,
    handleScanSuccess,
    saveToVault
} = useTotpToolboxActions(toolbox, queryClient)

const downloadQrCode = () => {
    if (!qrCodeUrl.value) return
    triggerDownload(qrCodeUrl.value, `2fa-qr-${account.value || 'code'}.png`)
}
</script>