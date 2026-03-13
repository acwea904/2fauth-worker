import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '@/features/auth/service/authService'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { setIdbItem, getIdbItem, removeIdbItem } from '@/shared/utils/idb'

export const useAuthUserStore = defineStore('authUserInfo', () => {
  const userInfo = ref({})

  const setUserInfo = async (info) => {
    userInfo.value = info
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
      setUserInfo(data.userInfo)
      return true
    } else {
      await clearUserInfo()
      return false
    }
  }

  return {
    userInfo,
    setUserInfo,
    clearUserInfo,
    logout,
    fetchUserInfo,
    init
  }
})