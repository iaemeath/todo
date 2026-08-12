<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Calendar, List } from '@element-plus/icons-vue'
import AppNavBar from './components/AppNavBar.vue'
import CalendarArea from './components/CalendarArea.vue'
import TodoSidebar from './components/TodoSidebar.vue'
import VoiceAssistant from './components/VoiceAssistant.vue'
import TodoManagePage from './components/TodoManagePage.vue'
import ScheduleManagePage from './components/ScheduleManagePage.vue'
import SettingsPage from './components/SettingsPage.vue'
import { useTheme } from './composables/useTheme'
import { useUI } from './composables/useUI'
import { useTasks } from './composables/useTasks'

const { loadTheme } = useTheme()
const { currentView, isMobile } = useUI()
const { leafTasks } = useTasks()

// 移动端主页子 Tab：日历 / 待办
const homeTab = ref<'calendar' | 'todo'>('calendar')

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
        <!-- 桌面：日历(左) + 待办(右) 并排 -->
        <template v-if="!isMobile">
          <CalendarArea />
          <TodoSidebar />
        </template>

        <!-- 移动端：子 Tab 切换，同一时刻只看一个面板 -->
        <template v-else>
          <div class="home-subtabs">
            <button
              class="subtab"
              :class="{ active: homeTab === 'calendar' }"
              @click="homeTab = 'calendar'"
            >
              <el-icon><Calendar /></el-icon>
              <span>日历</span>
            </button>
            <button
              class="subtab"
              :class="{ active: homeTab === 'todo' }"
              @click="homeTab = 'todo'"
            >
              <el-icon><List /></el-icon>
              <span>待办 ({{ leafTasks.length }})</span>
            </button>
          </div>
          <div class="home-pane">
            <CalendarArea v-show="homeTab === 'calendar'" />
            <TodoSidebar v-show="homeTab === 'todo'" />
          </div>
        </template>
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

/* 移动端：主页改为纵向，顶部子 Tab + 下方面板 */
.home-view--mobile {
  flex-direction: column;
  gap: 12px;
}

.home-subtabs {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.subtab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.subtab.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.home-pane {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 移动端：收紧内容区内边距 */
@media (max-width: 768px) {
  .content-area {
    padding: 12px;
  }
}
</style>
