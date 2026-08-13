import { ref } from 'vue'

/**
 * Global UI state (singleton pattern, same as useSettings / useTheme).
 *
 * Centralises view navigation + mobile device detection + the current settings
 * sub-section (shared between AppNavBar's back-button title and SettingsPage).
 */

export type AppView = 'home' | 'task' | 'schedule' | 'settings'
export type SettingsSection = 'list' | 'view' | 'ai' | 'usage'

const MOBILE_BREAKPOINT = 768

const currentView = ref<AppView>('home')
const isMobile = ref(false)
// 移动端设置子页：'list'=选项列表；选中后为对应面板。AppNavBar 据此显示返回按钮标题。
const settingsSection = ref<SettingsSection>('list')

// --- Device detection (singleton, attached once) ---
let resizeInit = false
const detect = () => {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
}
const initResize = () => {
  if (resizeInit || typeof window === 'undefined') return
  resizeInit = true
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

export function useUI() {
  return {
    currentView,
    switchView,
    isMobile,
    settingsSection,
    setSettingsSection
  }
}
