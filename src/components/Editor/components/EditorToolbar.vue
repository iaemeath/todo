<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'

defineProps<{
  hasSelection: boolean
  selectedColor: string
}>()

const emit = defineEmits<{
  (e: 'change-color', color: string): void
  (e: 'delete-selected'): void
}>()

const colorsList = [
  { value: 'violet', label: '紫色', color: '#8b5cf6' },
  { value: 'blue', label: '蓝色', color: '#3b82f6' },
  { value: 'emerald', label: '绿色', color: '#10b981' },
  { value: 'amber', label: '黄色', color: '#f59e0b' },
  { value: 'rose', label: '红色', color: '#f43f5e' },
  { value: 'cyan', label: '青色', color: '#06b6d4' }
]
</script>

<template>
  <div class="editor-toolbar glass-panel">
    <!-- Styles Group (Visible only when a task is selected) -->
    <div class="toolbar-section" v-if="hasSelection">
      <div class="color-picker-tool">
        <span class="section-lbl">卡片颜色:</span>
        <div class="color-dots">
          <button
            v-for="c in colorsList"
            :key="c.value"
            type="button"
            class="color-dot-btn"
            :class="['color-' + c.value, { selected: selectedColor === c.value }]"
            @click="emit('change-color', c.value)"
            :title="c.label"
          ></button>
        </div>
      </div>
    </div>

    <div class="toolbar-divider" v-if="hasSelection"></div>

    <!-- Delete Group -->
    <div class="toolbar-section" v-if="hasSelection">
      <button 
        class="btn-tool btn-danger"
        @click="emit('delete-selected')"
        title="删除选中日程 (Delete)"
      >
        <Trash2 class="tool-icon" />
        <span class="btn-lbl">删除日程</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 12px;
  background: var(--bg-glass-solid);
  border: 1px solid var(--border-glass-subtle);
  border-radius: 14px;
  height: 48px;
  width: 100%;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-group {
  display: flex;
  background: var(--input-bg);
  border-radius: 8px;
  padding: 2px;
  border: 1px solid var(--border-glass-subtle);
}

.btn-tool {
  background: transparent;
  color: var(--text-secondary);
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-tool:hover:not(:disabled) {
  background: var(--card-hover-bg);
  color: var(--color-primary-light);
}

.btn-tool:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-tool.active {
  background: var(--color-primary-alpha);
  color: var(--color-primary-light);
  border: 1px solid rgba(124, 58, 237, 0.2);
}

.tool-icon {
  width: 14px;
  height: 14px;
}

.btn-lbl {
  font-size: 0.75rem;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-glass-subtle);
}

/* Color picker section */
.color-picker-tool {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-lbl {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.color-dots {
  display: flex;
  gap: 6px;
}

.color-dot-btn {
  width: 16px;
  height: 16px;
}

.btn-danger {
  color: var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-alpha) !important;
  color: var(--color-danger) !important;
}
</style>
