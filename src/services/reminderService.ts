/**
 * 日程提醒调度器（模块级单例）：到点精确提醒。
 *
 * 调度模型（事件驱动，无轮询）：四个配套机制，桌面/安卓共用——
 * ① 变更驱动重算：schedules 深度 watch（新增/拖拽/编辑/删除/同步落地）防抖重挂；
 *    remindEnabled 开关切换即时重挂/解除
 * ② 启动/唤醒一次性扫描：应用关着或系统睡过去的日程——仍进行中补一条「已开始」，
 *    已结束静默跳过（不打扰陈年旧账）
 * ③ 唤醒兜底：桌面 powerMonitor(onWake)/visibilitychange/online——睡眠时定时器冻结
 *    或进程被杀是唯一盲区
 * ④ 已触发去重：localStorage FIRED 表留 7 天，防刷新/重启重复弹
 *
 * 双后端（编排层共用，触发器分平台）：
 * - timer（桌面壳，window.shiguang 桥）：单定时器指向最近的未来开始时刻，触发走桥
 *   notify（closeToTray 驻留托盘保活 JS）；漂移自校：onDue 时目标未到则 arm 重定向
 * - alarms（安卓壳，isNativeShell）：JS 只编排——syncAlarms 把「未来 14 天」候选差集
 *   同步成系统闹钟（AlarmManager 持有，应用被杀/重启照发，插件内置 BOOT_COMPLETED
 *   恢复），到点由原生直接发通知；应用前台时插件同时回传 localNotificationReceived
 *   （记 FIRED），点击通知回传 extra（回主页 + 跳日期）。被杀期间错过且不在通知栏
 *   在显的，仍由 scanDue 兜底补「已开始」。
 * 网页端两个后端都没有 → startReminders 直接返回。
 */
import { watch, type WatchStopHandle } from 'vue'
import type { PluginListenerHandle } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import { useSettingsStore, useTaskStore, useUIStore } from '../stores'
import { hasDesktopBridge, isNativeShell } from './apiClient'
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

/** 闹钟挂载视野：只预挂近两周（通常百条内）；出窗的日程随每次变更/唤醒/打开的
 *  差集同步自然补挂（与 webMaxRangeDays=14 的选择习惯呼应，但不联动该设置） */
const ALARM_HORIZON_MS = 14 * 24 * 60 * 60_000
/** 高优先级渠道（IMPORTANCE_HIGH=4 横幅 + 系统默认通知音 + 震动）；创建幂等，首启建一次 */
const ALARM_CHANNEL_ID = 'shiguang-reminders'
/** 进程常驻时的视野滑动节拍（后台 WebView 冻结时它不跑，恢复由 visibilitychange 兜底） */
const ALARM_RESYNC_INTERVAL_MS = 6 * 60 * 60_000

type Backend = 'timer' | 'alarms'

let started = false
let backend: Backend | null = null
let timer: number | null = null
let rearmDebounce: number | null = null
let alarmHandles: PluginListenerHandle[] = []
let alarmInterval: number | null = null
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

const markFired = (key: string) => {
  fired[key] = Date.now()
  persistFired()
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
  markFired(fireKey(s))
  if (backend === 'alarms') {
    // scanDue 兜底路径（系统闹钟被 ROM 吞/用户 force stop 后的首开）：1 秒后经同一渠道
    // 补发；id 与原闹钟同源，若原闹钟仍在等发（不精确被推迟）会被本次重挂顶掉，不重复
    void LocalNotifications.schedule({
      notifications: [alarmRequest(s, new Date(Date.now() + 1000), late, false)]
    }).catch(() => undefined) // 通知权限被拒时静默（设置页有引导态）
  } else {
    window.shiguang?.notify({
      title: late ? '日程已开始' : '日程开始',
      body: `《${s.title}》 ${s.startTime} 开始`,
      scheduleId: s.id,
      date: s.date
    })
  }
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

// ===== timer 后端（桌面壳，现状不变） =====

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

// ===== alarms 后端（安卓壳） =====

/** fireKey → 稳定 31 位非负整数（插件通知 id 是 int32）。FNV-1a 截断；两周视野内活跃
 *  集通常几十条，碰撞概率 ~1e-6 量级，且 fireKey 含时间戳（改时间即换 id），可忽略 */
const alarmId = (s: Schedule): number => {
  const key = fireKey(s)
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  return h >>> 1
}

/** 通知请求体：extra 带定位三元组，前台接收/点击事件据此回主页跳日期。
 *  exact 仅常规挂载用；兜底补发（1 秒后）走非精确——避免 API 31/32 无精确闹钟权限时
 *  schedule() 触发插件拉起系统设置页打断用户 */
const alarmRequest = (s: Schedule, at: Date, late = false, exact = true): LocalNotificationSchema => ({
  id: alarmId(s),
  title: late ? '日程已开始' : '日程开始',
  body: `《${s.title}》 ${s.startTime} 开始`,
  channelId: ALARM_CHANNEL_ID,
  // 安卓：foreground 抬优先级 → 前台也走横幅；exact + allowWhileIdle 双保险穿透 Doze
  foreground: true,
  isExactNotification: exact,
  schedule: { at, allowWhileIdle: true },
  extra: { scheduleId: s.id, date: s.date, start: startMs(s) }
})

let alarmSyncing = false
let alarmSyncQueued = false

/**
 * 差集同步（防抖后的安卓侧重算入口）：期望集 = 候选中「未来 14 天内」者，与插件已存
 * 闹钟对账——缺失补挂、at 不符（改时间）换挂、多余（删日程/已触发/关开关）cancel。
 * 对已送达的在显通知 cancel 只清闹钟和记录、不撤横幅（插件语义），放心清。
 * 顺带对账已过点候选：通知栏仍在显 = 原生已送达（应用被杀期间发的）→ 记 FIRED 防
 * scanDue 重复补发；不在显（被 ROM 吞/用户已划掉）→ 不记，留给 scanDue 补「已开始」。
 */
const syncAlarms = async (): Promise<void> => {
  if (alarmSyncing) {
    alarmSyncQueued = true
    return
  }
  alarmSyncing = true
  try {
    const now = Date.now()
    const enabled = useSettingsStore().settings.remindEnabled
    const desired = new Map<number, { s: Schedule; st: number }>()
    const dueKeys = new Map<number, string>()
    if (enabled) {
      for (const s of candidates()) {
        const st = startMs(s)
        const id = alarmId(s)
        if (st > now && st <= now + ALARM_HORIZON_MS) desired.set(id, { s, st })
        else if (st <= now) dueKeys.set(id, fireKey(s))
      }
    }
    let pending: Awaited<ReturnType<typeof LocalNotifications.getPending>> = { notifications: [] }
    let delivered: Awaited<ReturnType<typeof LocalNotifications.getDeliveredNotifications>> = {
      notifications: []
    }
    try {
      ;[pending, delivered] = await Promise.all([
        LocalNotifications.getPending(),
        LocalNotifications.getDeliveredNotifications()
      ])
    } catch {
      return // 桥偶发不可用：跳过本轮，下次变更/唤醒自然重算
    }
    const deliveredIds = new Set(delivered.notifications.map((n) => n.id))
    const toCancel: number[] = []
    for (const p of pending.notifications) {
      const want = desired.get(p.id)
      const at = p.schedule?.at ? new Date(p.schedule.at).getTime() : NaN
      if (want !== undefined && at === want.st) desired.delete(p.id) // 已挂且时刻一致
      else toCancel.push(p.id)
      const key = dueKeys.get(p.id)
      if (key !== undefined && deliveredIds.has(p.id)) markFired(key)
    }
    if (toCancel.length) {
      await LocalNotifications.cancel({ notifications: toCancel.map((id) => ({ id })) })
    }
    if (desired.size) {
      const notifications = [...desired.values()].map(({ s, st }) => alarmRequest(s, new Date(st)))
      await LocalNotifications.schedule({ notifications })
    }
  } catch {
    // 差集同步整体失败（权限流程中断等）：保持现状，下次触发重算
  } finally {
    alarmSyncing = false
    if (alarmSyncQueued) {
      alarmSyncQueued = false
      void syncAlarms()
    }
  }
}

/** alarms 后端异步初始化：渠道 → 通知权限 → 事件监听 → 首轮同步 + 补扫 → 视野滑动节拍 */
const initAlarmBackend = async () => {
  try {
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL_ID,
      name: '日程提醒',
      importance: 4, // IMPORTANCE_HIGH：横幅弹出
      visibility: 1, // PUBLIC：锁屏可见
      vibration: true
    })
  } catch {
    // 已存在同 id 渠道或桥不可用：沿用现状，不阻塞
  }
  if (useSettingsStore().settings.remindEnabled) {
    // Android 13+ POST_NOTIFICATIONS：首启（开关默认开）请求一次；拒绝则闹钟照挂但
    // 通知不显示——设置页有引导态。之后开开关的场景由 schedule() 内置请求兜底
    await LocalNotifications.requestPermissions().catch(() => undefined)
  }
  alarmHandles.push(
    ...(await Promise.all([
      // 应用前台时原生照发（foreground 横幅），同时回传事件 → 记 FIRED
      LocalNotifications.addListener('localNotificationReceived', (n) => {
        const extra = n.extra as { scheduleId?: string; start?: number } | undefined
        if (extra && typeof extra.scheduleId === 'string' && typeof extra.start === 'number') {
          markFired(`${extra.scheduleId}@${extra.start}`)
        }
      }),
      // 点击通知 → 复刻桌面 onLocate：回主页并跳转该日程日期（extra 由挂载时写入）
      LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
        const extra = e.notification.extra as { date?: string } | undefined
        if (extra && typeof extra.date === 'string') {
          useUIStore().switchView('home')
          useUIStore().requestGotoDate(extra.date)
        }
      })
    ]))
  )
  await syncAlarms()
  scanDue()
  alarmInterval = window.setInterval(() => void syncAlarms(), ALARM_RESYNC_INTERVAL_MS)
}

// ===== 重算入口与唤醒兜底（双后端共用） =====

/** 防抖到点的重算：桌面 = arm 单定时器；安卓 = 闹钟差集同步 */
const resync = () => {
  if (backend === 'alarms') void syncAlarms()
  else arm()
}

/** 唤醒类兜底（onWake/可见性/网络恢复）：安卓先对账（顺带把原生已送达者记账防重复）再补扫 */
const compensate = () => {
  if (backend === 'alarms') void syncAlarms().then(() => scanDue())
  else {
    scanDue()
    arm()
  }
}

const scheduleRearm = () => {
  if (rearmDebounce !== null) clearTimeout(rearmDebounce)
  rearmDebounce = window.setTimeout(() => {
    rearmDebounce = null
    resync()
  }, REARM_DEBOUNCE_MS)
}

// ===== 生命周期 =====

/** 启动提醒调度（App.vue 挂载时调用；网页端无操作）。幂等。 */
export const startReminders = () => {
  if (started || typeof window === 'undefined') return
  // 桥在即桌面壳：dev 联调（ELECTRON_START_URL=http://localhost）下 preload 照样注入，
  // 比 file:// 协议判断可靠（见 apiClient.hasDesktopBridge 注释）；否则安卓壳走闹钟后端
  if (hasDesktopBridge) backend = 'timer'
  else if (isNativeShell) backend = 'alarms'
  else return
  started = true

  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()

  if (backend === 'alarms') void initAlarmBackend()
  else {
    // 启动扫描：应用关着错过的进行中日程补一条「已开始」，然后挂第一个定时器
    scanDue()
    arm()
  }

  // ① 变更驱动重算：拖拽改时间/新增/删除/云同步落地都会走这里
  stopSchedulesWatch = watch(
    () => taskStore.schedules,
    scheduleRearm,
    { deep: true }
  )
  // 总开关切换即时生效（开→挂；关→arm 清定时器/闹钟同步清空）
  stopSettingsWatch = watch(
    () => settingsStore.settings.remindEnabled,
    () => resync()
  )

  if (backend === 'timer') {
    // 关闭驻留设置随改随推主进程（close 拦截行为由主进程持有）
    const pushCloseToTray = (v: boolean) => window.shiguang?.setCloseToTray(v)
    pushCloseToTray(settingsStore.settings.closeToTray)
    stopCloseToTrayWatch = watch(() => settingsStore.settings.closeToTray, pushCloseToTray)

    const bridge = window.shiguang
    // 点击系统通知 → 回主页并跳转该日程日期
    bridge?.onLocate(({ date }) => {
      useUIStore().switchView('home')
      useUIStore().requestGotoDate(date)
    })
    // 系统唤醒/解锁（主进程 powerMonitor 转发）→ 补扫描 + 重挂
    bridge?.onWake(compensate)
  }

  // ③ 双保险：页面可见性恢复 / 网络恢复（安卓后台冻结的 WebView 恢复也走这里；
  // 桌面隐藏窗口不触发 visibilitychange，纯冗余）
  const onVisible = () => {
    if (document.visibilityState === 'visible') compensate()
  }
  const onOnline = compensate
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  detachLifecycleListeners = () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  }
}

/** 停止调度（App 卸载时调用，与 startSync/stopSync 对称）。幂等。
 *  注意安卓侧不清系统闹钟：进程被杀/划掉根本走不到这里，闹钟正是为此而设；
 *  dev 热重载触发 stop→start 时，start 的差集同步会自动对账纠偏。 */
export const stopReminders = () => {
  if (!started) return
  started = false
  if (timer !== null) clearTimeout(timer)
  if (rearmDebounce !== null) clearTimeout(rearmDebounce)
  if (alarmInterval !== null) clearInterval(alarmInterval)
  for (const h of alarmHandles) void h.remove()
  timer = null
  rearmDebounce = null
  alarmInterval = null
  alarmHandles = []
  backend = null
  stopSchedulesWatch?.()
  stopSettingsWatch?.()
  stopCloseToTrayWatch?.()
  detachLifecycleListeners?.()
  stopSchedulesWatch = null
  stopSettingsWatch = null
  stopCloseToTrayWatch = null
  detachLifecycleListeners = null
}
