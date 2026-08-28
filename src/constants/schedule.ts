import type { EventColor } from './colors'

/**
 * 新建日程默认时段/颜色的单一数据源。
 * 日历弹窗（CalendarArea）、任务排期（TaskManagePage/task store）、语音排期
 * （VoiceAssistant）、LLM 提示词（llmService）共用——历史上四处各写一套导致
 * 漂移（语音 12:00 起 vs 手动 09:00 起），改默认值只改这里。
 */
export const DEFAULT_SCHEDULE_START = '09:00'
export const DEFAULT_SCHEDULE_END = '10:00'
export const DEFAULT_SCHEDULE_COLOR: EventColor = 'blue'

/**
 * 日程提前提醒量的预设档与解析/格式化（纯函数，双表单 + 单测共用）。
 * 语义（与 Schedule.remindMinutes 对齐）：0=准时；-1=本条不提醒；N>0=提前 N 分钟。
 * 预设档下拉 + allow-create 自定义任意分钟数共用一套解析，防两处表单行为分叉。
 */
export const REMIND_MIN = 0
export const REMIND_MAX = 10_080 // 一周：超过一周的提前量没有业务意义
export const REMIND_NEVER = -1

export const REMIND_PRESETS: { label: string; value: number }[] = [
  { label: '不提醒', value: REMIND_NEVER },
  { label: '准时（开始时刻）', value: 0 },
  { label: '提前 5 分钟', value: 5 },
  { label: '提前 10 分钟', value: 10 },
  { label: '提前 1 小时', value: 60 }
]

/** 提醒量 → 展示文案：预设档回显与自定义值（如 45 → 「提前 45 分钟」）统一走这里 */
export const formatRemindLabel = (n: number): string => {
  if (n === REMIND_NEVER) return '不提醒'
  if (n === 0) return '准时（开始时刻）'
  if (n === 60) return '提前 1 小时'
  return `提前 ${n} 分钟`
}

/**
 * 表单输入（预设选中或 allow-create 键入的字符串）→ 合法提醒量；非法返回 null。
 * -1 仅预设语义，键入 -1 同样接受（等价「不提醒」）；上限 REMIND_MAX。
 * 注意 Number('')/Number(null) 均为 0，空值须先行拒绝防误判「准时」。
 */
export const parseRemindInput = (raw: string): number | null => {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < REMIND_NEVER || n > REMIND_MAX) return null
  return n
}

/** 落库/同步数据的域校验（sanitizeSchedules 用）：非整数/越界视为非法 */
export const isValidRemindMinutes = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= REMIND_NEVER && v <= REMIND_MAX
