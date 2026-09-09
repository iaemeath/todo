/**
 * 全局键盘快捷键（桌面端）：单一 document keydown 分发，按 currentView 查键表。
 *
 * 守卫链（依序让位，短路与顺序同等重要）：
 *   移动端 → 帮助浮层自身 → 系统修饰组合键 → 屏保任意键退出 → 输入焦点 →
 *   弹窗/选择器弹层 → FC 拖拽中 → 进入键表。
 *
 * 主页日历命令经 ui store 的 shortcutRequest 请求-消费通道桥接（同
 * gotoDateRequest 先例），本层不持日历引用；选中相关键（Ctrl+V/Esc/Del）
 * 由 useScheduleCalendar 的局部监听承担——它持有选中集上下文。
 * 浏览器/系统保留键不碰（Ctrl+T/W/R/N、F 系），单字母键一律无修饰符。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useUIStore, type CalendarShortcutAction, type SettingsSection } from '../stores'

/** 设置 section 的 ↑↓ 轮转顺序（与侧栏导航一致） */
const SETTINGS_ORDER: SettingsSection[] = ['view', 'ai', 'data', 'guide', 'users', 'about']
/** 仅修饰键自身按下（不视为任何快捷键） */
const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta']

export function useGlobalShortcuts() {
  const uiStore = useUIStore()
  const { currentView, settingsSection } = storeToRefs(uiStore)

  // ? 帮助浮层（App.vue 渲染对话框）
  const helpVisible = ref(false)
  const toggleHelp = () => {
    helpVisible.value = !helpVisible.value
  }

  const isTypingTarget = (el: EventTarget | null) => {
    if (!(el instanceof HTMLElement)) return false
    return el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null
  }

  // Element Plus 弹层：el-dialog/el-select 弹层等打开时任一 overlay 可见即让位
  // （关闭态的 overlay 为 display:none，DOM 残留不影响判断）
  const hasOverlayOpen = () =>
    [...document.querySelectorAll('.el-overlay')].some(
      (o) => (o as HTMLElement).style.display !== 'none' && getComputedStyle(o).display !== 'none'
    )

  // FC 拖拽进行中（v6 给被拖事件挂 fc-event-dragging 类）
  const isFcDragging = () => document.querySelector('.fc-event-dragging') !== null

  const onKeydown = (e: KeyboardEvent) => {
    if (uiStore.isMobile) return

    // 帮助浮层打开：仅 Esc/? 可关，其余不穿透
    if (helpVisible.value) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        helpVisible.value = false
      }
      return
    }

    // Ctrl/Alt/Win 组合键不接管（? 为 Shift+/，仅放行 shift）
    if (e.ctrlKey || e.metaKey || e.altKey) return

    // 屏保：任意非修饰键退出回主页
    if (currentView.value === 'screensaver') {
      if (!MODIFIER_KEYS.includes(e.key)) {
        e.preventDefault()
        uiStore.switchView('home')
      }
      return
    }

    if (isTypingTarget(e.target)) return
    if (hasOverlayOpen() || isFcDragging()) return

    // ?：帮助浮层（全视图可用）
    if (e.key === '?') {
      e.preventDefault()
      toggleHelp()
      return
    }

    switch (currentView.value) {
      case 'home': {
        const action: CalendarShortcutAction | null =
          e.key === 't' || e.key === 'T' ? 'today'
          : e.key === 'c' || e.key === 'C' ? 'create'
          : e.key === 'ArrowLeft' ? 'prev'
          : e.key === 'ArrowRight' ? 'next'
          : e.key === '1' ? 'view-day'
          : e.key === '2' ? 'view-week'
          : e.key === '3' ? 'view-month'
          : null
        if (action) {
          e.preventDefault()
          uiStore.requestCalendarShortcut(action)
        }
        break
      }
      case 'settings': {
        const idx = SETTINGS_ORDER.indexOf(settingsSection.value)
        if (e.key === 'ArrowDown' || e.key === ']') {
          e.preventDefault()
          uiStore.openSettingsSection(SETTINGS_ORDER[Math.min(idx + 1, SETTINGS_ORDER.length - 1)])
        } else if (e.key === 'ArrowUp' || e.key === '[') {
          e.preventDefault()
          uiStore.openSettingsSection(SETTINGS_ORDER[Math.max(idx - 1, 0)])
        }
        break
      }
      case 'auth': {
        if (e.key === 'Escape') {
          e.preventDefault()
          uiStore.closeAuth()
        }
        break
      }
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

  return { helpVisible, toggleHelp }
}
