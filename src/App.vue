<script setup lang="ts">
import { onMounted } from 'vue'
import AppNavBar from './components/AppNavBar.vue'
import CalendarArea from './components/CalendarArea.vue'
import TodoSidebar from './components/TodoSidebar.vue'
import VoiceAssistant from './components/VoiceAssistant.vue'
import TaskManagePage from './components/TaskManagePage.vue'
import ScheduleManagePage from './components/ScheduleManagePage.vue'
import SettingsPage from './components/SettingsPage.vue'
import { useTheme } from './composables/useTheme'
import { useUI } from './composables/useUI'

const { loadTheme } = useTheme()
const { currentView, isMobile, todoVisible, mobileTodoDragging } = useUI()

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
        <TodoSidebar v-if="!isMobile && todoVisible" />
        <!-- 移动端待办浮层（全屏覆盖日历） -->
        <Transition name="overlay-slide">
          <div
            v-if="isMobile && todoVisible"
            class="mobile-todo-overlay"
            :class="{ dragging: mobileTodoDragging }"
          >
            <TodoSidebar />
          </div>
        </Transition>
      </div>

      <!-- 任务管理 -->
      <TaskManagePage v-else-if="currentView === 'task'" />

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
  position: relative; /* 为移动端待办浮层 absolute 定位 */
}

/* 移动端待办浮层：占屏宽 60%，贴右、从右侧滑出覆盖日历右半 */
.mobile-todo-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 60%;
  z-index: 20;
  background: var(--el-bg-color);
  display: flex;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}
.mobile-todo-overlay.dragging {
  /* 拖拽中：透明隐藏（不用 translateX，避免拖拽源移位导致 FC 拖影丢失） */
  opacity: 0;
  pointer-events: none;
}

/* 浮层从右侧滑入/滑出（沿用项目招牌弹性曲线） */
.overlay-slide-enter-active,
.overlay-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}
.overlay-slide-enter-from,
.overlay-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
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
