import { ref } from 'vue'

/**
 * Global UI state (singleton pattern, same as useSettings / useTheme).
 *
 * Centralises view navigation: the top nav bar drives `currentView` and the
 * App.vue content area switches on it.
 */

export type AppView = 'home' | 'task' | 'schedule' | 'settings'

const currentView = ref<AppView>('home')

const switchView = (view: AppView) => {
  currentView.value = view
}

export function useUI() {
  return {
    currentView,
    switchView
  }
}
