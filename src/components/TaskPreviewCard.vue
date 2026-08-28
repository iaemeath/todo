<template>
  <div class="task-preview-card">
    <div class="task-preview-card__title">{{ title }}</div>
    <div v-if="description" class="task-preview-card__desc">{{ description }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 待办预览小卡片（只读）：上方标题、下方描述。
 * 任务转日程两类入口的选中态展示——排期到日历（TaskManagePage）与从待办新增
 * （ScheduleManagePage）共用；纯展示组件，不持任何状态。
 */
withDefaults(defineProps<{ title: string; description?: string }>(), { description: '' })
</script>

<style scoped>
.task-preview-card {
  padding: var(--space-sm) var(--space-md);
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-md);
  text-align: center;
}

.task-preview-card__title {
  font-size: var(--font-base);
  font-weight: var(--weight-semibold);
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.task-preview-card__desc {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2; /* 描述限两行，防长文撑破卡片 */
  overflow: hidden;
  margin-top: var(--space-xs);
  font-size: var(--font-sm);
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}
</style>
