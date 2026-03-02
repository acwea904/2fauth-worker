import { ref, onMounted, onUnmounted } from 'vue'
import { base32ToBytes, bytesToBase32, hexToBytes, bytesToHex, asciiToBytes, bytesToAscii, generateTOTP, parseOtpUri } from '@/shared/utils/totp'

/**
 * 提取 TOTP 工具箱的状态机与计算逻辑
 * 
 * 架构说明 (Architecture Notes):
 * 1. 状态内聚: 将 Base32, Hex, ASCII 相互转换的逻辑和时间便宜量计算封入本 Hook。
 * 2. 分离视图: 使得 Vue 组件单纯负责数据绑定，不再关心 bytes 到 string 的转换细节和 setInterval 时序。
 * 
 * @returns 包含状态与操作方法的响应式对象
 */
export function useTotpToolbox() {
    const activeTab = ref('base32')
    const secretBase32 = ref('')
    const secretHex = ref('')
    const secretAscii = ref('')

    // Metadata & Settings
    const issuer = ref('2FAuth-Tool')
    const account = ref('TestUser')
    const algorithm = ref('SHA-1')
    const digits = ref(6)
    const period = ref(30)
    const timeOffset = ref(0)

    const currentUri = ref('')
    const currentCode = ref('')
    const remaining = ref(30)
    let timer = null

    // --- 同步输入联动 ---
    const updateAll = async (sourceType) => {
        try {
            // 1. 同步各类输入制式
            if (sourceType === 'base32') {
                const bytes = base32ToBytes(secretBase32.value)
                secretHex.value = bytesToHex(bytes)
                secretAscii.value = bytesToAscii(bytes)
            } else if (sourceType === 'hex') {
                const bytes = hexToBytes(secretHex.value)
                if (bytes.length > 0) secretBase32.value = bytesToBase32(bytes)
                secretAscii.value = bytesToAscii(bytes)
            } else if (sourceType === 'ascii') {
                const bytes = asciiToBytes(secretAscii.value)
                secretBase32.value = bytesToBase32(bytes)
                secretHex.value = bytesToHex(bytes)
            }

            // 2. URI 字符串拼接
            if (secretBase32.value) {
                const label = encodeURIComponent(`${issuer.value}:${account.value}`)
                const algoParam = algorithm.value.replace('-', '') // SHA-1 -> SHA1
                currentUri.value = `otpauth://totp/${label}?secret=${secretBase32.value}&issuer=${encodeURIComponent(issuer.value)}&algorithm=${algoParam}&period=${period.value}&digits=${digits.value}`
            } else {
                currentUri.value = ''
                currentCode.value = ''
            }

            // 3. 立即重算一次 TOTP
            calcTotp()
        } catch (e) {
            console.error(e)
            // 打字过程中的解码失败不做打断处理
        }
    }

    const handleBase32Input = () => updateAll('base32')
    const handleHexInput = () => updateAll('hex')
    const handleAsciiInput = () => updateAll('ascii')
    const updateUri = () => updateAll('settings')

    // --- 随机生成 ---
    const refreshBase32 = () => {
        const array = new Uint8Array(20)
        window.crypto.getRandomValues(array)
        secretBase32.value = bytesToBase32(array)
        updateAll('base32')
    }

    const refreshHex = () => {
        const array = new Uint8Array(20)
        window.crypto.getRandomValues(array)
        secretHex.value = bytesToHex(array)
        updateAll('hex')
    }

    const refreshAscii = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
        let result = ''
        const array = new Uint32Array(20)
        window.crypto.getRandomValues(array)
        for (let i = 0; i < 20; i++) result += chars[array[i] % chars.length]
        secretAscii.value = result
        updateAll('ascii')
    }

    // --- TOTP 主力计算核心 ---
    const calcTotp = async () => {
        if (!secretBase32.value) return

        const p = period.value
        // 加入时空穿梭偏移量
        const now = (Date.now() / 1000) + timeOffset.value
        remaining.value = Math.ceil(p - (now % p))

        try {
            const periodOffset = Math.floor(timeOffset.value / p)
            currentCode.value = await generateTOTP(secretBase32.value, p, digits.value, algorithm.value, periodOffset)
        } catch (e) {
            currentCode.value = 'ERROR'
        }
    }

    // --- 时间调节器 (Time Travel) ---
    const adjustTime = (delta, reset = false) => {
        if (reset) timeOffset.value = 0
        else timeOffset.value += delta
        calcTotp()
    }

    // --- 扫码解析注入 ---
    const handleParsedUri = (uri) => {
        const parsed = parseOtpUri(uri)
        if (parsed) {
            if (parsed.secret) {
                secretBase32.value = parsed.secret
                updateAll('base32')
            }
            if (parsed.service) issuer.value = parsed.service
            if (parsed.account) account.value = parsed.account
            if (parsed.digits) digits.value = parsed.digits
            if (parsed.period) period.value = parsed.period
            if (parsed.algorithm) algorithm.value = parsed.algorithm

            updateAll('settings')
            return true
        }
        return false
    }

    onMounted(() => {
        // 初始装载随机码
        refreshBase32()
        timer = setInterval(calcTotp, 1000)
    })

    onUnmounted(() => { if (timer) clearInterval(timer) })

    return {
        activeTab,
        secretBase32, secretHex, secretAscii,
        issuer, account, algorithm, digits, period, timeOffset,
        currentUri, currentCode, remaining,
        handleBase32Input, handleHexInput, handleAsciiInput, updateUri,
        refreshBase32, refreshHex, refreshAscii,
        adjustTime, handleParsedUri
    }
}
