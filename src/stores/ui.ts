import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { router } from '../router'

/**
 * Global UI state.
 *
 * 视图导航（currentView/settingsSection）从 hash 路由派生——URL 是唯一真相源，
 * 刷新保持位置、浏览器返回键自然工作；导航 actions 桥接为 router.push，
 * 组件层调用签名不变。局部 UI 状态（抽屉/待办栏显隐等）仍为本店状态。
 */

export type AppView = 'home' | 'task' | 'schedule' | 'settings' | 'auth'
export type SettingsSection = 'view' | 'ai' | 'data' | 'guide' | 'users'

/** AppView → 路由路径（settings 恒带 section，URL 完整表达视图状态） */
const viewPath = (v: AppView, section?: SettingsSection): string => {
  switch (v) {
    case 'task': return '/task'
    case 'schedule': return '/schedule'
    case 'settings': return `/settings/${section || 'view'}`
    case 'auth': return '/auth'
    default: return '/'
  }
}

const VALID_SECTIONS: SettingsSection[] = ['view', 'ai', 'data', 'guide', 'users']

const MOBILE_BREAKPOINT = 768
const LS_TODO_VISIBLE = 'todo_visible'

export const useUIStore = defineStore('ui', () => {
  // ===== 视图状态（路由派生，只读） =====
  const currentView = computed<AppView>(() => {
    const path = router.currentRoute.value.path
    if (path === '/task') return 'task'
    if (path === '/schedule') return 'schedule'
    if (path.startsWith('/settings')) return 'settings'
    if (path === '/auth') return 'auth'
    return 'home'
  })

  const settingsSection = computed<SettingsSection>(() => {
    const s = router.currentRoute.value.params.section as string | undefined
    return VALID_SECTIONS.includes(s as SettingsSection) ? (s as SettingsSection) : 'view'
  })

  const isMobile = ref(false)

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

  // 移动端导航抽屉（桌面 rail 常驻无需状态；入口在日历工具条左端/二级页返回条）
  const navDrawerOpen = ref(false)

  const setNavDrawerOpen = (v: boolean) => {
    navDrawerOpen.value = v
  }

  // 桌面 rail 显隐（工具条左端开关；持久化保留用户偏好，刷新不复位）
  const LS_NAV_RAIL = 'nav_rail_visible'
  const readNavRailCollapsed = (): boolean => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(LS_NAV_RAIL) === '0'
  }
  const navRailCollapsed = ref<boolean>(readNavRailCollapsed())

  const setNavRailCollapsed = (v: boolean) => {
    navRailCollapsed.value = v
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_NAV_RAIL, v ? '0' : '1')
    }
  }

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

  // ===== 导航 actions（桥接 router.push，组件层调用签名不变） =====

  const switchView = (view: AppView) => {
    void router.push(viewPath(view))
  }

  // 设置子页直达（桌面侧栏/移动抽屉共用）
  const openSettingsSection = (s: SettingsSection) => {
    void router.push(`/settings/${s}`)
  }

  // 登录/注册页：openAuth 记录来源视图，登录成功/返回时回到来源
  const authReturnView = ref<AppView>('home')
  const openAuth = () => {
    if (currentView.value !== 'auth') authReturnView.value = currentView.value
    void router.push('/auth')
  }
  const closeAuth = () => {
    if (currentView.value === 'auth') void router.push(viewPath(authReturnView.value || 'home'))
  }

  return {
    currentView,
    switchView,
    openSettingsSection,
    isMobile,
    settingsSection,
    todoVisible,
    setTodoVisible,
    mobileTodoDragging,
    setMobileTodoDragging,
    navDrawerOpen,
    setNavDrawerOpen,
    navRailCollapsed,
    setNavRailCollapsed,
    authReturnView,
    openAuth,
    closeAuth
  }
})
