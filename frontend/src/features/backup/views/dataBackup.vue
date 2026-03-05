<template>
  <div class="data-backup-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>{{ $t('backup.center_title') }}</h2>
        <p style="color: var(--el-text-color-secondary);">{{ $t('backup.center_desc') }}</p>
      </div>
      <BackupSettings @restore-success="$emit('success')" />
    </div>
  </div>
</template>

<script setup>
import BackupSettings from '@/features/backup/components/backupSettings.vue'

const emit = defineEmits(['success'])
</script>