// 统一入口：消费方一律 `from '../stores'`。
// 数据导入导出在此聚合各 store 的 state。
// 类型与快照契约在 types/bundle.ts（前后端共享），此处转发导出。
export { useTaskStore, type Task, type Schedule } from './task'
export { useSettingsStore, type Settings, defaultSettings } from './settings'
export { useThemeStore } from './theme'
export { useUIStore, type AppView, type SettingsSection } from './ui'
export { useUsageStore, type UsageRecord } from './usage'
export { parseBundle, type ExportBundle } from '../types/bundle'

import { useTaskStore } from './task'
import { useSettingsStore } from './settings'
import { useThemeStore } from './theme'
import { useUIStore } from './ui'
import { useUsageStore } from './usage'
import {
  BUNDLE_VERSION,
  deepClone,
  sanitizeSchedules,
  sanitizeTasks,
  type ExportBundle
} from '../types/bundle'

// ===== 数据导入导出 =====

/**
 * 聚合全部持久化数据为备份快照。
 * settings 剔除 apiKey（置空），备份文件可安全分享；
 * 云同步（SyncManager）同样复用本函数，apiKey 天然不出本机。
 */
export function exportAllData(): ExportBundle {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const usageStore = useUsageStore()
  const uiStore = useUIStore()

  return {
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: deepClone(taskStore.tasks),
    schedules: deepClone(taskStore.schedules),
    settings: { ...deepClone(settingsStore.settings), apiKey: '' },
    theme: { isDark: themeStore.isDark },
    usage: deepClone(usageStore.usageHistory),
    todoVisible: uiStore.todoVisible
  }
}

/**
 * 全量覆盖导入：直接写各 store state，
 * 各 store 已有的持久化 watcher 自动落盘，UI 响应式更新，无需刷新页面。
 * 注意：bundle.settings.apiKey 通常为空（导出时剔除）——云同步拉取场景
 * 由 SyncManager 在调用前回填本机 apiKey，避免登录后丢密钥。
 */
export function importAllData(bundle: ExportBundle): void {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const usageStore = useUsageStore()
  const uiStore = useUIStore()

  taskStore.tasks = sanitizeTasks(bundle.tasks)
  taskStore.schedules = sanitizeSchedules(bundle.schedules)
  settingsStore.settings = bundle.settings
  themeStore.isDark = bundle.theme.isDark
  usageStore.usageHistory = bundle.usage
  uiStore.setTodoVisible(bundle.todoVisible)
}
