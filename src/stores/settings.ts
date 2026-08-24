import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useUIStore } from './ui'
import { defaultSettings, type Settings } from '../types/bundle'

// 契约定义在 types/bundle.ts（前后端共享），此处 re-export 保持既有 import 路径兼容
export { defaultSettings } from '../types/bundle'
export type { Settings } from '../types/bundle'

const LOCAL_STORAGE_SETTINGS = 'canvas_settings'

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
