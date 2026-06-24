<script setup lang="ts">
import { ref, computed } from 'vue'
import EditorSidebar from './components/EditorSidebar.vue'
import EditorToolbar from './components/EditorToolbar.vue'
import EditorCanvas from './components/EditorCanvas.vue'

const selectedTaskId = ref<string | null>(null)
const canvasRef = ref<InstanceType<typeof EditorCanvas> | null>(null)

const selectedColor = computed(() => {
  return canvasRef.value?.selectedTaskColor || 'blue'
})

const handleChangeColor = (color: string) => {
  canvasRef.value?.changeSelectedColor(color)
}

const handleDeleteSelected = () => {
  canvasRef.value?.deleteSelectedTask()
}
</script>

<template>
  <div class="editor-layout">
    <!-- Left template sidebar list -->
    <div class="sidebar-wrapper">
      <EditorSidebar />
    </div>

    <!-- Right content workspace -->
    <div class="right-content-area">
      <!-- Top actions toolbar -->
      <EditorToolbar 
        :has-selection="selectedTaskId !== null"
        :selected-color="selectedColor"
        @change-color="handleChangeColor"
        @delete-selected="handleDeleteSelected"
      />

      <!-- Scheduler grid canvas -->
      <div class="canvas-wrapper glass-panel">
        <EditorCanvas 
          ref="canvasRef"
          v-model:selected-task-id="selectedTaskId"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-layout {
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

.sidebar-wrapper {
  flex-shrink: 0;
  height: 100%;
}

.right-content-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.canvas-wrapper {
  flex: 1;
  height: 100%;
  overflow: hidden;
  background: var(--bg-glass);
}
</style>
