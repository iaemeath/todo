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
import { useSettingsStore, defaultSettings } from './settings'
import { useThemeStore } from './theme'
import { useUIStore } from './ui'
import { useUsageStore } from './usage'
import {
  BUNDLE_VERSION,
  deepClone,
  type ExportBundle
} from '../types/bundle'

// ===== 数据导入导出 =====

/**
 * 聚合全部持久化数据为备份快照。
 * settings 剔除 apiKey（置空），备份文件可安全分享。
 * 导出只含活跃数据（墓碑是同步层的删除传播标记，不属于人读的备份内容）；
 * 云同步由 SyncManager 直接收集 store 全集（含墓碑），不复用本函数。
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
    tasks: deepClone(taskStore.tasks).filter((t) => !t.deletedAt),
    schedules: deepClone(taskStore.schedules).filter((s) => !s.deletedAt),
    settings: { ...deepClone(settingsStore.settings), apiKey: '' },
    theme: { isDark: themeStore.isDark },
    usage: deepClone(usageStore.usageHistory),
    todoVisible: uiStore.todoVisible
  }
}

/**
 * 全量覆盖导入已收敛到 SyncManager.importBundle（文件导入/备份回滚同一语义入口）：
 * 含 sanitize、差集墓碑（防云端旧记录复活）、本机 apiKey 保留、同步基线作废。
 * 此处不再重复实现——两条导入路径分叉曾是数据不一致的来源。
 */

/**
 * 账号隔离：清空全部业务数据到初始状态（各 store 持久化 watcher 自动落盘，
 * 下次启动不会误触种子数据——存储值为 '[]' 而非 null）。
 * 登出/账号切换时调用：本地数据无账号归属，不清会把 A 的数据全量推给 B。
 * apiKey 是本机级配置（不出现在导出/同步中），保留。
 */
export function clearAllStores(): void {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const usageStore = useUsageStore()
  taskStore.tasks = []
  taskStore.schedules = []
  settingsStore.settings = { ...defaultSettings, apiKey: settingsStore.settings.apiKey }
  // 主题回到系统偏好（与 loadTheme 无存储分支同语义），watcher 负责落盘与 DOM 应用
  themeStore.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  usageStore.usageHistory = []
}
