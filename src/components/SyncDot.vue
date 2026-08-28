<template>
  <span class="sync-dot" :class="syncState"></span>
</template>

<script setup lang="ts">
/** 同步状态点：颜色/脉冲随 syncState 变化（桌面侧栏与移动抽屉的账号行共用）。 */
import { syncState } from '../services/syncManager'
</script>

<style scoped>
.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.sync-dot.syncing {
  background: var(--el-color-primary);
  animation: sync-pulse 1s ease-in-out infinite;
}

.sync-dot.synced {
  background: var(--el-color-success);
}

.sync-dot.offline {
  background: var(--el-color-warning);
}

.sync-dot.error {
  background: var(--el-color-danger);
}

@keyframes sync-pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
