<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CalendarRange, Sun, Moon, ListTodo, CalendarClock, Edit3, Eye, Settings as SettingsIcon } from 'lucide-vue-next'
import TodoManagerList from './components/TodoManagerList.vue'
import TaskManagerList from './components/TaskManagerList.vue'
import Editor from './components/Editor/index.vue'
import CanvasViewer from './components/CanvasViewer.vue'
import VoiceAssistant from './components/VoiceAssistant.vue'
import SettingsModal from './components/SettingsModal.vue'

const currentMainView = ref<'timeline' | 'todos' | 'tasks'>('timeline')
const isEditorMode = ref(false)
const isDark = ref(false) // Default to light theme
const isSettingsOpen = ref(false)

// --- Theme toggle ---
const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
}

onMounted(() => {
  // Initialize light mode
  document.documentElement.setAttribute('data-theme', 'light')
})
</script>

<template>
  <div class="app-layout">
    <!-- Header Banner -->
    <header class="app-header glass-panel">
      <div class="logo-group">
        <CalendarRange class="logo-icon" />
        <h1>太空时间轴</h1>
        <span class="view-tag" :class="{ 'editor-mode': isEditorMode && currentMainView === 'timeline' }">
          {{ currentMainView === 'timeline' ? '时间轴' : currentMainView === 'todos' ? '待办管理' : '任务管理' }}{{ currentMainView === 'timeline' ? ` · ${isEditorMode ? '编辑' : '浏览'}` : '' }}
        </span>
      </div>

      <div class="actions-group">
        <!-- Main View Switcher tabs (Timeline only) -->
        <div class="main-view-switcher">
          <button 
            class="btn-switch-tab" 
            :class="{ active: currentMainView === 'timeline' }" 
            @click="currentMainView = 'timeline'"
          >
            <CalendarRange class="action-icon" />
            <span>时间轴</span>
          </button>
        </div>

        <!-- Mode toggle -->
        <button 
          v-if="currentMainView === 'timeline'"
          class="btn-action btn-mode-toggle" 
          :class="{ 'active': isEditorMode }"
          @click="isEditorMode = !isEditorMode"
        >
          <Edit3 v-if="!isEditorMode" class="action-icon" />
          <Eye v-else class="action-icon" />
          <span>{{ isEditorMode ? '退出编辑' : '进入编辑' }}</span>
        </button>

        <!-- Theme toggle -->
        <button class="btn-action theme-toggle" @click="toggleTheme" :title="isDark ? '切为明亮模式' : '切为暗黑模式'">
          <Sun v-if="isDark" class="action-icon" />
          <Moon v-else class="action-icon" />
        </button>

        <!-- Settings toggle -->
        <button class="btn-action settings-toggle" @click="isSettingsOpen = true" title="AI 设置">
          <SettingsIcon class="action-icon" />
        </button>

        <!-- Management View Switcher tabs -->
        <div class="main-view-switcher">
          <button 
            class="btn-switch-tab" 
            :class="{ active: currentMainView === 'todos' }" 
            @click="currentMainView = 'todos'"
          >
            <ListTodo class="action-icon" />
            <span>待办管理</span>
          </button>
          <button 
            class="btn-switch-tab" 
            :class="{ active: currentMainView === 'tasks' }" 
            @click="currentMainView = 'tasks'"
          >
            <CalendarClock class="action-icon" />
            <span>任务管理</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="main-workspace">
      <!-- 1. Timeline / Canvas -->
      <template v-if="currentMainView === 'timeline'">
        <Editor v-slot="{ selectedTaskId }" v-if="isEditorMode" />
        <CanvasViewer v-else />
      </template>

      <!-- 2. Todo List management -->
      <TodoManagerList v-else-if="currentMainView === 'todos'" />

      <!-- 3. Task List management -->
      <TaskManagerList v-else-if="currentMainView === 'tasks'" />
    </main>

    <!-- Global Floating Actions & Modals -->
    <VoiceAssistant />
    <SettingsModal :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
  </div>
</template>

<style>
/* Global App style injection */
@import './styles/theme.css';

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 20px;
  gap: 16px;
  max-width: 1440px;
  margin: 0 auto;
  box-sizing: border-box;
}

.app-header {
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  flex-shrink: 0;
}

.logo-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 24px;
  height: 24px;
  color: var(--color-primary-light);
}

.logo-group h1 {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text-primary);
  margin: 0;
}

.view-tag {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--color-success-alpha);
  color: var(--color-success);
  border: 1px solid rgba(34, 197, 94, 0.1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.view-tag.editor-mode {
  background: var(--color-warning-alpha);
  color: var(--color-warning);
  border: 1px solid rgba(245, 158, 11, 0.1);
}

.actions-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-view-switcher {
  display: flex;
  background: var(--input-bg);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-glass-subtle);
  gap: 4px;
}

.btn-switch-tab {
  height: 32px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-switch-tab:hover {
  color: var(--text-primary);
  background: var(--border-glass);
}

.btn-switch-tab.active {
  background: var(--bg-glass-solid);
  color: var(--color-primary-light);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
  border: 1px solid var(--border-glass-subtle);
}

.btn-action {
  height: 38px;
  padding: 0 14px;
  background: var(--border-glass);
  border: 1px solid var(--border-glass-subtle);
  color: var(--text-secondary);
  border-radius: 10px;
}

.btn-action:hover {
  background: var(--card-hover-bg);
  color: var(--text-primary);
}

.btn-mode-toggle.active {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
  border-color: transparent;
}

.btn-mode-toggle.active:hover {
  background: var(--color-primary-light);
  color: #fff;
}

.btn-mode-toggle span {
  font-size: 0.8rem;
  font-weight: 700;
}

.theme-toggle {
  width: 38px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon {
  width: 16px;
  height: 16px;
}

/* Workspace layout */
.main-workspace {
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
  height: calc(100vh - 120px);
}
</style>
