import { defineStore } from 'pinia'
import { ref } from 'vue'
import { encryptDataWithPassword, decryptDataWithPassword } from '@/shared/utils/crypto'
import { getIdbItem, setIdbItem } from '@/shared/utils/idb'

export const useVaultStore = defineStore('vault', () => {
  const isUnlocked = ref(true) // 默认挂载状态
  const hasVault = ref(false)
  const isDirty = ref(false) // 标记缓存是否已因变更操作而过期

  // 初始化检查
  const init = async () => {
    const encrypted = await getIdbItem('vault:data:main')
    hasVault.value = !!encrypted
  }

  // 获取本地运行时参数
  const getDeviceKey = async () => {
    try {
      return await getIdbItem('sys:sec:device_salt')
    } catch (e) {
      return null
    }
  }

  // 加载数据
  const getData = async () => {
    const key = await getDeviceKey()
    if (!key) throw new Error('设备授权信息已失效，请重新登录')

    const encrypted = await getIdbItem('vault:data:main')
    if (!encrypted) return { vault: [] }

    try {
      return await decryptDataWithPassword(encrypted, key)
    } catch (e) {
      // 若解密失败（极少情况如果用户清库或密钥被篡改），强行回退给空库
      return { vault: [] }
    }
  }

  // 持久化数据
  const saveData = async (data) => {
    const key = await getDeviceKey()
    if (!key) throw new Error('设备授权信息已失效，请重新登录')
    const encrypted = await encryptDataWithPassword(data, key)
    await setIdbItem('vault:data:main', encrypted)
    hasVault.value = true
  }

  // --- 备份云配置的专属加密缓存 ---
  const getEncryptedBackupProviders = async () => {
    const key = await getDeviceKey()
    if (!key) return null
    const encrypted = await getIdbItem('vault:conf:backups')
    if (!encrypted) return null
    try {
      const decrypted = await decryptDataWithPassword(encrypted, key)
      return decrypted.providers || null
    } catch (e) {
      return null
    }
  }

  const saveEncryptedBackupProviders = async (providers) => {
    const key = await getDeviceKey()
    if (!key) return
    const encrypted = await encryptDataWithPassword({ providers }, key)
    await setIdbItem('vault:conf:backups', encrypted)
  }

  // 残留供部分旧UI避免报错的空函数 (即将被清理)
  const unlock = async () => { return true }
  const setup = async () => { }
  const lock = () => { }

  return {
    isUnlocked,
    hasVault,
    isDirty,
    init,
    unlock,
    setup,
    lock,
    getData,
    markDirty: () => { isDirty.value = true },
    clearDirty: () => { isDirty.value = false },
    saveData,
    getEncryptedBackupProviders,
    saveEncryptedBackupProviders
  }
})