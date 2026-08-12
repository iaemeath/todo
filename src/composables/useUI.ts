import { ref } from 'vue'

/**
 * Global UI state (singleton pattern, same as useSettings / useTheme).
 *
 * Holds cross-component view state: which overlay panel is open, whether the
 * memo sidebar is pushed in, etc. This lets the FullCalendar customButton
 * click handlers (defined in CalendarArea) toggle state owned by App.vue
 * without props/emit plumbing.
 */
// Memo sidebar (push mode)
const sidebarOpen = ref(true)

// Settings modal
const settingsOpen = ref(false)

// ⋮ dropdown menu in the calendar header
const menuOpen = ref(false)

// Reserved for the next phase (full-screen management pages)
const scheduleManageOpen = ref(false)
const todoManageOpen = ref(false)

export function useUI() {
  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value
    // Opening the sidebar should close competing overlays
    menuOpen.value = false
  }

  const openSettings = () => {
    settingsOpen.value = true
    menuOpen.value = false
  }

  const closeSettings = () => {
    settingsOpen.value = false
  }

  const toggleMenu = () => {
    menuOpen.value = !menuOpen.value
  }

  const closeMenu = () => {
    menuOpen.value = false
  }

  // Reserved for next phase
  const openScheduleManage = () => {
    scheduleManageOpen.value = true
    menuOpen.value = false
  }

  const openTodoManage = () => {
    todoManageOpen.value = true
    menuOpen.value = false
  }

  return {
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
    openTodoManage
  }
}
