import { ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Global UI state.
 *
 * Centralises view navigation + mobile device detection + the current settings
 * sub-section (shared between AppNavBar's back-button title and SettingsPage).
 */

export type AppView = 'home' | 'task' | 'schedule' | 'settings'
export type SettingsSection = 'list' | 'view' | 'ai' | 'usage' | 'data' | 'guide'

const MOBILE_BREAKPOINT = 768
const LS_TODO_VISIBLE = 'todo_visible'

export const useUIStore = defineStore('ui', () => {
  const currentView = ref<AppView>('home')
  const isMobile = ref(false)
  // 移动端设置子页：'list'=选项列表；选中后为对应面板。AppNavBar 据此显示返回按钮标题。
  const settingsSection = ref<SettingsSection>('list')

  // 主页待办可见性（web 常驻侧栏 / 移动 60% 浮层，同一状态），持久化保留用户偏好。
  const readTodoVisible = (): boolean => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LS_TODO_VISIBLE) : null
    if (stored !== null) return stored === '1'
    // 首次：web 默认显示，移动默认隐藏。必须按窗口宽度现判——
    // 此时 initResize() 尚未执行，isMobile 还是初始值 false，读它会误判移动端。
    return typeof window === 'undefined' || window.innerWidth > MOBILE_BREAKPOINT
  }
  const todoVisible = ref<boolean>(readTodoVisible())

  // 移动端拖拽中视觉隐藏状态（DOM 保留供 FC 继续拖拽）
  const mobileTodoDragging = ref(false)

  const setTodoVisible = (v: boolean) => {
    todoVisible.value = v
    if (!v) mobileTodoDragging.value = false // 关闭时复位拖拽透明态
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_TODO_VISIBLE, v ? '1' : '0')
    }
  }

  const setMobileTodoDragging = (v: boolean) => {
    mobileTodoDragging.value = v
  }

  // --- Device detection (setup 只执行一次，监听随应用生命周期常驻) ---
  const detect = () => {
    isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
    // CSS 平台作用域与 isMobile 同源挂载：令牌双平台值的开关（见 theme.css html.platform-mobile）
    document.documentElement.classList.toggle('platform-mobile', isMobile.value)
  }
  const initResize = () => {
    if (typeof window === 'undefined') return
    detect()
    let ticking = false
    window.addEventListener('resize', () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        detect()
        ticking = false
      })
    })
  }
  initResize()

  const switchView = (view: AppView) => {
    currentView.value = view
    // 每次进入设置页，默认回到选项列表
    if (view === 'settings') settingsSection.value = 'list'
  }

  const setSettingsSection = (s: SettingsSection) => {
    settingsSection.value = s
  }

  return {
    currentView,
    switchView,
    isMobile,
    settingsSection,
    setSettingsSection,
    todoVisible,
    setTodoVisible,
    mobileTodoDragging,
    setMobileTodoDragging
  }
})
