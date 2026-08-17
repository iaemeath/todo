// 统一入口：消费方一律 `from '../stores'`。
// 数据导入导出在此聚合各 store 的 state。
export { useTaskStore, type Task, type Schedule } from './task'
export { useSettingsStore, type Settings, defaultSettings } from './settings'
export { useThemeStore } from './theme'
export { useUIStore, type AppView, type SettingsSection } from './ui'
export { useUsageStore, type UsageRecord } from './usage'

import { useTaskStore, type Task, type Schedule } from './task'
import { useSettingsStore, defaultSettings, type Settings } from './settings'
import { useThemeStore } from './theme'
import { useUIStore } from './ui'
import { useUsageStore, type UsageRecord } from './usage'

// ===== 数据导入导出 =====

/** 备份文件结构：version 用于未来文件格式演进识别 */
export interface ExportBundle {
  version: number
  exportedAt: string
  tasks: Task[]
  schedules: Schedule[]
  settings: Settings
  theme: { isDark: boolean }
  usage: UsageRecord[]
  todoVisible: boolean
}

const BUNDLE_VERSION = 1

// 数据均为纯 JSON 结构，深拷贝防止导出快照与 store 内部引用联动
const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

/**
 * 聚合全部持久化数据为备份快照。
 * settings 剔除 apiKey（置空），备份文件可安全分享。
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
 * 解析并校验备份文件内容，非法返回 null。
 * 核心字段（tasks/schedules）必须是数组；其余字段宽松回退默认值。
 */
export function parseBundle(raw: unknown): ExportBundle | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Partial<ExportBundle>
  if (!Array.isArray(b.tasks) || !Array.isArray(b.schedules)) return null

  const settings: Settings =
    b.settings && typeof b.settings === 'object'
      ? { ...defaultSettings, ...b.settings }
      : { ...defaultSettings }

  return {
    version: typeof b.version === 'number' ? b.version : BUNDLE_VERSION,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    tasks: b.tasks,
    schedules: b.schedules,
    settings,
    theme: { isDark: b.theme?.isDark === true },
    usage: Array.isArray(b.usage) ? b.usage : [],
    todoVisible: typeof b.todoVisible === 'boolean' ? b.todoVisible : true
  }
}

/**
 * 导入数据的逐条净化。parseBundle 只验顶层数组，这里过滤结构非法的条目
 * （启动时的 safeParse/NaN 过滤只在 boot 路径，导入路径必须同样设防）。
 */
const sanitizeTasks = (list: Task[]): Task[] => {
  const valid = (list as unknown[]).filter((t): t is Task =>
    !!t && typeof t === 'object' &&
    typeof (t as Task).id === 'string' && (t as Task).id !== '' &&
    typeof (t as Task).title === 'string'
  )
  const ids = new Set(valid.map((t) => t.id))
  // 孤儿任务（parentId 悬空）提升为顶级，否则会从任务管理树中消失却混进待办栏
  return valid.map((t) => ({
    ...t,
    parentId: t.parentId && ids.has(t.parentId) ? t.parentId : null
  }))
}

const sanitizeSchedules = (list: Schedule[]): Schedule[] => {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const TIME_RE = /^\d{1,2}:\d{2}$/
  const valid = (list as unknown[]).filter((s): s is Schedule =>
    !!s && typeof s === 'object' &&
    typeof (s as Schedule).title === 'string' &&
    DATE_RE.test(String((s as Schedule).date)) &&
    TIME_RE.test(String((s as Schedule).startTime)) &&
    TIME_RE.test(String((s as Schedule).endTime))
  )
  // 时间归一为 HH:mm（语音解析可能产出 "9:00" 这类未补零值）
  return valid.map((s) => ({
    ...s,
    startTime: String(s.startTime).padStart(5, '0'),
    endTime: String(s.endTime).padStart(5, '0')
  }))
}

/**
 * 全量覆盖导入：直接写各 store state，
 * 各 store 已有的持久化 watcher 自动落盘，UI 响应式更新，无需刷新页面。
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
