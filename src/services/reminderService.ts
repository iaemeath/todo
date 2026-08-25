/**
 * 日程提醒调度器（模块级单例）：到点精确提醒。
 *
 * 调度模型（事件驱动，无轮询）：任意时刻只挂一个定时器，指向「最近的未来开始时刻」；
 * 触发后扫描所有已到点日程 → 逐条提醒 → 重新 arm 下一个。四个配套机制：
 * ① 变更驱动重算：schedules 深度 watch（新增/拖拽/编辑/删除/同步落地）防抖重挂；
 *    remindEnabled 开关切换即时重挂/解除
 * ② 启动/唤醒一次性扫描：应用关着或系统睡过去的日程——仍进行中补一条「已开始」，
 *    已结束静默跳过（不打扰陈年旧账）
 * ③ 唤醒兜底：主进程 powerMonitor(resume/unlock-screen) 经 preload 的 onWake 转发
 *    + visibilitychange/online 双保险——睡眠时定时器冻结是唯一盲区
 * ④ 漂移自校：onDue 时目标仍未到（超长延时被截断等）→ arm 重定向剩余差值
 *
 * 仅桌面壳（Electron）生效：以 window.shiguang 桥存在为准（dev 联调 http://localhost 下
 * 桥照样注入，调度可测）；网页端 startReminders 直接返回（HTTPS 前不做降级）。
 * 触发走 window.shiguang.notify（preload IPC）→ 主进程系统通知 + 任务栏闪烁；
 * 点击通知回推 remind:locate → 回主页并把日历跳到该日程日期。
 */
import { watch, type WatchStopHandle } from 'vue'
import { useSettingsStore, useTaskStore, useUIStore } from '../stores'
import type { Schedule } from '../types/bundle'

const LS_FIRED = 'fired_reminders'
/** 已触发记录保留 7 天：防刷新/重启重复弹，过期清理 */
const FIRED_RETENTION_MS = 7 * 24 * 60 * 60_000
/** schedules 变更后的重挂防抖（拖拽/同步批量落地不逐条重算） */
const REARM_DEBOUNCE_MS = 500
/** setTimeout 延时上限截断（2^31-1ms ≈ 24.8 天，超限会立即触发）——截断后靠漂移自校补差值 */
const MAX_TIMEOUT_MS = 2 ** 30
/** 超过该迟到的触发改叫「已开始」（正常到点触发与它文案不同） */
const LATE_THRESHOLD_MS = 15_000

let started = false
let timer: number | null = null
let rearmDebounce: number | null = null
let stopSchedulesWatch: WatchStopHandle | null = null
let stopSettingsWatch: WatchStopHandle | null = null
let stopCloseToTrayWatch: WatchStopHandle | null = null
let detachLifecycleListeners: (() => void) | null = null

// ===== 已触发去重 =====

const loadFired = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(LS_FIRED)
    if (!raw) return {}
    const map = JSON.parse(raw) as Record<string, number>
    const cutoff = Date.now() - FIRED_RETENTION_MS
    for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k]
    return map
  } catch {
    return {}
  }
}
const fired = loadFired()

const persistFired = () => {
  const cutoff = Date.now() - FIRED_RETENTION_MS
  for (const k of Object.keys(fired)) if (fired[k] < cutoff) delete fired[k]
  localStorage.setItem(LS_FIRED, JSON.stringify(fired))
}

// ===== 时间换算（沿用 ScheduleManagePage.endMs 的本地时区惯例） =====

const startMs = (s: Schedule) => new Date(`${s.date}T${s.startTime}:00`).getTime()
const endMs = (s: Schedule) => new Date(`${s.date}T${s.endTime}:00`).getTime()
const fireKey = (s: Schedule) => `${s.id}@${startMs(s)}`

/** 合法候选：时段有效（开始<结束）且尚未触发过 */
const candidates = (): Schedule[] => {
  const { activeSchedules } = useTaskStore()
  return activeSchedules.filter((s) => {
    const st = startMs(s)
    return Number.isFinite(st) && st < endMs(s) && !fired[fireKey(s)]
  })
}

// ===== 触发 =====

const fire = (s: Schedule) => {
  const late = Date.now() - startMs(s) > LATE_THRESHOLD_MS
  window.shiguang?.notify({
    title: late ? '日程已开始' : '日程开始',
    body: `《${s.title}》 ${s.startTime} 开始`,
    scheduleId: s.id,
    date: s.date
  })
  fired[fireKey(s)] = Date.now()
  persistFired()
}

/**
 * 扫描并触发所有「已到点且仍在进行中」的候选（启动/唤醒/定时器到期共用）。
 * 到点但已结束的不补（陈年旧账不打扰）；未到点的留给 arm 的定时器。
 */
const scanDue = () => {
  const now = Date.now()
  for (const s of candidates()) {
    const st = startMs(s)
    if (st <= now && now < endMs(s)) fire(s)
  }
}

/** 挂定时器到「最近的未来开始时刻」。开关关闭/无候选时清空定时器。 */
const arm = () => {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  if (!useSettingsStore().settings.remindEnabled) return
  const now = Date.now()
  let next = Infinity
  for (const s of candidates()) {
    const st = startMs(s)
    if (st > now && st < next) next = st
  }
  if (next === Infinity) return
  timer = window.setTimeout(onDue, Math.min(next - now, MAX_TIMEOUT_MS))
}

/** 定时器到期：触发所有已到点者，再 arm 下一个（目标未到的极端早醒由 arm 重定向） */
const onDue = () => {
  timer = null
  scanDue()
  arm()
}

const scheduleRearm = () => {
  if (rearmDebounce !== null) clearTimeout(rearmDebounce)
  rearmDebounce = window.setTimeout(() => {
    rearmDebounce = null
    arm()
  }, REARM_DEBOUNCE_MS)
}

// ===== 生命周期 =====

/** 启动提醒调度（App.vue 挂载时调用；网页端无操作）。幂等。 */
export const startReminders = () => {
  if (started || typeof window === 'undefined') return
  // 桥在即桌面壳：dev 联调（ELECTRON_START_URL=http://localhost）下 preload 照样注入，
  // 比 file:// 协议判断可靠（见 apiClient.hasDesktopBridge 注释）
  const bridge = window.shiguang
  if (!bridge) return
  started = true

  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()

  // 启动扫描：应用关着错过的进行中日程补一条「已开始」，然后挂第一个定时器
  scanDue()
  arm()

  // ① 变更驱动重算：拖拽改时间/新增/删除/云同步落地都会走这里
  stopSchedulesWatch = watch(
    () => taskStore.schedules,
    scheduleRearm,
    { deep: true }
  )
  // 总开关切换即时生效（开→arm；关→arm 内部清定时器）
  stopSettingsWatch = watch(
    () => settingsStore.settings.remindEnabled,
    () => arm()
  )

  // 关闭驻留设置随改随推主进程（close 拦截行为由主进程持有）
  const pushCloseToTray = (v: boolean) => window.shiguang?.setCloseToTray(v)
  pushCloseToTray(settingsStore.settings.closeToTray)
  stopCloseToTrayWatch = watch(() => settingsStore.settings.closeToTray, pushCloseToTray)

  // ③ 唤醒兜底：点击系统通知 → 回主页并跳转该日程日期
  bridge.onLocate(({ date }) => {
    useUIStore().switchView('home')
    useUIStore().requestGotoDate(date)
  })
  // ③ 唤醒兜底：系统唤醒/解锁（主进程 powerMonitor 转发）→ 补扫描 + 重挂
  bridge.onWake(() => {
    scanDue()
    arm()
  })
  // ③ 双保险：页面可见性恢复 / 网络恢复（隐藏窗口不触发 visibilitychange，纯冗余）
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      scanDue()
      arm()
    }
  }
  const onOnline = () => {
    scanDue()
    arm()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  detachLifecycleListeners = () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  }
}

/** 停止调度（App 卸载时调用，与 startSync/stopSync 对称）。幂等。 */
export const stopReminders = () => {
  if (!started) return
  started = false
  if (timer !== null) clearTimeout(timer)
  if (rearmDebounce !== null) clearTimeout(rearmDebounce)
  timer = null
  rearmDebounce = null
  stopSchedulesWatch?.()
  stopSettingsWatch?.()
  stopCloseToTrayWatch?.()
  detachLifecycleListeners?.()
  stopSchedulesWatch = null
  stopSettingsWatch = null
  stopCloseToTrayWatch = null
  detachLifecycleListeners = null
}
