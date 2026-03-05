<template>
  <div class="add-vault-wrapper">
    <div class="tab-card-wrapper">
      <h2 style="text-align: center; margin-bottom: 20px;">📷 {{ $t('vault.scan_qr') }}</h2>
      <div style="max-width: 100%; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px; margin-top: 10px;">
          <p style="color: var(--el-text-color-secondary);">{{ $t('vault.scan_camera_tip') }}</p>
        </div>
        <QrScanner @scan-success="handleScanSuccess" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { h, defineAsyncComponent } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { parseOtpUri } from '@/shared/utils/totp'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { vaultService } from '@/features/vault/service/vaultService'
import { i18n } from '@/locales'

const QrScanner = defineAsyncComponent(() => import('@/shared/components/qrScanner.vue'))

const emit = defineEmits(['success'])
const vaultStore = useVaultStore()
const { t } = i18n.global

const handleScanSuccess = async (uri) => {
  try {
    const acc = parseOtpUri(uri)
    if (!acc) {
      ElMessage.error(t('vault.invalid_qr_format'))
      return
    }

    await ElMessageBox.confirm(
      h('div', { style: 'text-align: left; background: var(--el-fill-color-light); padding: 16px; border-radius: 8px; border: 1px solid var(--el-border-color-lighter); margin-top: 10px;' }, [
        h('div', { style: 'margin-bottom: 12px; display: flex; align-items: center;' }, [
           h('span', { style: 'color: var(--el-text-color-secondary); width: 70px; flex-shrink: 0;' }, t('vault.service_label')),
           h('span', { style: 'font-weight: 600; font-size: 15px; color: var(--el-text-color-primary); word-break: break-all;' }, acc.service || t('vault.unknown_service'))
        ]),
        h('div', { style: 'margin-bottom: 12px; display: flex; align-items: center;' }, [
           h('span', { style: 'color: var(--el-text-color-secondary); width: 70px; flex-shrink: 0;' }, t('vault.account_label')),
           h('span', { style: 'font-family: monospace; font-size: 14px; background: var(--el-fill-color-darker); padding: 4px 8px; border-radius: 6px; color: var(--el-color-primary); word-break: break-all;' }, acc.account || t('vault.unnamed_account'))
        ]),
        h('div', { style: 'display: flex; align-items: center;' }, [
           h('span', { style: 'color: var(--el-text-color-secondary); width: 70px; flex-shrink: 0;' }, t('vault.param_label')),
           h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' }, [
               h('span', { style: 'background: var(--el-color-info-light-9); color: var(--el-color-info); border: 1px solid var(--el-color-info-light-7); padding: 2px 8px; border-radius: 4px; font-size: 12px;' }, acc.algorithm || 'SHA1'),
               h('span', { style: 'background: var(--el-color-success-light-9); color: var(--el-color-success); border: 1px solid var(--el-color-success-light-7); padding: 2px 8px; border-radius: 4px; font-size: 12px;' }, `${acc.digits || 6}${t('vault.digits_suffix')}`),
               h('span', { style: 'background: var(--el-color-warning-light-9); color: var(--el-color-warning); border: 1px solid var(--el-color-warning-light-7); padding: 2px 8px; border-radius: 4px; font-size: 12px;' }, `${acc.period || 30}${t('vault.period_suffix')}`)
           ])
        ])
      ]),
      t('vault.confirm_add_title'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'success',
        center: true
      }
    )

    const addData = await vaultService.addFromUri(uri, 'Scan')

    if (addData.success) {
      ElMessage.success(t('vault.add_success'))
      vaultStore.markDirty() // 实际写入数据，标记缓存过期
      emit('success')
    }
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}
</script>