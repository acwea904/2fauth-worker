import { defineStore } from 'pinia'
import { ref } from 'vue'
import { backupService } from '@/features/backup/service/backupService'

export const useBackupStore = defineStore('backup', () => {
    const providers = ref([])
    const isLoading = ref(false)
    const revokedProviderIds = ref(new Set())

    const fetchProviders = async () => {
        isLoading.value = true
        try {
            const res = await backupService.getProviders()
            if (res.success) {
                providers.value = res.providers || []
            }
        } catch (e) {
            console.error('[BackupStore] Failed to fetch providers:', e)
        } finally {
            isLoading.value = false
        }
    }

    const markAsRevoked = (providerId) => {
        revokedProviderIds.value.add(providerId)
    }

    const isRevoked = (providerId) => {
        return revokedProviderIds.value.has(providerId)
    }

    const updateProviderStatus = (providerId, status) => {
        const provider = providers.value.find(p => p.id === providerId)
        if (provider) {
            provider.status = status
            if (status === 'success') {
                revokedProviderIds.value.delete(providerId)
            }
        }
    }

    return {
        providers,
        isLoading,
        revokedProviderIds,
        fetchProviders,
        markAsRevoked,
        isRevoked,
        updateProviderStatus
    }
})
