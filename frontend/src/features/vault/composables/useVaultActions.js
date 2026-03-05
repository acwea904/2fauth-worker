import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import QRCode from 'qrcode'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { vaultService } from '@/features/vault/service/vaultService'
import { copyToClipboard } from '@/shared/utils/common'
import { i18n } from '@/locales'

/**
 * 管理账号的增删改查与二维码展示等弹窗行为
 * @param {Function} fetchVault - 操作成功后用于刷新列表的回调
 * @param {import('vue').ShallowRef} vault - 当前账号列表（用于全选）
 * @returns Composable state and actions
 */
export function useVaultActions(fetchVault, vault) {
    const vaultStore = useVaultStore()
    const { t } = i18n.global

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
                t('vault.delete_batch_confirm', { count: selectedIds.value.length }),
                t('common.delete'),
                { type: 'warning', confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel') }
            )
            isBulkDeleting.value = true
            await vaultService.batchDelete(selectedIds.value)
            ElMessage.success(t('vault.delete_batch_success', { count: selectedIds.value.length }))
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
            return ElMessage.warning(t('vault.not_generated_yet'))
        }
        await copyToClipboard(vaultItem.currentCode, t('vault.copy_success'))
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
                ElMessage.success(t('vault.update_success'))
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
            await ElMessageBox.confirm(t('vault.delete_confirm', { service: vaultItem.service }), t('common.delete'), {
                type: 'warning',
                confirmButtonText: t('common.delete'),
                cancelButtonText: t('common.cancel')
            })
            await vaultService.deleteAccount(vaultItem.id)
            ElMessage.success(t('vault.delete_success'))
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

        // otpauth URI spec: algorithm 参数不带横线，即 SHA1/SHA256/SHA512
        const algorithm = (vaultItem.algorithm || 'SHA1').replace(/-/g, '').toUpperCase()
        const uri = `otpauth://totp/${encodeURIComponent(vaultItem.service)}:${encodeURIComponent(vaultItem.account)}?secret=${encodeURIComponent(vaultItem.secret)}&issuer=${encodeURIComponent(vaultItem.service)}&algorithm=${algorithm}&digits=${vaultItem.digits || 6}&period=${vaultItem.period || 30}`
        qrCodeUrl.value = await QRCode.toDataURL(uri, { width: 240, margin: 1 })
    }

    const copySecret = () => {
        if (currentQrItem.value) {
            copyToClipboard(currentQrItem.value.secret)
            ElMessage.success(t('vault.copy_success'))
        }
    }

    const copyOtpUrl = () => {
        if (currentQrItem.value) {
            const item = currentQrItem.value
            const algorithm = (item.algorithm || 'SHA1').replace(/-/g, '').toUpperCase()
            const uri = `otpauth://totp/${encodeURIComponent(item.service)}:${encodeURIComponent(item.account)}?secret=${encodeURIComponent(item.secret)}&issuer=${encodeURIComponent(item.service)}&algorithm=${algorithm}&digits=${item.digits || 6}&period=${item.period || 30}`
            copyToClipboard(uri)
            ElMessage.success(t('vault.copy_success'))
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
