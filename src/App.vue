<script setup lang="ts">
import { onMounted } from 'vue'
import AppNavBar from './components/AppNavBar.vue'
import CalendarArea from './components/CalendarArea.vue'
import TodoSidebar from './components/TodoSidebar.vue'
import VoiceAssistant from './components/VoiceAssistant.vue'
import TodoManagePage from './components/TodoManagePage.vue'
import ScheduleManagePage from './components/ScheduleManagePage.vue'
import SettingsPage from './components/SettingsPage.vue'
import { useTheme } from './composables/useTheme'
import { useUI } from './composables/useUI'

const { loadTheme } = useTheme()
const { currentView } = useUI()

onMounted(() => {
  loadTheme()
})
</script>

<template>
  <div class="app-layout">
    <AppNavBar />

    <main class="content-area">
      <!-- 主页：左右布局（左日历 + 右待办） -->
      <div v-if="currentView === 'home'" class="home-view">
        <CalendarArea />
        <TodoSidebar />
      </div>

      <!-- 任务管理 -->
      <TodoManagePage v-else-if="currentView === 'task'" />

      <!-- 日程管理 -->
      <ScheduleManagePage v-else-if="currentView === 'schedule'" />

      <!-- 设置 -->
      <SettingsPage v-else-if="currentView === 'settings'" />
    </main>

    <VoiceAssistant />
  </div>
</template>

<style>
@import './styles/theme.css';
@import './style.css';

html, body {
  margin: 0;
  padding: 0;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  font-family: var(--font-family);
  height: 100vh;
  overflow: hidden;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  box-sizing: border-box;
}

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  box-sizing: border-box;
}

/* 主页：左右布局 */
.home-view {
  display: flex;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.home-view > :first-child {
  flex: 1;
}

.home-view > :last-child {
  flex-shrink: 0;
}
</style>
