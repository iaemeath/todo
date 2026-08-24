/**
 * 数据契约层：前后端共享的纯类型与纯函数。
 * 铁律：本文件禁止 import vue/pinia/dayjs 等任何运行时依赖——
 * 后端（server/）直接 import 此文件做快照校验，两端数据结构以此为准。
 */

// ===== Tasks / Schedules =====

/**
 * 任务（树形，最多 3 级）。
 * 顶级任务 parentId = null；有子节点的任务不会出现在右侧「待办」中。
 */
export interface Task {
  id: string
  parentId: string | null
  title: string
  description: string
  category: string // work, personal, fitness, ideas, shopping, other
  priority: string // high, medium, low
  completed: boolean
  order: number // 同级排序
  /** 记录级同步：修订时间（毫秒）——LWW 裁决依据，本地增改时自动打 */
  revTime?: number
  /** 记录级同步：墓碑（软删除时间）。UI 层过滤，同步层保留用于跨端传播删除 */
  deletedAt?: number
}

/**
 * 日程（相对独立的日历事件）。可通过 taskId 关联到一个叶子任务。
 */
export interface Schedule {
  id: string
  taskId?: string // 关联叶子任务；独立日程为空
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  color: string // violet, blue, emerald, amber, rose, cyan
  /** 记录级同步字段（语义同 Task） */
  revTime?: number
  deletedAt?: number
}

// ===== Settings =====

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

// ===== Usage =====

export interface UsageRecord {
  id: string
  date: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requestContent?: string
  responseContent?: string
  rawPrompt?: string
}

// ===== 备份/同步快照（ExportBundle）=====

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

export const BUNDLE_VERSION = 1

// 数据均为纯 JSON 结构，深拷贝防止导出快照与 store 内部引用联动
export const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

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
export const sanitizeTasks = (list: Task[]): Task[] => {
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

export const sanitizeSchedules = (list: Schedule[]): Schedule[] => {
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
