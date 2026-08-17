import dayjs from 'dayjs'

/** 本地时区的今天（YYYY-MM-DD）。
 *  toISOString() 取的是 UTC 日期，东八区 0:00–8:00 之间会得到"昨天"，
 *  所有"默认今天"的场景（排期弹窗、语音兜底、LLM 上下文）一律用本函数。 */
export const todayLocal = (offsetDays = 0): string =>
  dayjs().add(offsetDays, 'day').format('YYYY-MM-DD')
