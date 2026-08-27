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

export type AppView = 'home' | 'task' | 'schedule' | 'screensaver' | 'settings' | 'auth'
export type SettingsSection = 'view' | 'ai' | 'data' | 'guide' | 'users' | 'about'

/** AppView → 路由路径（设置域为一级直达路由，v4.6 扁平化） */
const viewPath = (v: AppView, section?: SettingsSection): string => {
  switch (v) {
    case 'task': return '/task'
    case 'schedule': return '/schedule'
    case 'screensaver': return '/screensaver'
    case 'settings': return `/${section || 'view'}`
    case 'auth': return '/auth'
    default: return '/'
  }
}

const VALID_SECTIONS: SettingsSection[] = ['view', 'ai', 'data', 'guide', 'users', 'about']

const MOBILE_BREAKPOINT = 768
const LS_TODO_VISIBLE = 'todo_visible'

export const useUIStore = defineStore('ui', () => {
  // ===== 视图状态（路由派生，只读） =====
  const currentView = computed<AppView>(() => {
    const path = router.currentRoute.value.path
    if (path === '/task') return 'task'
    if (path === '/schedule') return 'schedule'
    if (path === '/screensaver') return 'screensaver'
    if (VALID_SECTIONS.includes(path.slice(1) as SettingsSection)) return 'settings'
    if (path === '/auth') return 'auth'
    return 'home'
  })

  const settingsSection = computed<SettingsSection>(() => {
    const s = router.currentRoute.value.path.slice(1) as SettingsSection
    return VALID_SECTIONS.includes(s) ? s : 'view'
  })

  const isMobile = ref(false)

  // 主页待办可见性（web 常驻侧栏 / 移动 60% 浮层，同一状态），持久化保留用户偏好。
  // 首次无记录默认隐藏，用户点击工具条开关后记忆
  const readTodoVisible = (): boolean =>
    typeof window !== 'undefined' && localStorage.getItem(LS_TODO_VISIBLE) === '1'
  const todoVisible = ref<boolean>(readTodoVisible())

  // 移动端拖拽中视觉隐藏状态（DOM 保留供 FC 继续拖拽）
  const mobileTodoDragging = ref(false)

  // 移动端导航抽屉（桌面 rail 常驻无需状态；入口在日历工具条左端/二级页返回条）
  const navDrawerOpen = ref(false)

  const setNavDrawerOpen = (v: boolean) => {
    navDrawerOpen.value = v
  }

  // 桌面 rail 显隐（工具条左端开关；持久化保留用户偏好，刷新不复位）。首次默认收起
  const LS_NAV_RAIL = 'nav_rail_visible'
  const readNavRailCollapsed = (): boolean =>
    typeof window === 'undefined' || localStorage.getItem(LS_NAV_RAIL) !== '1'
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
    void router.push(viewPath('settings', s))
  }

  // 日历跳转请求（提醒通知点击定位用）：gotoDate 自带日历跳转 API，
  // 但 CalendarArea 的 FC 实例与区间状态均为组件私有——以"请求-消费"模式桥接：
  // 这里置请求，CalendarArea watch 到后跳转并清空，跨组件不持有 FC 引用
  const gotoDateRequest = ref<{ date: string; ts: number } | null>(null)
  const requestGotoDate = (date: string) => {
    gotoDateRequest.value = { date, ts: Date.now() }
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
    gotoDateRequest,
    requestGotoDate,
    authReturnView,
    openAuth,
    closeAuth
  }
})
