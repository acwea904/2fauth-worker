<template>
  <div class="migration-container">
    <el-tabs v-model="activeTab" class="migration-tabs">
      <el-tab-pane :label="$t('migration.export')" name="export">
        <DataExport />
      </el-tab-pane>
      <el-tab-pane :label="$t('migration.import')" name="import">
        <DataImport @success="$emit('success')" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DataExport from '@/features/migration/views/dataExport.vue'
import DataImport from '@/features/migration/views/dataImport.vue'

const emit = defineEmits(['success'])
const activeTab = ref('export')
</script>

<style scoped>
.migration-container {
  padding: 10px;
}
.migration-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}
</style>
