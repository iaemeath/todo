import { ref, watch } from 'vue'

const LOCAL_STORAGE_SETTINGS = 'canvas_settings'

export interface Settings {
  aiMode: 'cloud' | 'local'
  localModelName: string
  webLlmProgress: string
  apiBaseUrl: string
  apiKey: string
  modelName: string
  slotDuration: string
  slotHeight: number
  majorLineWidth: number
  majorLineOpacity: number
  showMinorLines: boolean
  minorLineWidth: number
  minorLineOpacity: number
  startHour: number
  endHour: number
  nowIndicatorColor: string
  nowIndicatorHeight: number
  nowIndicatorOpacity: number
}

const defaultSettings: Settings = {
  aiMode: 'cloud',
  localModelName: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
  webLlmProgress: '',
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  modelName: 'deepseek-chat',
  slotDuration: '00:30:00',
  slotHeight: 50,
  majorLineWidth: 1.5,
  majorLineOpacity: 0.4,
  showMinorLines: true,
  minorLineWidth: 1.0,
  minorLineOpacity: 0.15,
  startHour: 5,
  endHour: 24,
  nowIndicatorColor: '#ef4444',
  nowIndicatorHeight: 2,
  nowIndicatorOpacity: 0.8
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
