import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { dataMigrationService } from '@/features/migration/service/dataMigrationService'
import { downloadBlob } from '@/shared/utils/common'

export function useDataExport() {
    const showPasswordDialog = ref(false)
    const showWarningDialog = ref(false)
    const showGaDialog = ref(false)
    const isExporting = ref(false)
    const exportForm = ref({ password: '', confirm: '' })
    const loadingText = ref('')

    const currentType = ref('')
    const currentVariant = ref('generic')

    // GA 分批导出相关
    const gaQrDataUrls = ref([])
    const gaCurrentIndex = ref(0)

    // GA 按需导出选择器相关
    const showAccountSelectDialog = ref(false)
    const fullVault = ref([])
    const searchKeyword = ref('')
    const selectedAccountIds = ref([])

    const openExportDialog = (type, variant = 'generic') => {
        currentType.value = type
        currentVariant.value = variant
        exportForm.value = { password: '', confirm: '' }
        showPasswordDialog.value = true
    }

    const openWarningDialog = (type, variant = 'generic') => {
        currentType.value = type
        currentVariant.value = variant
        showWarningDialog.value = true
    }

    // 计算属性：过滤后的账号列表
    const filteredVault = computed(() => {
        const keyword = searchKeyword.value.toLowerCase().trim()
        if (!keyword) return fullVault.value
        return fullVault.value.filter(acc =>
            (acc.service && acc.service.toLowerCase().includes(keyword)) ||
            (acc.account && acc.account.toLowerCase().includes(keyword))
        )
    })

    // 直接开启 Google Auth 导出流程（跳过明文警告弹窗）
    const openGaDialogDirectly = () => {
        currentType.value = 'gauth'
        executeExport()
    }

    // 全选/取消全选 (仅作用于当前过滤结果)
    const toggleSelectAll = (val) => {
        const filteredIds = filteredVault.value.map(acc => acc.id)
        if (val) {
            // 将不在已选列表中的过滤结果加入已选列表
            const newIds = filteredIds.filter(id => !selectedAccountIds.value.includes(id))
            selectedAccountIds.value.push(...newIds)
        } else {
            // 将过滤结果从已选列表中移除
            selectedAccountIds.value = selectedAccountIds.value.filter(id => !filteredIds.includes(id))
        }
    }

    const executeExport = async () => {
        const type = currentType.value
        const variant = currentVariant.value
        let password = ''

        if (type === 'encrypted') {
            if (exportForm.value.password !== exportForm.value.confirm) {
                return ElMessage.error('两次输入的密码不一致！')
            }
            if (exportForm.value.password.length < 12) {
                return ElMessage.error('密码太弱！至少需要 12 个字符。')
            }
            password = exportForm.value.password
        }

        isExporting.value = true
        showPasswordDialog.value = false
        showWarningDialog.value = false

        try {
            loadingText.value = '正在获取账号数据...'
            const vault = await dataMigrationService.fetchAllVault()
            if (!vault || vault.length === 0) {
                throw new Error('没有可导出的账号')
            }

            loadingText.value = type === 'encrypted' ? '正在加密...' : '正在生成导出文件...'

            // 特殊处理 Google Auth (不再直接生成，而是进入选择界面)
            if (type === 'gauth') {
                fullVault.value = vault
                // 默认全不选 (由用户的偏好修改)
                selectedAccountIds.value = []
                searchKeyword.value = ''
                showAccountSelectDialog.value = true
                isExporting.value = false
                return
            }

            // 特殊处理 HTML 报告导出
            if (type === 'html') {
                const htmlContent = await dataMigrationService.exportAsHtml(vault)
                downloadBlob(htmlContent, `2fa-backup-report-${new Date().toISOString().split('T')[0]}.html`, 'text/html')
                ElMessage.success('导出完成！请在浏览器中打开该文件。')
                isExporting.value = false
                return
            }

            const fileContent = await dataMigrationService.exportData(vault, type, password, variant)

            let filename, mimeType
            const date = new Date().toISOString().split('T')[0]

            switch (type) {
                case 'text':
                    mimeType = 'text/plain'
                    filename = `2fa-export-otpauth-${date}.txt`
                    break
                case 'csv':
                    mimeType = 'text/csv'
                    filename = `2fa-export-csv-${date}.csv`
                    break
                case 'bwauth':
                    mimeType = 'application/json'
                    filename = `2fa-export-bwauth-${date}.json`
                    break
                case '2fas':
                    mimeType = 'application/json'
                    filename = `2fa-export-2fas-${date}.2fas`
                    break
                case 'generic_json':
                    mimeType = 'application/json'
                    filename = `2fa-export-generic-json-${date}.json`
                    break
                default:
                    // Covers 'encrypted', 'json', 'aegis'
                    mimeType = 'application/json'
                    filename = `2fa-export-${type}-${date}.json`
                    break
            }

            downloadBlob(fileContent, filename, mimeType)
            ElMessage.success('导出成功！')
        } catch (error) {
            console.error('Export failed:', error)
            ElMessage.error(error.message || '导出失败，请稍后重试')
        } finally {
            isExporting.value = false
        }
    }

    // 执行生成所选的 Google Auth 二维码
    const executeGaExport = async () => {
        if (selectedAccountIds.value.length === 0) {
            return ElMessage.warning('请至少选择一个账号')
        }

        isExporting.value = true
        showAccountSelectDialog.value = false
        loadingText.value = '正在生成二维码...'

        try {
            const selectedVault = fullVault.value.filter(acc => selectedAccountIds.value.includes(acc.id))
            showGaDialog.value = true
            gaQrDataUrls.value = []
            gaCurrentIndex.value = 0
            gaQrDataUrls.value = await dataMigrationService.exportAsGaMigration(selectedVault)
        } catch (error) {
            console.error('GA Export failed:', error)
            ElMessage.error(error.message || '生成二维码失败')
        } finally {
            isExporting.value = false
        }
    }

    return {
        // State
        showPasswordDialog,
        showWarningDialog,
        showAccountSelectDialog,
        showGaDialog,
        isExporting,
        exportForm,
        loadingText,
        gaQrDataUrls,
        gaCurrentIndex,
        fullVault,
        searchKeyword,
        selectedAccountIds,
        filteredVault,

        // Methods
        openExportDialog,
        openWarningDialog,
        openGaDialogDirectly,
        executeExport,
        executeGaExport,
        toggleSelectAll
    }
}
