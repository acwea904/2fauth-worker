import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '@/features/auth/service/authService'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { removeIdbItem } from '@/shared/utils/idb'

export const useAuthUserStore = defineStore('authUserInfo', () => {
  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}')
    } catch (e) {
      return {}
    }
  }

  const userInfo = ref(getStoredUser())

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  const clearUserInfo = async () => {
    userInfo.value = {}
    localStorage.removeItem('userInfo')
    localStorage.removeItem('secure_vault')
    localStorage.removeItem('backup_providers_cache')

    // 清理本地持久化运行配置
    try {
      await removeIdbItem('device_salt')
    } catch (e) {
      console.error('Failed to remove device_salt from IDB', e)
    }

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
    fetchUserInfo
  }
})