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
const { currentView, isMobile } = useUI()

onMounted(() => {
  loadTheme()
})
</script>

<template>
  <div class="app-layout">
    <AppNavBar />

    <main class="content-area">
      <!-- 主页 -->
      <div v-if="currentView === 'home'" class="home-view" :class="{ 'home-view--mobile': isMobile }">
        <!-- 桌面：日历(左) + 待办(右) 并排；移动端：日历全屏（待办走抽屉→任务管理） -->
        <CalendarArea />
        <TodoSidebar v-if="!isMobile" />
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

/* 桌面端：日历 flex:1，待办固定宽 —— 仅在非 mobile 布局下生效 */
.home-view:not(.home-view--mobile) > :first-child {
  flex: 1;
  min-width: 0;
}

.home-view:not(.home-view--mobile) > :last-child {
  flex-shrink: 0;
}

/* 移动端：日历占满整屏 */
.home-view--mobile {
  flex-direction: column;
}

/* 移动端：收紧内容区内边距 */
@media (max-width: 768px) {
  .content-area {
    padding: 12px;
  }
}
</style>
