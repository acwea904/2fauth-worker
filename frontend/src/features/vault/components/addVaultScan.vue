<template>
  <div class="add-vault-wrapper">
    <div class="tab-card-wrapper">
      <h2 style="text-align: center; margin-bottom: 20px;">📷 扫码添加</h2>
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px; margin-top: 10px;">
          <p style="color: var(--el-text-color-secondary);">请允许浏览器使用摄像头，或直接上传微信/系统截图。</p>
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

const QrScanner = defineAsyncComponent(() => import('@/shared/components/qrScanner.vue'))

const emit = defineEmits(['success'])
const vaultStore = useVaultStore()

const handleScanSuccess = async (uri) => {
  try {
    const acc = parseOtpUri(uri)
    if (!acc) {
      ElMessage.error('二维码格式无效，请扫描有效的 OTP 二维码')
      return
    }

    await ElMessageBox.confirm(
      h('div', { style: 'text-align: left; background: var(--el-fill-color-light); padding: 16px; border-radius: 8px; border: 1px solid var(--el-border-color-lighter); margin-top: 10px;' }, [
        h('div', { style: 'margin-bottom: 12px; display: flex; align-items: center;' }, [
           h('span', { style: 'color: var(--el-text-color-secondary); width: 70px; flex-shrink: 0;' }, '服务方'),
           h('span', { style: 'font-weight: 600; font-size: 15px; color: var(--el-text-color-primary); word-break: break-all;' }, acc.service || '未指定服务')
        ]),
        h('div', { style: 'margin-bottom: 12px; display: flex; align-items: center;' }, [
           h('span', { style: 'color: var(--el-text-color-secondary); width: 70px; flex-shrink: 0;' }, '账　号'),
           h('span', { style: 'font-family: monospace; font-size: 14px; background: var(--el-fill-color-darker); padding: 4px 8px; border-radius: 6px; color: var(--el-color-primary); word-break: break-all;' }, acc.account || '未命名账号')
        ]),
        h('div', { style: 'display: flex; align-items: center;' }, [
           h('span', { style: 'color: var(--el-text-color-secondary); width: 70px; flex-shrink: 0;' }, '参　数'),
           h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' }, [
               h('span', { style: 'background: var(--el-color-info-light-9); color: var(--el-color-info); border: 1px solid var(--el-color-info-light-7); padding: 2px 8px; border-radius: 4px; font-size: 12px;' }, acc.algorithm || 'SHA1'),
               h('span', { style: 'background: var(--el-color-success-light-9); color: var(--el-color-success); border: 1px solid var(--el-color-success-light-7); padding: 2px 8px; border-radius: 4px; font-size: 12px;' }, `${acc.digits || 6}位`),
               h('span', { style: 'background: var(--el-color-warning-light-9); color: var(--el-color-warning); border: 1px solid var(--el-color-warning-light-7); padding: 2px 8px; border-radius: 4px; font-size: 12px;' }, `${acc.period || 30}秒`)
           ])
        ])
      ]),
      '二维码解析成功，确认添加？',
      {
        confirmButtonText: '确认添加',
        cancelButtonText: '取消',
        type: 'success',
        center: true
      }
    )

    const addData = await vaultService.addFromUri(uri, '手机扫码')

    if (addData.success) {
      ElMessage.success('扫码账号添加成功！')
      vaultStore.markDirty() // 实际写入数据，标记缓存过期
      emit('success')
    }
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}
</script>