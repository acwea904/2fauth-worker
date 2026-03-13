<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <div class="logo-container">
        <el-icon :size="54" color="#409EFC"><Lock /></el-icon>
        <h2>2FAuth Worker</h2>
        <p class="subtitle">{{ $t('auth.subtitle') }}</p>
      </div>

      <div v-if="isFetchingProviders" class="flex-column flex-center min-h-150 text-secondary">
        <el-icon class="is-loading mb-20 text-primary" :size="38"><Loading /></el-icon>
        <p class="text-15 ls-1">{{ $t('common.loading_data') }}</p>
      </div>

      <div v-else class="action-container min-h-100 rounded-8">
        <template v-for="provider in providers" :key="provider.id">
          <el-button
            type="primary"
            size="large"
            class="oauth-btn"
            :style="{ backgroundColor: provider.color, borderColor: provider.color }"
            :loading="loadingProvider === provider.id"
            :disabled="(!!loadingProvider && loadingProvider !== provider.id) || loadingPasskey"
            @click="handleLogin(provider.id)"
          >
            <template #icon>
              <el-icon>
                <component :is="iconComponents[provider.icon] || Platform" />
              </el-icon>
            </template>
            {{ $t('auth.login_with', { provider: provider.name }) }}
          </el-button>
        </template>

        <div class="login-divider" v-if="providers.length > 0">
          OR
        </div>

        <!-- Passkey Login -->
        <el-button
          type="primary"
          size="large"
          class="oauth-btn passkey-btn"
          :loading="loadingPasskey"
          @click="handlePasskeyLogin"
        >
          <template #icon>
            <el-icon><iconFingerprint /></el-icon>
          </template>
          {{ $t('auth.passkey_login') }}
        </el-button>
      </div>

      <div class="footer-tips">
        <el-alert
          :title="$t('auth.privacy_title')"
          type="info"
          :description="$t('auth.privacy_desc')"
          show-icon
          :closable="false"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Lock, Platform, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import iconGithub from '@/shared/components/icons/iconGithub.vue'
import iconGoogle from '@/shared/components/icons/iconGoogle.vue'
import iconGitee from '@/shared/components/icons/iconGitee.vue'
import iconTelegram from '@/shared/components/icons/iconTelegram.vue'
import iconCloudflare from '@/shared/components/icons/iconCloudflare.vue'
import iconNodeloc from '@/shared/components/icons/iconNodeloc.vue'
import iconFingerprint from '@/shared/components/icons/iconFingerprint.vue'
import { useOAuthProviders } from '@/features/auth/composables/useOAuthProviders'
import { webAuthnService } from '@/features/auth/service/webAuthnService'
import { useAuthUserStore } from '@/features/auth/store/authUserStore'
import { setIdbItem } from '@/shared/utils/idb'

const { t } = useI18n()
const authUserStore = useAuthUserStore()

const iconComponents = {
  iconGithub,
  iconGoogle,
  iconGitee,
  iconTelegram,
  iconCloudflare,
  iconNodeloc,
}

const {
  providers,
  loadingProvider,
  isFetchingProviders,
  handleLogin
} = useOAuthProviders()

const loadingPasskey = ref(false)

const handlePasskeyLogin = async () => {
  if (!webAuthnService.isSupported()) {
    ElMessage.warning(t('auth.passkey_not_supported'))
    return
  }

  loadingPasskey.value = true
  try {
    const res = await webAuthnService.login()
    if (res.success) {
      // Passkey 登录逻辑与 OAuth 回调成功后一致
      await authUserStore.setUserInfo(res.userInfo)
      // 设备指纹 key (用于离线加密验证)
      if (res.deviceKey) {
        await setIdbItem('sys:sec:device_salt', res.deviceKey)
      }
      
      ElMessage.success(t('common.success'))
      window.location.href = '/'
    }
  } catch (error) {
    console.error('Passkey login failed:', error)
    // 错误在 Axios 拦截器中处理，这里仅做状态清理
  } finally {
    loadingPasskey.value = false
  }
}
</script>