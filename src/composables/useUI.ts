import { ref } from 'vue'

/**
 * Global UI state (singleton pattern, same as useSettings / useTheme).
 *
 * Centralises view navigation: the top nav bar drives `currentView` and the
 * App.vue content area switches on it. Legacy overlay refs are kept for
 * backward compatibility but are no longer the primary navigation mechanism.
 */

export type AppView = 'home' | 'task' | 'schedule' | 'settings'

const currentView = ref<AppView>('home')

// Legacy state — still consumed by some components, will be phased out.
const sidebarOpen = ref(true)
const settingsOpen = ref(false)
const menuOpen = ref(false)
const scheduleManageOpen = ref(false)
const todoManageOpen = ref(false)

const switchView = (view: AppView) => {
  currentView.value = view
  menuOpen.value = false
}

// --- Legacy helpers (kept for components that still reference them) ---
const toggleSidebar = () => { sidebarOpen.value = !sidebarOpen.value }

const openSettings = () => { switchView('settings') }
const closeSettings = () => { settingsOpen.value = false }

const toggleMenu = () => { menuOpen.value = !menuOpen.value }
const closeMenu = () => { menuOpen.value = false }

const openScheduleManage = () => { switchView('schedule') }
const closeScheduleManage = () => { scheduleManageOpen.value = false }

const openTodoManage = () => { switchView('task') }
const closeTodoManage = () => { todoManageOpen.value = false }

export function useUI() {
  return {
    // Primary navigation
    currentView,
    switchView,
    // Legacy (deprecated — prefer currentView / switchView)
    sidebarOpen,
    settingsOpen,
    menuOpen,
    scheduleManageOpen,
    todoManageOpen,
    toggleSidebar,
    openSettings,
    closeSettings,
    toggleMenu,
    closeMenu,
    openScheduleManage,
    closeScheduleManage,
    openTodoManage,
    closeTodoManage
  }
}
