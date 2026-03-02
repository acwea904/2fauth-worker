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
          <div class="clock-label">📱 本地设备时间</div>
          <div class="clock-time">{{ formatTime(localTime) }}</div>
        </div>
        <div class="clock-card server">
          <div class="clock-label">☁️ 服务器时间 (估算)</div>
          <div class="clock-time">{{ formatTime(serverTime) }}</div>
        </div>
      </div>

      <!-- 详细数据 -->
      <div class="sync-details">
        <p>时间偏差: <strong>{{ offset !== null ? `${offset > 0 ? '+' : ''}${offset} ms` : '--' }}</strong></p>
        <p>网络延迟: <span>{{ rtt !== null ? `${rtt} ms` : '--' }}</span></p>
      </div>

      <el-button type="primary" size="large" :loading="isSyncing" @click="syncTime" style="width: 100%; margin-top: 20px;">
        <el-icon><Refresh /></el-icon> 立即检测
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { useTimeSync } from '@/features/tools/composables/useTimeSync'

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

const syncTime = async () => {
  const result = await _syncTime()
  if (result.success) {
    ElMessage.success(`校准完成，偏差 ${result.offset}ms`)
  } else {
    ElMessage.error(result.error?.message || '无法连接服务器')
  }
}

onMounted(() => {
  syncTime()
})
</script>