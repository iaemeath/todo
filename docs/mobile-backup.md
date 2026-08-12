# 移动端代码备份

> 本文件保存了在"顶部导航栏 + 上下结构布局重构"中移除的全部移动端适配代码。
> Web 端开发完成后，重新适配移动端时可参考此文件恢复。

## 1. useMobile composable（src/composables/useMobile.ts）

```ts
import { ref } from 'vue'

/**
 * Mobile detection (singleton).
 *
 * Previously every component called useMobile() independently, each spinning
 * up its own resize listener. Now there is one module-level ref and one
 * listener for the whole app. The resize handler is throttled via
 * requestAnimationFrame so rapid resizes coalesce into a single update.
 */
const DEFAULT_BREAKPOINT = 768
const isMobile = ref(false)

let initialized = false
let ticking = false

const checkMobile = (breakpoint: number) => {
  isMobile.value = window.innerWidth <= breakpoint
}

/** Initialise the shared listener once (idempotent). */
const init = (breakpoint = DEFAULT_BREAKPOINT) => {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  checkMobile(breakpoint)
  window.addEventListener('resize', () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      checkMobile(breakpoint)
      ticking = false
    })
  })
}

export function useMobile(breakpoint = DEFAULT_BREAKPOINT) {
  init(breakpoint)
  return { isMobile }
}
```

## 2. App.vue 移动端逻辑

```ts
// script
const { isMobile } = useMobile()
const activeTab = ref<'calendar' | 'todos'>('calendar')

// template: 根容器加 mobile-layout 类
<div class="app-layout" :class="{ 'mobile-layout': isMobile }">

// template: 日历/待办用 v-show 按 tab 切换
<CalendarArea v-show="!isMobile || activeTab === 'calendar'" />
<TodoSidebar v-if="!isMobile" v-show="sidebarOpen" />

// template: 移动端底部导航
<nav v-if="isMobile" class="mobile-bottom-nav glass-panel">
  <button class="nav-btn" :class="{ active: activeTab === 'calendar' }" @click="activeTab = 'calendar'">
    <CalendarIcon class="nav-icon" />
    <span>日历</span>
  </button>
  <button class="nav-btn" :class="{ active: activeTab === 'todos' }" @click="activeTab = 'todos'">
    <ListIcon class="nav-icon" />
    <span>待办</span>
  </button>
</nav>
```

## 3. style.css 移动端 CSS 规则

```css
/* Mobile Responsive Overrides */
.mobile-layout {
  padding: 10px !important;
  padding-bottom: 80px !important; /* Space for bottom nav */
}

.mobile-layout .main-workspace {
  flex-direction: column !important;
  gap: 10px !important;
}

.mobile-bottom-nav {
  display: flex;
  justify-content: space-around;
  padding: 12px 20px;
  border-radius: 24px;
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 85%;
  z-index: var(--z-nav);
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.nav-btn {
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 8px 16px;
  border-radius: 12px;
}

.nav-btn.active {
  color: var(--color-primary);
  background: var(--color-primary-alpha);
}

.nav-icon {
  width: 24px;
  height: 24px;
}

.mobile-layout .todo-sidebar {
  width: 100% !important;
  min-width: 100% !important;
}

.mobile-layout .calendar-wrapper {
  width: 100% !important;
}

.mobile-layout .fc-toolbar-title {
  font-size: 1.1em !important;
}

.mobile-layout .voice-assistant-fab {
  bottom: 100px !important; /* Float above nav bar */
  right: 20px !important;
}
```

## 4. CalendarArea.vue 移动端分支

```ts
// script: 引入 useMobile
const { isMobile } = useMobile()

// script: isMobile 变化时切换 FC 视图
watch(isMobile, (newVal) => {
  if (fullCalendar.value) {
    const api = fullCalendar.value.getApi()
    if (newVal) {
      api.changeView('timeGridDay')
    } else {
      api.changeView('timeGridWeek')
    }
  }
})

// script: initialView 和 headerToolbar 的移动端分支
initialView: isMobile.value ? 'timeGridDay' : 'timeGridWeek',
headerToolbar: isMobile.value
  ? { left: 'prev,next', center: 'title', right: 'today' }
  : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
```

```css
/* CalendarArea scoped style: 移动端 FC 工具栏适配 */
.is-mobile-calendar :deep(.fc-header-toolbar) {
  margin-bottom: 8px !important;
  flex-wrap: wrap;
  gap: 8px;
}
.is-mobile-calendar :deep(.fc-toolbar-title) {
  font-size: 1rem !important;
}
.is-mobile-calendar :deep(.fc-button) {
  padding: 4px 8px !important;
  font-size: 0.8rem !important;
}
```

## 5. theme.css 移动端 z-index

```css
--z-nav: 9000;  /* mobile-bottom-nav，移动端删除后可清理 */
```

## 6. VoiceAssistant.vue 移动端逻辑

VoiceAssistant 内部有独立的 isMobile 判断和移动端 bottom-sheet 弹层逻辑（.mobile-bottom-sheet-overlay / .mobile-bottom-sheet），这些是组件内部逻辑，备份时保留在组件中不删除，仅移除 App.vue 级别的移动端导航。
