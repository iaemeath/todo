import { ref, watch } from 'vue'
import { useSettings } from './useSettings'

const LOCAL_STORAGE_THEME = 'canvas_theme'
const isDark = ref(false)

// 主题色单例：运行时把用户选择的主题色注入 :root，覆盖 theme.css 的静态默认值。
// light/dark/alpha 等派生变量在 theme.css 中用 color-mix 引用 --color-primary，
// 因此这里只改主色，全站（含 Element Plus）自动跟随。
const { settings } = useSettings()

const applyPrimaryColor = (color: string) => {
  if (typeof document !== 'undefined' && color) {
    document.documentElement.style.setProperty('--color-primary', color)
  }
}

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
  applyPrimaryColor(settings.value.primaryColor)
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

// 主题色变化时即时注入 :root（用户在设置页改色时实时生效）
watch(() => settings.value.primaryColor, (color) => {
  applyPrimaryColor(color)
})

export function useTheme() {
  return {
    isDark,
    toggleTheme,
    loadTheme
  }
}
