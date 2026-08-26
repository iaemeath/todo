<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, defineAsyncComponent } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import CalendarArea from './components/CalendarArea.vue'
import TodoSidebar from './components/TodoSidebar.vue'
import { storeToRefs } from 'pinia'
import { ElConfigProvider } from 'element-plus'
import { useThemeStore, useUIStore } from './stores'
import { useAuthStore } from './stores/auth'
import { startSync, stopSync } from './services/syncManager'
import { startReminders, stopReminders } from './services/reminderService'
import { startVersionCheck } from './services/versionCheck'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// 二级页面与语音助手异步加载，避免首屏 bundle 过大
// （SettingsPage 牵连的 web-llm 等 6MB+ 重依赖随之懒加载）
const VoiceAssistant = defineAsyncComponent(() => import('./components/VoiceAssistant.vue'))
const TaskManagePage = defineAsyncComponent(() => import('./components/TaskManagePage.vue'))
const ScheduleManagePage = defineAsyncComponent(() => import('./components/ScheduleManagePage.vue'))
const ScreensaverPage = defineAsyncComponent(() => import('./components/ScreensaverPage.vue'))
const SettingsPage = defineAsyncComponent(() => import('./components/SettingsPage.vue'))
const AuthPage = defineAsyncComponent(() => import('./components/AuthPage.vue'))
const AboutPage = defineAsyncComponent(() => import('./components/AboutPage.vue'))

const { loadTheme } = useThemeStore()
const uiStore = useUIStore()
const authStore = useAuthStore()
const { currentView, isMobile, todoVisible, mobileTodoDragging, navRailCollapsed } = storeToRefs(uiStore)
const { setTodoVisible } = uiStore // action 直接解构

onMounted(() => {
  loadTheme()
  // 会话恢复：有 token 则校验并刷新 user/features（401 自动清态为游客模式）
  void authStore.bootstrap()
  // Web 端新版本检测（桌面壳内部走 electron-updater，此调用自动跳过）
  startVersionCheck()
  // 日程到点提醒（桌面壳内部启动调度器，网页端此调用无操作）
  startReminders()
})

onBeforeUnmount(() => {
  stopReminders()
})

// 登录态即同步开关：登录/启动 → startSync；登出/token 失效 → stopSync。
// bootstrap 前按本地 token 乐观启动：token 已过期时首次请求 401 → 清态 → stop，无害。
watch(
  () => authStore.isLoggedIn,
  (v) => (v ? startSync() : stopSync()),
  { immediate: true }
)
</script>

<template>
  <el-config-provider :locale="zhCn">
    <!-- 布局类与 AppSidebar 侧栏的渲染条件同源：web 侧栏常驻（主页/管理/设置页同布局，
         左导航 + 右内容区），在场才横向 row；移动端恒为纵向 column -->
    <div
      class="app-layout"
      :class="{ 'app-layout--with-side': !isMobile && !navRailCollapsed }"
    >
      <AppSidebar />

      <main class="content-area">
        <!-- 主页 -->
        <div
          v-if="currentView === 'home'"
          class="home-view"
          :class="{ 'home-view--mobile': isMobile }"
        >
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

        <!-- 屏保（Fliqlo 风翻页时钟） -->
        <ScreensaverPage v-else-if="currentView === 'screensaver'" />

        <!-- 设置 -->
        <SettingsPage v-else-if="currentView === 'settings'" />

        <!-- 登录/注册页（openAuth 记录来源，closeAuth 返回） -->
        <AuthPage v-else-if="currentView === 'auth'" />

        <!-- 关于：产品说明 + 三端下载（游客可达的分发入口） -->
        <AboutPage v-else-if="currentView === 'about'" />
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

/* 桌面：导航侧栏在左、内容在右（与 AppSidebar--side 的 769 断点同源）。
   移动端恒为纵向（返回条在顶），--with-side 由模板响应式挂载。
   不设 gap：侧栏↔日历的 12px 间距由 content-area 的 padding 统一提供（叠加会变 24） */
@media (width >= 769px) {
  .app-layout--with-side {
    flex-direction: row;
  }
}

.content-area {
  flex: 1;
  overflow: hidden;

  /* 移动端零内边距：日历贴屏铺满（贴边惯例，圆角边框随之拉平）；
     任务/日程/设置页由各自页面根样式补内边距，视觉间距不变 */
  box-sizing: border-box;
  min-width: 0;
}

/* 桌面浮岛：内容区四边 12px——日历与待办成为四周等距的对称浮岛
   （圆角/阴影完整成立，灰底透出），侧栏保持贴三边的结构面板 */
@media (width >= 769px) {
  .content-area {
    padding: var(--space-md);
  }
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
   （72% 为令牌化后的取舍：小屏多显 2 字标题，仍留 28% 日历可辨识）。
   左缘圆角 + 大阴影：浮于日历之上的层级感知 */
.mobile-todo-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 72%;
  z-index: 20;
  background: var(--el-bg-color);
  display: flex;
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  box-shadow: var(--shadow-lg);
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

/* 移动端主页：纵向流（日历全屏 + 待办浮层绝对定位锚于此容器）。
   content-area 已零内边距，无需历史出血补偿 */
.home-view--mobile {
  flex-direction: column;
  height: 100%;
}
</style>
