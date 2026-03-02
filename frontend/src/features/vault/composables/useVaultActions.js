import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import QRCode from 'qrcode'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { vaultService } from '@/features/vault/service/vaultService'
import { copyToClipboard } from '@/shared/utils/common'

/**
 * 管理账号的增删改查与二维码展示等弹窗行为
 * @param {Function} fetchVault - 操作成功后用于刷新列表的回调
 * @param {import('vue').ShallowRef} vault - 当前账号列表（用于全选）
 * @returns Composable state and actions
 */
export function useVaultActions(fetchVault, vault) {
    const vaultStore = useVaultStore()

    // --- 批量操作 ---
    const selectedIds = ref([])
    const isBulkDeleting = ref(false)

    // --- 编辑弹窗 ---
    const showEditDialog = ref(false)
    const isEditing = ref(false)
    const editVaultData = ref({ id: '', service: '', account: '', category: '' })

    // --- 二维码弹窗 ---
    const showQrDialog = ref(false)
    const currentQrItem = ref(null)
    const showSecret = ref(false)
    const qrCodeUrl = ref('')

    // --- 批量删除 ---
    const handleBulkDelete = async () => {
        if (!selectedIds.value.length) return
        try {
            await ElMessageBox.confirm(
                `确定要删除选中的 ${selectedIds.value.length} 个账号吗？此操作不可恢复。`,
                '批量删除',
                { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
            )
            isBulkDeleting.value = true
            await vaultService.batchDelete(selectedIds.value)
            ElMessage.success(`已成功删除 ${selectedIds.value.length} 个账号`)
            selectedIds.value = []
            vaultStore.markDirty()
            fetchVault()
        } catch (e) {
            if (e !== 'cancel') console.error(e)
        } finally {
            isBulkDeleting.value = false
        }
    }

    const toggleSelection = (id) => {
        const idx = selectedIds.value.indexOf(id)
        if (idx > -1) {
            selectedIds.value.splice(idx, 1)
        } else {
            selectedIds.value.push(id)
        }
    }

    // Bug Fix: 全选已加载账号（直接访问 vault ref，无需跨 composable 传参）
    const selectAllLoaded = () => {
        if (vault?.value) {
            selectedIds.value = vault.value.map(acc => acc.id)
        }
    }

    // --- 复制 TOTP 代码 ---
    const copyCode = async (vaultItem) => {
        if (!vaultItem.currentCode || vaultItem.currentCode === '------') {
            return ElMessage.warning('验证码尚未生成，请稍候')
        }
        await copyToClipboard(vaultItem.currentCode, '验证码已复制')
    }

    // --- 编辑账号 ---
    const openEditDialog = (vaultItem) => {
        editVaultData.value = {
            id: vaultItem.id,
            service: vaultItem.service,
            account: vaultItem.account,
            category: vaultItem.category || ''
        }
        showEditDialog.value = true
    }

    const submitEditVault = async () => {
        isEditing.value = true
        try {
            const { id, ...updateData } = editVaultData.value
            const res = await vaultService.updateAccount(id, updateData)
            if (res.success) {
                ElMessage.success('账号信息已更新')
                showEditDialog.value = false
                vaultStore.markDirty()
                fetchVault()
            }
        } catch (e) {
            // Error is shown by request utility or vaultError handler
        } finally {
            isEditing.value = false
        }
    }

    // --- 删除单个账号 ---
    const deleteVault = async (vaultItem) => {
        try {
            await ElMessageBox.confirm(`确定要删除 ${vaultItem.service} 吗？`, '删除确认', {
                type: 'warning',
                confirmButtonText: '确认删除',
                cancelButtonText: '取消'
            })
            await vaultService.deleteAccount(vaultItem.id)
            ElMessage.success('账号已删除')
            vaultStore.markDirty()
            fetchVault()
        } catch (e) {
            if (e !== 'cancel') console.error(e)
        }
    }

    // --- 二维码导出 ---
    const openQrDialog = async (vaultItem) => {
        currentQrItem.value = vaultItem
        showSecret.value = false
        showQrDialog.value = true

        const algorithm = vaultItem.algorithm
            ? vaultItem.algorithm.replace('SHA', 'SHA-').replace('SHA--', 'SHA-')
            : 'SHA-1'
        const uri = `otpauth://totp/${encodeURIComponent(vaultItem.service)}:${encodeURIComponent(vaultItem.account)}?secret=${vaultItem.secret}&issuer=${encodeURIComponent(vaultItem.service)}&algorithm=${algorithm}&digits=${vaultItem.digits || 6}&period=${vaultItem.period || 30}`
        qrCodeUrl.value = await QRCode.toDataURL(uri, { width: 240, margin: 1 })
    }

    const copySecret = () => {
        if (currentQrItem.value) {
            copyToClipboard(currentQrItem.value.secret)
            ElMessage.success('密钥已复制到剪贴板')
        }
    }

    const copyOtpUrl = () => {
        if (currentQrItem.value) {
            const item = currentQrItem.value
            const algorithm = item.algorithm
                ? item.algorithm.replace('SHA', 'SHA-').replace('SHA--', 'SHA-')
                : 'SHA-1'
            const uri = `otpauth://totp/${encodeURIComponent(item.service)}:${encodeURIComponent(item.account)}?secret=${item.secret}&issuer=${encodeURIComponent(item.service)}&algorithm=${algorithm}&digits=${item.digits || 6}&period=${item.period || 30}`
            copyToClipboard(uri)
            ElMessage.success('OTP URI 已复制')
        }
    }

    const formatSecret = (secret) => {
        return (secret || '').match(/.{1,4}/g)?.join(' ') || secret
    }

    // --- 统一命令分发 ---
    const handleCommand = (cmd, vaultItem) => {
        if (cmd === 'edit') openEditDialog(vaultItem)
        else if (cmd === 'qr') openQrDialog(vaultItem)
        else if (cmd === 'delete') deleteVault(vaultItem)
    }

    return {
        selectedIds,
        isBulkDeleting,
        showEditDialog,
        isEditing,
        editVaultData,
        showQrDialog,
        currentQrItem,
        showSecret,
        qrCodeUrl,

        toggleSelection,
        selectAllLoaded,
        handleBulkDelete,
        copyCode,
        openEditDialog,
        submitEditVault,
        deleteVault,
        openQrDialog,
        copySecret,
        copyOtpUrl,
        formatSecret,
        handleCommand,
    }
}
