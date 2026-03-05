<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <div class="logo-container">
        <el-icon :size="54" color="#409EFC"><Lock /></el-icon>
        <h2>2FAuth Worker</h2>
        <p class="subtitle">{{ $t('auth.subtitle') }}</p>
      </div>

      <div class="action-container">
        <template v-for="provider in providers" :key="provider.id">
          <el-button
            type="primary"
            size="large"
            class="oauth-btn"
            :style="{ backgroundColor: provider.color, borderColor: provider.color }"
            :loading="loadingProvider === provider.id"
            :disabled="!!loadingProvider && loadingProvider !== provider.id"
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
import { Lock, Platform } from '@element-plus/icons-vue'
import iconGithub from '@/shared/components/icons/iconGithub.vue'
import iconGoogle from '@/shared/components/icons/iconGoogle.vue'
import iconGitee from '@/shared/components/icons/iconGitee.vue'
import iconTelegram from '@/shared/components/icons/iconTelegram.vue'
import iconCloudflare from '@/shared/components/icons/iconCloudflare.vue'
import iconNodeloc from '@/shared/components/icons/iconNodeloc.vue'
import { useOAuthProviders } from '@/features/auth/composables/useOAuthProviders'

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
  handleLogin
} = useOAuthProviders()
</script>