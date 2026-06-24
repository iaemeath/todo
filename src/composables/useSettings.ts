import { ref, watch } from 'vue'

const LOCAL_STORAGE_SETTINGS = 'canvas_settings'

export interface Settings {
  apiBaseUrl: string
  apiKey: string
  modelName: string
}

const defaultSettings: Settings = {
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  modelName: 'deepseek-chat'
}

const settings = ref<Settings>({ ...defaultSettings })

const loadSettings = () => {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(LOCAL_STORAGE_SETTINGS)
  if (stored) {
    try {
      settings.value = { ...defaultSettings, ...JSON.parse(stored) }
    } catch (e) {
      console.error('Failed to parse settings', e)
    }
  }
}

loadSettings()

watch(settings, (newSettings) => {
  localStorage.setItem(LOCAL_STORAGE_SETTINGS, JSON.stringify(newSettings))
}, { deep: true })

export function useSettings() {
  const updateSettings = (updates: Partial<Settings>) => {
    settings.value = { ...settings.value, ...updates }
  }

  return {
    settings,
    updateSettings
  }
}
