<template>
  <div class="callback-container">
    <el-card class="loading-card" shadow="hover">
      <el-result
        v-if="!errorMsg"
        icon="info"
        title="正在安全登录中"
        :sub-title="`请稍候，系统正在与 ${providerName} 交换安全凭证...`"
      >
        <template #extra>
          <el-icon class="is-loading" :size="40" color="#409eff"><Loading /></el-icon>
        </template>
      </el-result>

      <el-result
        v-else
        icon="error"
        title="授权失败"
        :sub-title="errorMsg"
      >
        <template #extra>
          <el-button type="primary" @click="goBackToLogin">返回登录页</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup>
import { Loading } from '@element-plus/icons-vue'
import { useOAuthCallback } from '@/features/auth/composables/useOAuthCallback'

const {
  errorMsg,
  providerName,
  goBackToLogin
} = useOAuthCallback()
</script>