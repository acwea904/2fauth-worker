import { ref, computed, watch } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { dataMigrationService } from '@/features/migration/service/dataMigrationService'
import { useVaultStore } from '@/features/vault/store/vaultStore'

export function useDataImport(emitFn) {
    const vaultStore = useVaultStore()

    // --- State ---
    const currentFileContent = ref('')
    const currentFile = ref(null)
    const currentImportType = ref('')
    const showDecryptDialog = ref(false)
    const importPassword = ref('')
    const importingJobs = ref(0)
    const isImporting = computed(() => importingJobs.value > 0)
    const isDecrypting = ref(false)
    const isDialogHandled = ref(false)

    // Batch properties
    const batchTotalJobs = ref(0)
    const batchProcessedJobs = ref(0)
    const batchAccumulatedVault = ref([])
    const batchErrors = ref([])
    const batchCurrentTaskName = ref('')
    const showBatchProgress = ref(false)
    const batchProgressPercent = computed(() => {
        if (batchTotalJobs.value === 0) return 0
        return Math.floor((batchProcessedJobs.value / batchTotalJobs.value) * 100)
    })

    let finalizeTimer = null

    // --- Watchers ---
    watch(importingJobs, (newVal) => {
        if (newVal === 0 && batchTotalJobs.value > 0 && !showDecryptDialog.value) {
            if (finalizeTimer) clearTimeout(finalizeTimer)
            finalizeTimer = setTimeout(() => {
                finishBatchImport()
            }, 300)
        }
    })

    // --- Core Logic ---
    const initBatchTask = (taskCount) => {
        if (batchTotalJobs.value === 0) {
            batchAccumulatedVault.value = []
            batchErrors.value = []
            showBatchProgress.value = true
        }
        importingJobs.value += taskCount
        batchTotalJobs.value += taskCount
    }

    const resetBatchState = () => {
        batchTotalJobs.value = 0
        batchProcessedJobs.value = 0
        importingJobs.value = 0
        batchAccumulatedVault.value = []
        batchErrors.value = []
        batchCurrentTaskName.value = ''
        phoneFactorGroup.value = { main: null, wal: null, shm: null }
    }

    // PhoneFactor specialized grouping
    const phoneFactorGroup = ref({ main: null, wal: null, shm: null })
    let phoneFactorTimer = null

    const processPhoneFactorGroup = async () => {
        const group = { ...phoneFactorGroup.value }
        phoneFactorGroup.value = { main: null, wal: null, shm: null } // reset

        let groupedCount = 0;
        if (group.main) groupedCount++;
        if (group.wal) groupedCount++;
        if (group.shm) groupedCount++;

        // We only proceed if we have at least *something*
        if (groupedCount === 0) return

        batchCurrentTaskName.value = '构建数据：PhoneFactor 数据集'
        try {
            // we pass the entire group object to the service
            const vault = await dataMigrationService.parseImportData(group, 'phonefactor_group')
            batchAccumulatedVault.value.push(...vault)
        } catch (err) {
            console.error('[PhoneFactor Group] parseImportData failed:', err)
            const detail = err && err.message ? err.message : String(err)
            batchErrors.value.push(`[PhoneFactor] 解析失败: ${detail}`)
        } finally {
            batchProcessedJobs.value += groupedCount
            importingJobs.value -= groupedCount
        }
    }

    const handleFileUpload = async (uploadFile) => {
        const file = uploadFile.raw
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            ElMessage.error(`文件 ${file.name} 太大，不能超过 10MB`)
            return
        }

        initBatchTask(1)
        batchCurrentTaskName.value = `准备解析：${file.name}`

        if (file.type.startsWith('image/')) {
            await handleImageFile(file)
        } else {
            handleNonImageFile(file)
        }
    }

    const handleImageFile = async (file) => {
        try {
            batchCurrentTaskName.value = `截取图中二维码：${file.name}`
            const vault = await dataMigrationService.parseGaQrImageFile(file)
            batchAccumulatedVault.value.push(...vault)
        } catch (err) {
            console.error(err)
            batchErrors.value.push(`[${file.name}] 解析图片失败: ${err.message}`)
        } finally {
            batchProcessedJobs.value++
            importingJobs.value--
        }
    }

    const handleNonImageFile = (file) => {
        try {
            // First pass check for PhoneFactor by filename, buffer them
            const fname = file.name.toLowerCase()
            if (fname === 'phonefactor' || fname === 'phonefactor-wal' || fname === 'phonefactor-shm') {
                const reader = new FileReader()
                reader.onload = (event) => {
                    const buffer = event.target.result
                    if (fname === 'phonefactor') phoneFactorGroup.value.main = { name: file.name, buffer }
                    else if (fname === 'phonefactor-wal') phoneFactorGroup.value.wal = { name: file.name, buffer }
                    else if (fname === 'phonefactor-shm') phoneFactorGroup.value.shm = { name: file.name, buffer }

                    // Debounce group execution
                    if (phoneFactorTimer) clearTimeout(phoneFactorTimer)
                    phoneFactorTimer = setTimeout(() => {
                        processPhoneFactorGroup()
                    }, 500)
                }
                reader.onerror = () => {
                    batchErrors.value.push(`[${file.name}] 读取失败`)
                    batchProcessedJobs.value++
                    importingJobs.value--
                }
                reader.readAsArrayBuffer(file)
                return
            }

            currentFile.value = file
            const reader = new FileReader()

            // 无论文件名为何，都先读取成二进制，再由 detectFileType 判断类型
            reader.onload = async (event) => {
                const buffer = event.target.result
                currentFileContent.value = buffer

                const detectedType = dataMigrationService.detectFileType(buffer, file.name)
                currentImportType.value = detectedType

                if (detectedType === 'unknown') {
                    batchErrors.value.push(`[${file.name}] 无法识别该文件格式。`)
                    batchProcessedJobs.value++
                    importingJobs.value--
                    return
                }

                let contentForParse = buffer
                if (detectedType !== 'phonefactor') {
                    try {
                        contentForParse = new TextDecoder().decode(buffer)
                    } catch {
                        // fallback to array buffer if decoding fails; service handles it
                    }
                }

                if (detectedType === 'encrypted' || detectedType === 'aegis_encrypted' || detectedType === 'proton_encrypted' || detectedType === '2fas_encrypted') {
                    importPassword.value = ''
                    isDialogHandled.value = false
                    showDecryptDialog.value = true
                    // keep job active until unblocked by decrypt action
                    currentFileContent.value = contentForParse
                    return
                }

                batchCurrentTaskName.value = `构建数据：${file.name}`
                try {
                    const vault = await dataMigrationService.parseImportData(contentForParse, detectedType)
                    batchAccumulatedVault.value.push(...vault)
                } catch (err) {
                    console.error(`[${file.name}] parseImportData failed:`, err)
                    const detail = err && err.message ? err.message : String(err)
                    batchErrors.value.push(`[${file.name}] 解析失败: ${detail}`)
                } finally {
                    batchProcessedJobs.value++
                    importingJobs.value--
                }
            }

            reader.onerror = () => {
                batchErrors.value.push(`[${file.name}] 读取失败`)
                batchProcessedJobs.value++
                importingJobs.value--
            }

            reader.readAsArrayBuffer(file)

        } catch (error) {
            console.error(error)
            batchErrors.value.push(`[${file.name}] 读取异常`)
            batchProcessedJobs.value++
            importingJobs.value--
        }
    }

    const submitEncryptedData = async () => {
        if (!importPassword.value) {
            return ElMessage.warning('请输入解密密码')
        }

        isDecrypting.value = true
        try {
            batchCurrentTaskName.value = '正在使用密码解密数据...'
            const vault = await dataMigrationService.parseImportData(
                currentFileContent.value,
                currentImportType.value,
                importPassword.value
            )
            isDialogHandled.value = true
            showDecryptDialog.value = false
            batchAccumulatedVault.value.push(...vault)
            batchProcessedJobs.value++
            importingJobs.value--
        } catch (error) {
            console.error(error)
            ElMessage.error(`解密失败：密码错误或不支持加密标准`)
        } finally {
            isDecrypting.value = false
        }
    }

    const handleDecryptDialogClose = () => {
        if (!isDialogHandled.value) {
            batchErrors.value.push(`[${currentFile.value?.name || '加密文件'}] 用户取消密码输入`)
            batchProcessedJobs.value++
            importingJobs.value--
            isDialogHandled.value = true
        }
    }

    const finishBatchImport = async () => {
        if (batchAccumulatedVault.value.length === 0) {
            showBatchProgress.value = false
            if (batchErrors.value.length > 0) {
                ElNotification({
                    title: '导入异常',
                    message: batchErrors.value.join('<br>'),
                    type: 'error',
                    dangerouslyUseHTMLString: true,
                    duration: 0
                })
            } else {
                ElMessage.warning('没有可导入的有效账户数据')
            }
            resetBatchState()
            return
        }

        // 先在前端做简单的去重处理（大小写/空格不敏感），避免重复发送相同条目
        const normalize = (s, a) => `${(s || '').toString().trim().toLowerCase()}:${(a || '').toString().trim().toLowerCase()}`;
        const seen = new Set();
        const filteredVault = [];
        for (const acc of batchAccumulatedVault.value) {
            const sig = normalize(acc.service, acc.account);
            if (!seen.has(sig)) {
                seen.add(sig);
                filteredVault.push(acc);
            }
        }
        batchAccumulatedVault.value = filteredVault;
        batchCurrentTaskName.value = `合并保存中... (${batchAccumulatedVault.value.length} 个账号)`

        try {
            const data = await dataMigrationService.saveImportedVault(batchAccumulatedVault.value)
            showBatchProgress.value = false

            if (data.success) {
                let msgHtml = `<div>共处理 <b>${batchTotalJobs.value}</b> 个文件。</div>`
                if (data.count > 0) {
                    msgHtml += `<div style="color:var(--el-color-success)">🎉 成功导入 <b>${data.count}</b> 个新账户！</div>`
                } else {
                    msgHtml += `<div style="color:var(--el-color-warning)">⚠️ 导入账户皆已存在，无需添加。</div>`
                }

                if (data.duplicates > 0) msgHtml += `<div style="color:var(--el-text-color-secondary)">ℹ️ 自动跳过了 <b>${data.duplicates}</b> 个已拥有的账户。</div>`

                if (batchErrors.value.length > 0) {
                    msgHtml += `<div style="color:var(--el-color-danger); margin-top: 5px;">❌ <b>错误摘要：</b><br>${batchErrors.value.join('<br>')}</div>`
                }

                ElNotification({
                    title: '批量导入结束',
                    message: msgHtml,
                    dangerouslyUseHTMLString: true,
                    type: batchErrors.value.length > 0 ? 'warning' : 'success',
                    duration: batchErrors.value.length > 0 ? 0 : 8000
                })

                if (data.count > 0) {
                    vaultStore.markDirty()
                    emitFn('success')
                }
            } else {
                ElMessage.error(`后端合并保存失败，请检查网络`)
            }
        } catch (err) {
            showBatchProgress.value = false
            ElMessage.error(`最终保存异常：${err.message}`)
        } finally {
            resetBatchState()
        }
    }

    return {
        // State
        currentImportType,
        showDecryptDialog,
        importPassword,
        isDecrypting,
        showBatchProgress,
        batchCurrentTaskName,
        batchProcessedJobs,
        batchTotalJobs,
        batchProgressPercent,
        // Handlers
        handleFileUpload,
        submitEncryptedData,
        handleDecryptDialogClose
    }
}
