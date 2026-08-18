<script setup lang="ts">
import { onMounted, defineAsyncComponent } from 'vue'
import AppNavBar from './components/AppNavBar.vue'
import CalendarArea from './components/CalendarArea.vue'
import TodoSidebar from './components/TodoSidebar.vue'
import { storeToRefs } from 'pinia'
import { ElConfigProvider } from 'element-plus'
import { useThemeStore, useUIStore } from './stores'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// 二级页面与语音助手异步加载，避免首屏 bundle 过大
// （SettingsPage 牵连的 web-llm 等 6MB+ 重依赖随之懒加载）
const VoiceAssistant = defineAsyncComponent(() => import('./components/VoiceAssistant.vue'))
const TaskManagePage = defineAsyncComponent(() => import('./components/TaskManagePage.vue'))
const ScheduleManagePage = defineAsyncComponent(() => import('./components/ScheduleManagePage.vue'))
const SettingsPage = defineAsyncComponent(() => import('./components/SettingsPage.vue'))

const { loadTheme } = useThemeStore()
const uiStore = useUIStore()
const { currentView, isMobile, todoVisible, mobileTodoDragging } = storeToRefs(uiStore)
const { setTodoVisible } = uiStore // action 直接解构

onMounted(() => {
  loadTheme()
})
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div class="app-layout">
      <AppNavBar />

      <main class="content-area">
        <!-- 主页 -->
        <div v-if="currentView === 'home'" class="home-view" :class="{ 'home-view--mobile': isMobile }">
          <!-- 桌面：日历(左) + 待办(右) 并排；移动端：日历全屏（待办走抽屉→任务管理） -->
          <CalendarArea />
          <TodoSidebar v-if="!isMobile && todoVisible" />
          <!-- 移动端待办浮层：底罩捕获浮层外点击关闭；拖拽中穿透以免拦截往日历拖放排期 -->
          <template v-if="isMobile && todoVisible">
            <div
              class="mobile-todo-backdrop"
              :class="{ dragging: mobileTodoDragging }"
              @click="setTodoVisible(false)"
            ></div>
            <Transition name="overlay-slide">
              <div class="mobile-todo-overlay" :class="{ dragging: mobileTodoDragging }">
                <TodoSidebar />
              </div>
            </Transition>
          </template>
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
  </el-config-provider>
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
  transition: background-color var(--duration-base) ease, color var(--duration-base) ease;
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

  /* 纵向 12 / 横向 16：导航栏与内容面板之间的间距收紧一档（面板自带边框阴影，间距可更紧凑）。
     移动端主页由 .home-view--mobile 负边距出血吃掉此内边距（任务/日程/设置页不受影响） */
  padding: var(--space-md) var(--space-lg);
  box-sizing: border-box;
}

/* 主页：左右布局 */
.home-view {
  display: flex;
  gap: var(--space-md); /* 日历与待办面板间距 16→12（两侧面板内边距叠加后观感本已偏大） */
  height: 100%;
  overflow: hidden;
  position: relative; /* 为移动端待办浮层 absolute 定位 */
}

/* 移动端待办浮层底罩：捕获浮层外（日历区）点击 → 关闭浮层。
   透明不改变视觉；位于浮层(20)之下、日历之上 */
.mobile-todo-backdrop {
  position: absolute;
  inset: 0;
  z-index: 19;
}

/* 拖拽待办到日历排期时穿透，避免拦截 FullCalendar 的拖放命中 */
.mobile-todo-backdrop.dragging {
  pointer-events: none;
}

/* 移动端待办浮层：占屏宽 72%，贴右、从右侧滑出覆盖日历右侧
   （72% 为令牌化后的取舍：小屏多显 2 字标题，仍留 28% 日历可辨识） */
.mobile-todo-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 72%;
  z-index: 20;
  background: var(--el-bg-color);
  display: flex;
  transition: transform var(--duration-base) var(--ease-spring), opacity var(--duration-base) ease;
}

.mobile-todo-overlay.dragging {
  /* 拖拽中：透明隐藏（不用 translateX，避免拖拽源移位导致 FC 拖影丢失） */
  opacity: 0;
  pointer-events: none;
}

/* 浮层从右侧滑入/滑出（沿用项目招牌弹性曲线） */
.overlay-slide-enter-active,
.overlay-slide-leave-active {
  transition: transform var(--duration-base) var(--ease-spring), opacity var(--duration-base) ease;
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

/* 移动端主页全屏出血：手机空间宝贵，日历面板贴边铺满（等效 content-area 零内边距，
   任务/日程/设置页不受影响）。height 需同步补上被吃掉的上下内边距——
   负 margin-bottom 只影响后续兄弟，不改变自身底边，单靠负边距底部会残留缺口。
   须置于 .home-view 基础规则之后：两者同为单类特异性，height 按源顺序取胜 */
.home-view--mobile {
  flex-direction: column;
  height: calc(100% + (var(--space-md) * 2));
  margin: calc(var(--space-md) * -1) calc(var(--space-lg) * -1);
}
</style>
