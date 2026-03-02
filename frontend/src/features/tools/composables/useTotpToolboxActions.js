import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import QRCode from 'qrcode'
import { vaultService } from '@/features/vault/service/vaultService'

/**
 * TOTP 工具箱外部协同调度逻辑
 * 
 * 架构说明: 
 * 专门处理工具箱产生的与外部 API / 库的桥接：如触发二维码生成库 QRCode，与后端 Vault 保存 API 进行联调。
 * 这保证了 useTotpToolbox.js 作为纯状态机，不涉及第三方 UI 或非标准 API 边界效应。
 */
export function useTotpToolboxActions(toolboxState, queryClient) {
    const isSaving = ref(false)
    const showScanner = ref(false)
    const qrCodeUrl = ref('')

    // 监听 currentUri 自动重绘二维码
    watch(() => toolboxState.currentUri.value, async (newUri) => {
        if (newUri) {
            try {
                qrCodeUrl.value = await QRCode.toDataURL(newUri, { width: 200, margin: 1 })
            } catch (e) {
                qrCodeUrl.value = ''
            }
        } else {
            qrCodeUrl.value = ''
        }
    })

    const handleScanSuccess = (uri) => {
        showScanner.value = false
        const success = toolboxState.handleParsedUri(uri)
        if (success) {
            ElMessage.success('二维码解析成功')
        } else {
            ElMessage.warning('无效的 OTP URI')
        }
    }

    const saveToVault = async () => {
        if (!toolboxState.secretBase32.value) return ElMessage.warning('密钥不能为空')
        if (!toolboxState.issuer.value || !toolboxState.account.value) return ElMessage.warning('请填写服务商和账号')

        isSaving.value = true
        try {
            const res = await vaultService.createAccount({
                service: toolboxState.issuer.value,
                account: toolboxState.account.value,
                secret: toolboxState.secretBase32.value,
                digits: toolboxState.digits.value,
                period: toolboxState.period.value,
                category: '工具箱添加'
            })
            if (res.success) {
                ElMessage.success('已保存到我的账户')
                // 刷新账号列表缓存
                queryClient.invalidateQueries(['vault'])
            }
        } catch (e) {
            // Error managed by axios request interceptor & vaultService wrapping
        } finally {
            isSaving.value = false
        }
    }

    return {
        isSaving,
        showScanner,
        qrCodeUrl,
        handleScanSuccess,
        saveToVault
    }
}
