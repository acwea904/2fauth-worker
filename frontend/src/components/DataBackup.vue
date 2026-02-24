<template>
  <div class="data-backup-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>云端备份中心</h2>
        <p style="color: #909399;">配置多个备份源（WebDAV, S3等），确保数据万无一失。</p>
      </div>
      <BackupSettings @restore-success="$emit('success')" />
    </div>
  </div>
</template>

<script setup>
import BackupSettings from './BackupSettings.vue'

const emit = defineEmits(['success'])
</script>

<style scoped>
.tab-card-wrapper {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  min-height: 400px;
}
</style>