<template>
  <div class="tool-pane">
    <div class="totp-layout">
      <!-- Bottom: Configuration -->
      <div class="config-side">
        <!-- 1. Secret Input (Tabs) -->
        <div class="config-section">
          <div class="section-header">
            <h3 class="section-title">密钥配置</h3>
            <el-button link type="primary" @click="showScanner = true">
              <el-icon><Camera /></el-icon> 识别二维码导入
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
                <el-button size="small" @click="refreshBase32"><el-icon><Refresh /></el-icon> 随机生成</el-button>
                <el-button size="small" @click="copyToClipboard(secretBase32)"><el-icon><CopyDocument /></el-icon> 复制</el-button>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="Hex (十六进制)" name="hex">
              <el-input 
                v-model="secretHex" 
                @input="handleHexInput" 
                placeholder="48656c6c6f..." 
                clearable
                type="textarea"
                :rows="3"
              />
              <div class="tab-actions">
                <el-button size="small" @click="refreshHex"><el-icon><Refresh /></el-icon> 随机生成</el-button>
                <el-button size="small" @click="copyToClipboard(secretHex)"><el-icon><CopyDocument /></el-icon> 复制</el-button>
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
                <el-button size="small" @click="refreshAscii"><el-icon><Refresh /></el-icon> 随机生成</el-button>
                <el-button size="small" @click="copyToClipboard(secretAscii)"><el-icon><CopyDocument /></el-icon> 复制</el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 2. Metadata -->
        <div class="config-section">
          <h3 class="section-title">基础信息</h3>
          <div class="meta-row">
            <el-input v-model="issuer" @input="updateUri">
              <template #prefix><span class="input-label">服务商</span></template>
            </el-input>
            <el-input v-model="account" @input="updateUri">
              <template #prefix><span class="input-label">账号标识</span></template>
            </el-input>
          </div>
        </div>

        <!-- 3. Result Preview -->
        <div class="config-section">
          <div class="section-header">
            <h3 class="section-title">结果预览</h3>
            <el-button link type="primary" @click="downloadQrCode" :disabled="!qrCodeUrl">
              <el-icon><Download /></el-icon> 保存二维码
            </el-button>
          </div>
          <div class="preview-top-section">
            <div class="qr-wrapper" v-loading="!qrCodeUrl">
              <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR Code" class="qr-img" />
              <el-empty v-else description="配置参数以生成预览" :image-size="100" />
            </div>
            <div class="result-card">
              <div class="totp-code" :class="{ 'blur': !currentCode }">{{ currentCode || '------' }}</div>
              <div class="totp-timer" :class="{ 'urgent': remaining < 5 }">
                <el-icon><Timer /></el-icon> {{ remaining }}s 后刷新
              </div>
              <el-button type="primary" plain size="small" @click="copyToClipboard(currentCode, '验证码已复制')" :disabled="!currentCode" style="margin-top: 10px;">
                <el-icon><CopyDocument /></el-icon> 复制验证码
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
            <el-collapse-item title="高级设置 (算法/位数/步长)" name="1">
              <div class="advanced-row">
                <el-select v-model="algorithm" @change="updateAll('settings')" placeholder="算法" style="flex: 1">
                  <el-option label="SHA-1 (默认)" value="SHA-1" />
                  <el-option label="SHA-256" value="SHA-256" />
                  <el-option label="SHA-512" value="SHA-512" />
                </el-select>
                <el-select v-model="digits" @change="updateAll('settings')" placeholder="位数" style="width: 100px">
                  <el-option label="6 位" :value="6" />
                  <el-option label="8 位" :value="8" />
                </el-select>
                <el-select v-model="period" @change="updateAll('settings')" placeholder="周期" style="width: 100px">
                  <el-option label="30 秒" :value="30" />
                  <el-option label="60 秒" :value="60" />
                </el-select>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 5. Time Offset -->
        <div class="config-section">
          <div class="label-row">
            <span class="label-text">时间偏移 (Time Travel): {{ timeOffset > 0 ? '+' : '' }}{{ timeOffset }}s</span>
            <el-button link type="primary" @click="adjustTime(0, true)" size="small">重置</el-button>
          </div>
          <el-button-group style="width: 100%; display: flex;">
            <el-button @click="adjustTime(-period)" style="flex:1" size="small">上个周期</el-button>
            <el-button @click="adjustTime(period)" style="flex:1" size="small">下个周期</el-button>
          </el-button-group>
        </div>

        <!-- Save Button -->
        <div class="config-section" style="margin-top: 20px;">
          <el-button type="success" size="large" @click="saveToVault" style="width: 100%;" :loading="isSaving">
            <el-icon><CircleCheck /></el-icon> 保存到我的账户
          </el-button>
        </div>
      </div>
    </div>
    
    <!-- 二维码扫描弹窗 -->
    <el-dialog v-model="showScanner" title="扫描二维码" width="500px" destroy-on-close append-to-body>
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