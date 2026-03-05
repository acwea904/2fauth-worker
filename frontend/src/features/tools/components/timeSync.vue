<template>
  <div class="tool-pane">
    <div class="time-sync-container">
      <!-- 状态横幅 -->
      <el-alert
        v-if="syncStatus"
        :title="syncStatus.title"
        :type="syncStatus.type"
        :description="syncStatus.desc"
        show-icon
        :closable="false"
        style="margin-bottom: 20px;"
      />

      <!-- 时钟仪表盘 -->
      <div class="clocks-wrapper">
        <div class="clock-card local">
          <div class="clock-label">📱 {{ $t('tools.local_time') }}</div>
          <div class="clock-time">{{ formatTime(localTime) }}</div>
        </div>
        <div class="clock-card server">
          <div class="clock-label">☁️ {{ $t('tools.server_time') }}</div>
          <div class="clock-time">{{ formatTime(serverTime) }}</div>
        </div>
      </div>

      <!-- 详细数据 -->
      <div class="sync-details">
        <p>{{ $t('tools.time_offset') }}: <strong>{{ offset !== null ? `${offset > 0 ? '+' : ''}${offset} ms` : '--' }}</strong></p>
        <p>{{ $t('tools.network_latency') }}: <span>{{ rtt !== null ? `${rtt} ms` : '--' }}</span></p>
      </div>

      <el-button type="primary" size="large" :loading="isSyncing" @click="syncTime" style="width: 100%; margin-top: 20px;">
        <el-icon><Refresh /></el-icon> {{ $t('tools.check_now') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { useTimeSync } from '@/features/tools/composables/useTimeSync'
import { i18n } from '@/locales'

const {
  localTime,
  serverTime,
  offset,
  rtt,
  isSyncing,
  syncStatus,
  syncTime: _syncTime
} = useTimeSync()

const formatTime = (ts) => new Date(ts).toLocaleTimeString()
const { t } = i18n.global

const syncTime = async () => {
  const result = await _syncTime()
  if (result.success) {
    ElMessage.success(t('tools.sync_completed', { offset: result.offset }))
  } else {
    ElMessage.error(result.error?.message || t('api_errors.request_failed'))
  }
}

onMounted(() => {
  syncTime()
})
</script>