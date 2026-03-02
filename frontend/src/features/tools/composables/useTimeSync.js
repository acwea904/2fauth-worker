import { ref, computed, onMounted, onUnmounted } from 'vue'
import { toolService } from '@/features/tools/service/toolService'

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
        if (abs < 2000) return { title: '时间同步正常', type: 'success', desc: '本地时间与服务器误差极小，不影响 2FA 验证。' }
        if (abs < 30000) return { title: '存在微小偏差', type: 'warning', desc: '建议校准本地时间，但通常仍可使用。' }
        return { title: '时间偏差过大', type: 'error', desc: '严重偏差！2FA 验证码将失效，请务必校准设备时间。' }
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
