import { ref, computed, onMounted, onUnmounted } from 'vue'
import { toolService } from '@/features/tools/service/toolService'
import { i18n } from '@/locales'

/**
 * 时间校准逻辑提取
 * 
 * @returns {Object} 包含校准状态与方法的响应式对象
 */
export function useTimeSync() {
    const localTime = ref(Date.now())
    const offset = ref(null)
    const rtt = ref(null)
    const isSyncing = ref(false)
    let clockTimer = null

    const serverTime = computed(() => localTime.value + (offset.value || 0))

    const syncStatus = computed(() => {
        if (offset.value === null) return null
        const abs = Math.abs(offset.value)
        const { t } = i18n.global
        if (abs < 2000) return { title: t('tools.sync_normal'), type: 'success', desc: t('tools.sync_normal_desc') }
        if (abs < 30000) return { title: t('tools.sync_warning'), type: 'warning', desc: t('tools.sync_warning_desc') }
        return { title: t('tools.sync_error'), type: 'error', desc: t('tools.sync_error_desc') }
    })

    const syncTime = async () => {
        isSyncing.value = true
        const start = Date.now()
        try {
            const res = await toolService.getServerTime()
            const end = Date.now()
            if (res.success) {
                const serverTs = res.time
                rtt.value = end - start
                // 假设往返时间是对称的，服务器返回时间为收到请求时的 serverTs + 单程网络延迟
                const estimatedServerTime = serverTs + (rtt.value / 2)
                offset.value = Math.round(estimatedServerTime - end)
                return { success: true, offset: offset.value }
            }
            return { success: false, error: new Error('返回结构异常') }
        } catch (error) {
            return { success: false, error }
        } finally {
            isSyncing.value = false
        }
    }

    onMounted(() => {
        clockTimer = setInterval(() => { localTime.value = Date.now() }, 1000)
    })

    onUnmounted(() => {
        if (clockTimer) clearInterval(clockTimer)
    })

    return {
        localTime,
        serverTime,
        offset,
        rtt,
        isSyncing,
        syncStatus,
        syncTime
    }
}
