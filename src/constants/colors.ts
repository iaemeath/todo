// 日程颜色系统：单一数据源。
// 修改颜色只需改本文件，CalendarArea / TaskManagePage / ScheduleManagePage / llmService 自动跟随。

/** 日程颜色标识（业务层只存这个 key，不存 hex） */
export type EventColor = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan'

/** 默认颜色 */
export const DEFAULT_EVENT_COLOR: EventColor = 'blue'

/** 每种颜色的视觉派生（日历事件渲染用） */
export interface ColorScheme {
  fill: string
  stroke: string
  text: string
  textLight: string
}

/** 颜色名 → 视觉派生（CalendarArea 事件渲染） */
export const colorMap: Record<EventColor, ColorScheme> = {
  violet: { fill: 'rgba(139, 92, 246, 0.12)', stroke: 'rgba(139, 92, 246, 0.5)', text: '#a78bfa', textLight: '#6d28d9' },
  blue: { fill: 'rgba(59, 130, 246, 0.12)', stroke: 'rgba(59, 130, 246, 0.5)', text: '#93c5fd', textLight: '#1d4ed8' },
  emerald: { fill: 'rgba(16, 185, 129, 0.12)', stroke: 'rgba(16, 185, 129, 0.5)', text: '#6ee7b7', textLight: '#047857' },
  amber: { fill: 'rgba(245, 158, 11, 0.12)', stroke: 'rgba(245, 158, 11, 0.5)', text: '#fde047', textLight: '#b45309' },
  rose: { fill: 'rgba(244, 63, 94, 0.12)', stroke: 'rgba(244, 63, 94, 0.5)', text: '#fda4af', textLight: '#be123c' },
  cyan: { fill: 'rgba(6, 182, 212, 0.12)', stroke: 'rgba(6, 182, 212, 0.5)', text: '#67e8f9', textLight: '#0369a1' }
}

export interface ColorOption {
  value: EventColor
  label: string
  hex: string
}

/** 颜色选择器选项（新增/编辑日程、任务管理都用它） */
export const colorOptions: ColorOption[] = [
  { value: 'violet', label: '紫色', hex: '#8b5cf6' },
  { value: 'blue', label: '蓝色', hex: '#3b82f6' },
  { value: 'emerald', label: '绿色', hex: '#10b981' },
  { value: 'amber', label: '琥珀', hex: '#f59e0b' },
  { value: 'rose', label: '玫红', hex: '#f43f5e' },
  { value: 'cyan', label: '青色', hex: '#06b6d4' }
]

/** 供 LLM prompt 引用：颜色 key 列表（如 "violet, blue, emerald, amber, rose, cyan"） */
export const EVENT_COLOR_KEYS = colorOptions.map(c => c.value).join(', ')

// ---- helpers（接受运行期 string，内部做兜底）----

/** 颜色名 → 视觉派生，未知颜色回退 blue */
export const colorScheme = (v: string): ColorScheme =>
  colorMap[v as EventColor] ?? colorMap.blue

/** 颜色名 → hex，未知回退 blue 的 hex */
export const colorHex = (v: string): string =>
  colorOptions.find(c => c.value === v)?.hex ?? '#3b82f6'

/** 颜色名 → 中文标签，未知回退原值 */
export const colorLabel = (v: string): string =>
  colorOptions.find(c => c.value === v)?.label ?? v
