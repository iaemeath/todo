import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

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
  primaryColor: string
  nowIndicatorColor: string
  nowIndicatorHeight: number
}

export const defaultSettings: Settings = {
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
  primaryColor: '#758af0',
  nowIndicatorColor: 'rgba(239, 68, 68, 0.8)',
  nowIndicatorHeight: 2
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })

  // 加载已保存的设置（启动时立即执行）
  const load = () => {
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

  load()

  // 持久化：settings 变更即写回 localStorage
  watch(settings, (newSettings) => {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS, JSON.stringify(newSettings))
  }, { deep: true })

  const updateSettings = (updates: Partial<Settings>) => {
    settings.value = { ...settings.value, ...updates }
  }

  return { settings, updateSettings }
})
