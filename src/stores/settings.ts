import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useUIStore } from './ui'

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
  /** 时间区间选择上限（天）：桌面端 */
  webMaxRangeDays: number
  /** 时间区间选择上限（天）：移动端 */
  mobileMaxRangeDays: number
  /** 手机端是否显示「月」视图按钮（网页端常驻） */
  showMonthButton: boolean
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
  nowIndicatorHeight: 2,
  webMaxRangeDays: 14,
  mobileMaxRangeDays: 7,
  showMonthButton: true
}

/**
 * 移动端首次安装的外观默认值：紧凑行高 + 极简网格。
 * 仅在无任何已存储设置时生效；用户保存过设置后以存储值为准。
 */
const mobileAppearanceDefaults: Partial<Settings> = {
  slotHeight: 30,
  majorLineWidth: 1,
  majorLineOpacity: 0.25,
  showMinorLines: false,
  // 手机屏小：「月」按钮默认隐藏，需要时到「设置-视觉与外观」打开
  // （任务/日程入口已常驻导航抽屉，不再受开关控制）
  showMonthButton: false
}

// 老数据迁移用：可见性开关的移动端默认（load 中按设备取值）
const mobileVisibilityDefaults: Pick<Settings, 'showMonthButton'> = {
  showMonthButton: false
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })

  // 加载已保存的设置（启动时立即执行）
  const load = () => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(LOCAL_STORAGE_SETTINGS)
    if (stored) {
      try {
        const storedObj = JSON.parse(stored)
        // 可见性开关为后加字段：老数据未存过时按「当前设备」取默认
        // （移动端隐藏月按钮），而非 defaultSettings 的桌面默认
        for (const key of ['showMonthButton'] as const) {
          if (storedObj[key] === undefined) {
            storedObj[key] = useUIStore().isMobile ? mobileVisibilityDefaults[key] : true
          }
        }
        settings.value = { ...defaultSettings, ...storedObj }
      } catch (e) {
        console.error('Failed to parse settings', e)
      }
    } else {
      // 首次安装：移动端用紧凑网格默认值
      settings.value = { ...defaultSettings, ...(useUIStore().isMobile ? mobileAppearanceDefaults : {}) }
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
