<template>
  <div class="health-check-container" v-loading.fullscreen.lock="loading">
    <el-card v-if="!loading && !passed" class="health-card">

      <template #header>
        <div class="health-header">
          <h2 class="alert-title">
            <el-icon :size="24" color="var(--el-color-danger)"><WarningFilled /></el-icon>
            {{ $t('healthCheck.title') }}
          </h2>
          <el-alert type="warning" :closable="false" center class="subtitle">{{ $t('healthCheck.subtitle') }}</el-alert>
        </div>
      </template>

      <div class="issues-list">
        <el-alert
          v-for="(issue, index) in issues"
          :key="index"
          :title="$t(`healthCheck.issues.${issue.message}.title`)"
          :type="issue.level === 'critical' ? 'error' : 'warning'"
          show-icon
          :closable="false"
          class="issue-alert"
        >
          <template #default>
            <div class="issue-content">
              <p class="issue-desc">
                {{ $t(`healthCheck.issues.${issue.message}.desc`) }}
                <template v-if="issue.missingFields && issue.missingFields.length > 0">
                  <br/>
                  <span class="missing-fields-text">
                    <strong>{{ $t('healthCheck.missing_fields') }}</strong> {{ issue.missingFields.join(', ') }}
                  </span>
                </template>
              </p>
              
              <!-- 修复建议区域 -->
              <div class="suggestion-box">
                <div class="suggestion-title">{{ $t('healthCheck.how_to_fix') }}</div>
                
                <div v-if="issue.deploy_by_worker || issue.deploy_by_gitaction" class="deploy-method-guide">
                  <p v-if="issue.deploy_by_worker" class="deploy-item">
                    <el-icon><Monitor /></el-icon> {{ $t(`healthCheck.suggestions.${issue.deploy_by_worker}`) }}
                  </p>
                  <p v-if="issue.deploy_by_gitaction" class="deploy-item">
                    <el-icon><Setting /></el-icon> {{ $t(`healthCheck.suggestions.${issue.deploy_by_gitaction}`) }}
                  </p>
                </div>
                
                <!-- 针对短密码的特殊处理：提供一键生成 -->
                <div v-if="issue.message === 'encryption_key_too_short' || issue.message === 'jwt_secret_too_short'" class="fix-action">
                  <p>{{ $t(`healthCheck.suggestions.${issue.suggestion}`) }}</p>
                  <div class="key-generator">
                    <el-input v-model="generatedKeys[issue.field]" readonly class="mono-font">
                      <template #append>
                        <el-button @click="copyKey(issue.field)">
                          <el-icon><CopyDocument /></el-icon>
                        </el-button>
                      </template>
                    </el-input>
                    <el-button type="success" plain size="small" @click="generateNewKey(issue.field)" class="mt-2">
                       <el-icon><Refresh /></el-icon> {{ $t('healthCheck.generate_new') }}
                    </el-button>
                  </div>
                </div>
                
                <!-- 针对 ALLOW_ALL 的警告 -->
                <div v-else-if="issue.message === 'oauth_allow_all_enabled'" class="fix-action text-danger">
                  <p>{{ $t(`healthCheck.suggestions.${issue.suggestion}`) }}</p>
                </div>

                <!-- 默认建议展示 -->
                <div v-else class="fix-action">
                   <p>{{ $t(`healthCheck.suggestions.${issue.suggestion}`) }}</p>
                   <div v-if="issue.message.includes('incomplete')" class="doc-link mt-2">
                     <el-link type="primary" href="https://github.com/nap0o/2fauth-worker#三配置第三方登录" target="_blank">
                       <el-icon><Document /></el-icon> {{ $t('healthCheck.view_docs') }}
                     </el-link>
                   </div>
                </div>
              </div>
            </div>
          </template>
        </el-alert>

        <div v-if="passedChecks.length > 0" class="passed-checks-section">
          <h3><el-icon color="#67C23A"><Select /></el-icon> {{ $t('healthCheck.passed_checks_title') }}</h3>
          <ul>
            <li v-for="check in passedChecks" :key="check">
              <el-icon color="#67C23A"><Select /></el-icon> {{ $t(`healthCheck.passed_checks.${check}`) }}
            </li>
          </ul>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { WarningFilled, CopyDocument, Refresh, Document, Select, Monitor, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { request } from '@/shared/utils/request'
import { useClipboard } from '@vueuse/core'

const router = useRouter()
const { copy, isSupported } = useClipboard()

const loading = ref(true)
const passed = ref(false)
const issues = ref([])
const passedChecks = ref([])
const generatedKeys = ref({
  ENCRYPTION_KEY: '',
  JWT_SECRET: ''
})

// 生成 64 字节高强度随机 Hex 字符
const generateHexKey = (length = 64) => {
    // 定义字符集：大写字母、数字、特殊字符
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    
    return Array.from(array, byte => {
        return charset[byte % charset.length];
    }).join('');
}

const generateNewKey = (field) => {
  generatedKeys.value[field] = generateHexKey()
}

const copyKey = async (field) => {
  if (!isSupported.value) {
    ElMessage.error('您的浏览器不支持自动复制，请手动选中复制。')
    return
  }
  await copy(generatedKeys.value[field])
  ElMessage.success('安全密钥已复制到剪贴板')
}

const checkHealth = async () => {
  try {
    loading.value = true
    // silent: true 用于防止 request 拦截器对于 403 直接弹出全局红条
    // 这里我们主动捕获错误做 UI 渲染
    const res = await request('/api/health/health-check', { silent: true })
    
    // API endpoint returns 200 OK regardless of passed or failed
    passed.value = res.passed === true
    if (passed.value) {
      router.replace('/login')
      return
    }

    issues.value = res.issues || []
    passedChecks.value = res.passedChecks || []
    
    if (!passed.value) {
      // 为需要生成密码的问题预先生成好密码
      issues.value.forEach(issue => {
        if (issue.field === 'ENCRYPTION_KEY' || issue.field === 'JWT_SECRET') {
           generateNewKey(issue.field)
        }
      })
    }
  } catch (err) {
    // 即使拦截器抛出了 403 error 也有可能是包含 data (issues) 的 AppException
    passed.value = false
    if (err.data && Array.isArray(err.data)) {
        issues.value = err.data
        issues.value.forEach(issue => {
            if (issue.field === 'ENCRYPTION_KEY' || issue.field === 'JWT_SECRET') {
            generateNewKey(issue.field)
            }
        })
    } else {
        ElMessage.error('无法连接到服务端进行安全校验')
    }
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  checkHealth()
})
</script>

<style scoped>
.health-check-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
}

.health-card {
  width: 95%;
  border-radius: 12px;
}

:global(html.dark) .health-card {
  background-color: #1a1a1a;
  border-color: #2c2c2c;
}

.health-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.alert-title {
  margin: 16px 0 0 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.5px;
}

.alert-divider {
  width: 40px;
  height: 4px;
  background-color: var(--el-color-danger);
  border-radius: 2px;
  margin: 16px 0;
}

.subtitle {
  margin: 15px 0px;
  padding: 10px;
}

.subtitle :deep(.el-alert__content) {
  padding: 0;
}

.subtitle :deep(.el-alert__title) {
  color: var(--el-text-color-regular);
  font-size: 16px;
  line-height: 20px;
  white-space: normal;
  word-wrap: break-word;
}

.issue-alert {
  margin-bottom: 20px;
  align-items: flex-start;
}

.issue-content {
  margin-top: 5px;
}

.issue-desc {
  font-size: 14px;
  margin-bottom: 15px;
  line-height: 1.5;
}

.suggestion-box {
  background-color: var(--el-color-primary-light-9);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-color-primary-light-7);
  border-left: 4px solid var(--el-color-primary);
}

:global(html.dark) .suggestion-box {
  background-color: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-left: 4px solid var(--el-color-primary);
}

:global(html.dark) .issue-alert {
  background-color: rgba(245, 108, 108, 0.05);
  border: 1px solid rgba(245, 108, 108, 0.2);
}

:global(html.dark) .missing-fields-text {
  background-color: rgba(245, 108, 108, 0.1) !important;
  border: 1px solid rgba(245, 108, 108, 0.3) !important;
}

.suggestion-title {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.fix-action p {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.deploy-method-guide {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--el-border-color);
}

.deploy-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.text-danger p {
  color: var(--el-color-danger);
  font-weight: bold;
}

.key-generator {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.mono-font :deep(.el-input__inner) {
  font-family: monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.mt-2 {
  margin-top: 8px;
}

.passed-checks-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed var(--el-border-color);
}

.passed-checks-section h3 {
  font-size: 15px;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
}

.passed-checks-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.passed-checks-section li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 10px;
  padding: 8px 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
}

.missing-fields-text {
  display: inline-block;
  margin-top: 8px;
  color: var(--el-color-danger);
  background-color: var(--el-color-danger-light-9);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
