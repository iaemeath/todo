import { ref, watch } from 'vue'

const LOCAL_STORAGE_THEME = 'canvas_theme'
const isDark = ref(false)

const loadTheme = () => {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(LOCAL_STORAGE_THEME)
  if (stored) {
    isDark.value = stored === 'dark'
  } else {
    // Check system preference
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme(isDark.value)
}

const applyTheme = (dark: boolean) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    // Element Plus dark mode listens for the `dark` class on <html>
    document.documentElement.classList.toggle('dark', dark)
  }
}

const toggleTheme = () => {
  isDark.value = !isDark.value
}

// Watch for changes and save to local storage
watch(isDark, (newVal) => {
  localStorage.setItem(LOCAL_STORAGE_THEME, newVal ? 'dark' : 'light')
  applyTheme(newVal)
})

export function useTheme() {
  return {
    isDark,
    toggleTheme,
    loadTheme
  }
}
