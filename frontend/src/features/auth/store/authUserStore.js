import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '@/features/auth/service/authService'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { setIdbItem, getIdbItem, removeIdbItem } from '@/shared/utils/idb'

export const useAuthUserStore = defineStore('authUserInfo', () => {
  const userInfo = ref({})
  const needsEmergency = ref(false)
  const tempEncryptionKey = ref('')

  const setUserInfo = async (info, emergency = false, key = '') => {
    userInfo.value = info
    needsEmergency.value = emergency
    tempEncryptionKey.value = key
    await setIdbItem('auth:user:profile', info)
  }

  const init = async () => {
    const stored = await getIdbItem('auth:user:profile')
    if (stored) {
      userInfo.value = stored
    }
  }

  const clearUserInfo = async () => {
    userInfo.value = {}
    needsEmergency.value = false
    tempEncryptionKey.value = ''
    await removeIdbItem('auth:user:profile')
    await removeIdbItem('vault:data:main')
    await removeIdbItem('vault:conf:backups')
    await removeIdbItem('sys:sec:device_salt')

    const vaultStore = useVaultStore()
    vaultStore.lock()
  }

  const logout = async () => {
    await authService.logout()
    await clearUserInfo()
  }

  const fetchUserInfo = async () => {
    const data = await authService.fetchMe()
    if (data && data.success) {
      // NOTE: fetchMe might not return needsEmergency as it's only returned during login callback
      // but we might want the server to actually keep track of this in the session if possible.
      // For now, it's primarily used during initial login pulse.
      await setUserInfo(data.userInfo, !!data.needsEmergency, data.encryptionKey || '')
      return true
    } else {
      await clearUserInfo()
      return false
    }
  }

  return {
    userInfo,
    needsEmergency,
    tempEncryptionKey,
    setUserInfo,
    clearUserInfo,
    logout,
    fetchUserInfo,
    init
  }
})