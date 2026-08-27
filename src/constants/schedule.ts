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
