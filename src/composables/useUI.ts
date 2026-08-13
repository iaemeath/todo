import { ref } from 'vue'

/**
 * Global UI state (singleton pattern, same as useSettings / useTheme).
 *
 * Centralises view navigation + mobile device detection. The top nav bar
 * drives `currentView` and the App.vue content area switches on it. `isMobile`
 * is a single shared ref backed by ONE resize listener (rAF-throttled) —
 * components must not spin up their own.
 */

export type AppView = 'home' | 'task' | 'schedule' | 'settings'

const MOBILE_BREAKPOINT = 768

const currentView = ref<AppView>('home')
const isMobile = ref(false)

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
}

export function useUI() {
  return {
    currentView,
    switchView,
    isMobile
  }
}
