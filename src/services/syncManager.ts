/**
 * 云同步管理器（模块级单例）：记录级同步（v4.5）。
 * 本地优先——localStorage 始终是运行时主存储，同步是旁路任务，失败只改状态不阻塞使用。
 *
 * 数据模型：每条数据独立成记录 {c: 集合, id, data, rev}，同条记录 LWW（rev 新者胜）：
 * - tasks/schedules：data=整条记录（含 revTime/deletedAt 墓碑），rev=记录内嵌 revTime
 * - settings 按字段记录化（字段级合并：A 改主题色、B 改时段长度互不覆盖）
 * - meta（theme/todoVisible）、usage（追加型日志）同模型
 *
 * 推送：全量收集 → 与 lastSyncedMap diff → 变更集上行（服务端逐条裁决，被拒=对端更新）
 * 拉取：recv_time 游标增量（服务端时钟，绝不漏数据）→ 按 revTime 合并（双时间戳：
 *       rev=客户端时钟管裁决方向，recv=服务端时钟管游标完整性，时钟漂移不丢数据）
 *
 * 推送触发：① 数据变更防抖 30s ② 每 5 分钟兜底 ③ 页面隐藏/卸载 keepalive ④ 手动 syncNow
 * 拉取触发：① push 成功后（含被拒即拉）② 兜底定时（SSE 健在时降频，见 SSE_FALLBACK_TICKS）
 *           ③ SSE 变更信号（对端 push 秒级唤醒，丢了由兜底轮询补齐）
 */
import { ref, watch, type WatchStopHandle } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  useSettingsStore,
  useTaskStore,
  useThemeStore,
  useUIStore,
  useUsageStore,
  type ExportBundle,
  type Task,
  type UsageRecord
} from '../stores'
import type { Schedule } from '../types/bundle'
import { sanitizeSchedules, sanitizeTasks } from '../types/bundle'
import { api, ApiError, apiBase } from './apiClient'

const LS_LAST_SYNC = 'shiguang_last_synced_at'
const LS_CURSOR = 'shiguang_sync_cursor'
const PUSH_DEBOUNCE_MS = 30_000
const PUSH_INTERVAL_MS = 5 * 60_000
/** SSE 健在时兜底轮询的降频系数：实发间隔 = PUSH_INTERVAL_MS × 该值（5min × 6 = 30min）。
 *  信令正常时轮询只是保险，不必勤快；信号丢失的最坏补齐窗口 = 该间隔，
 *  且期间任何一次成功 push 都会顺带 pull，实际数据时滞远小于此。 */
const SSE_FALLBACK_TICKS = 6
/** fetch keepalive 的 body 上限是 64KB，逼近即放弃（等定时兜底），避免请求被浏览器拒绝 */
const KEEPALIVE_MAX_BYTES = 60_000

export type SyncState = 'off' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
export const syncState = ref<SyncState>('off')
export const lastSyncAt = ref<string | null>(localStorage.getItem(LS_LAST_SYNC))

let stopWatch: WatchStopHandle | null = null
let intervalTimer: number | null = null
let debounceTimer: number | null = null
let syncing = false
let pulling = false
/** 兜底降频计数：SSE 健在时每 tick +1 取模跳发；断开即清零回全速兜底 */
let fallbackTicks = 0

// ===== 记录模型 =====

interface SyncRecord {
  c: string
  id: string
  data: unknown
  rev: number
}

/** 同步基线：key=`${c}:${id}` → 序列化 json + rev。内存态（刷新即空 → 首轮全量推，服务端幂等裁决） */
const lastSyncedMap = new Map<string, { json: string; rev: number }>()
const recKey = (c: string, id: string) => `${c}:${id}`
const ser = (v: unknown) => JSON.stringify(v ?? null)

/** 全量收集本机记录（含墓碑——删除需要跨端传播）。settings 排除 apiKey（永不上云，仅存在于本机与导出文件）。 */
function collectAll(): Map<string, { rec: SyncRecord; json: string }> {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const usageStore = useUsageStore()
  const uiStore = useUIStore()
  const now = Date.now()
  const out = new Map<string, { rec: SyncRecord; json: string }>()

  const put = (c: string, id: string, data: unknown, rev: number) => {
    const json = ser(data)
    out.set(recKey(c, id), { rec: { c, id, data, rev }, json })
  }

  for (const t of taskStore.tasks) put('tasks', t.id, t, t.revTime || now)
  for (const s of taskStore.schedules) put('schedules', s.id, s, s.revTime || now)
  for (const [k, v] of Object.entries(settingsStore.settings)) {
    if (k === 'apiKey') continue
    put('settings', k, v, now)
  }
  put('meta', 'theme', themeStore.isDark, now)
  put('meta', 'todoVisible', uiStore.todoVisible, now)
  for (const u of usageStore.usageHistory) put('usage', u.id, u, u.id ? now : now)

  return out
}

/** diff 出需要上行的变更（含 usage 消失检测：基线有而当前无 → 墓碑） */
function diffChanges(all: Map<string, { rec: SyncRecord; json: string }>): SyncRecord[] {
  const changes: SyncRecord[] = []
  for (const [key, { rec, json }] of all) {
    const prev = lastSyncedMap.get(key)
    if (!prev || prev.json !== json) changes.push(rec)
  }
  // usage 清空场景：基线中的 usage 记录已不在本机 → 推删除墓碑
  for (const key of [...lastSyncedMap.keys()]) {
    if (key.startsWith('usage:') && !all.has(key)) {
      changes.push({ c: 'usage', id: key.slice(6), data: { deleted: true }, rev: Date.now() })
      lastSyncedMap.delete(key) // 推送成功后会重设；此处先删避免重复 diff
    }
  }
  return changes
}

// ===== 导入 =====

/**
 * 导入式覆盖：整包写入并统一打 revTime=now（文件导入是"本机所见即真相"语义）。
 * - apiKey 随备份导入（新导出的备份文件已含密钥）；旧备份无 key 时回退本机现值
 * - 差集墓碑：本地有（活跃）而导入包没有的 tasks/schedules 打墓碑（revTime=now）
 *   并保留在数组中——墓碑随全量推送覆盖云端同名记录，否则重新登录全量拉取时
 *   云端旧记录会"复活"混入，破坏覆盖语义
 * - usage 是追加型流水，不做差集墓碑：云端多出的记录拉取时按 id 合并回来（无裁决危害）
 * - 同步基线作废 → 下轮全量 diff 上行（含墓碑），服务端幂等裁决
 */
export function importBundle(bundle: ExportBundle): void {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const usageStore = useUsageStore()
  const uiStore = useUIStore()
  const now = Date.now()

  const inBundleTasks = new Set<string>()
  const inBundleSchedules = new Set<string>()
  const tasks = sanitizeTasks(bundle.tasks).map(t => {
    inBundleTasks.add(t.id)
    return { ...t, revTime: now, deletedAt: undefined }
  })
  const schedules = sanitizeSchedules(bundle.schedules).map(s => {
    inBundleSchedules.add(s.id)
    return { ...s, revTime: now, deletedAt: undefined }
  })
  // 差集墓碑（已墓碑的不重打——刷新 revTime 会制造无谓的上行变更）
  for (const t of taskStore.tasks) {
    if (!inBundleTasks.has(t.id) && !t.deletedAt) { t.deletedAt = now; t.revTime = now }
  }
  for (const s of taskStore.schedules) {
    if (!inBundleSchedules.has(s.id) && !s.deletedAt) { s.deletedAt = now; s.revTime = now }
  }
  // 墓碑记录随活跃记录一起写入（同步层全集）。
  // 包内已含的 id 不保留旧墓碑对象：否则同 id 重复入列，collectAll 的 Map 后写覆盖先写，
  // 旧墓碑会反向覆盖刚复活的记录并作为墓碑推上云端——"导入复活已删任务"静默失效。
  taskStore.tasks = [...tasks, ...taskStore.tasks.filter(t => t.deletedAt && !inBundleTasks.has(t.id))]
  taskStore.schedules = [...schedules, ...taskStore.schedules.filter(s => s.deletedAt && !inBundleSchedules.has(s.id))]
  settingsStore.settings = { ...bundle.settings, apiKey: bundle.settings.apiKey || settingsStore.settings.apiKey }
  themeStore.isDark = bundle.theme.isDark
  usageStore.usageHistory = bundle.usage
  uiStore.setTodoVisible(bundle.todoVisible)

  lastSyncedMap.clear() // 基线作废 → 下轮全量 diff（导入内容 revTime 已重打为最新，作为新修订上行）
}

// ===== 推送 =====

async function push(keepalive = false): Promise<boolean> {
  if (!useAuthStore().isLoggedIn || syncing) return false
  const all = collectAll()
  const changes = diffChanges(all)
  if (changes.length === 0) return true
  const body = JSON.stringify({ changes })
  if (keepalive && body.length > KEEPALIVE_MAX_BYTES) return false // 太大不让 keepalive 扛

  syncing = true
  syncState.value = 'syncing'
  try {
    const r = await api<{ rejected: string[]; serverNow: number }>('/sync/push', {
      method: 'POST',
      body: { changes },
      keepalive,
      tag: SYNC_TAG
    })
    const rejected = new Set(r.rejected || [])
    // 基线更新：被拒条目不更新基线（本机旧版会在 pull 中被对端新记录修正）
    for (const [key, { rec, json }] of all) {
      if (!rejected.has(recKey(rec.c, rec.id))) lastSyncedMap.set(key, { json, rev: rec.rev })
    }
    lastSyncAt.value = new Date(r.serverNow).toISOString()
    localStorage.setItem(LS_LAST_SYNC, lastSyncAt.value)
    syncState.value = 'synced'
    if (rejected.size > 0) void pull() // 对端有更新 → 立即拉取修正
    return true
  } catch (e) {
    // status 0 = 网络不可达（断网/停机）：静默待兜底；其余为服务端错误
    syncState.value = e instanceof ApiError && e.status === 0 ? 'offline' : 'error'
    return false
  } finally {
    syncing = false
  }
}

const scheduleDebouncedPush = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    void push()
  }, PUSH_DEBOUNCE_MS)
}

// ===== 拉取与合并 =====

interface PullRecord {
  c: string
  id: string
  data: unknown
  rev: number
}

/**
 * 应用拉取的记录。force=false 常规合并：
 * - tasks/schedules：revTime 裁决（store 的 upsertSynced* 通道）
 * - settings/meta：本机有未推送变更（在脏集）则跳过，等本机上行
 * - usage：按 id upsert / {deleted:true} 移除
 * force=true（云端恢复）：整体替换，无视裁决。
 */
// ===== 拉取合并：按集合注册的应用器（applyRecords 只做编排与基线回写）=====
// 应用器统一签名 (r, ctx) => boolean，返回"是否对齐基线"：
// - settings 本机脏：跳过赋值但仍对齐——下轮 diff 会发现本机值≠基线而推上去
// - meta 本机脏：整条跳过（含基线）——等本机上行后自然对齐
// 两种脏处理策略与拆分前行为逐一等价，勿"顺手统一"；
// 新增同步集合 = 在 recordHandlers 注册一行，applyRecords 本体不再改动

type TaskStore = ReturnType<typeof useTaskStore>
type SettingsStore = ReturnType<typeof useSettingsStore>
type ThemeStore = ReturnType<typeof useThemeStore>
type UsageStore = ReturnType<typeof useUsageStore>
type UIStore = ReturnType<typeof useUIStore>

/** 应用器统一上下文：stores 整轮取好一次；dirty/key/force 按记录派生；forceSink 为 force 时的落地累积区 */
interface ApplyCtx {
  stores: { task: TaskStore; settings: SettingsStore; theme: ThemeStore; usage: UsageStore; ui: UIStore }
  dirty: Set<string>
  key: string
  force: boolean
  forceSink: { tasks: Task[]; schedules: Schedule[] } | null
}

type RecordHandler = (r: PullRecord, ctx: ApplyCtx) => boolean

/** tasks：force 时攒入落地区（整轮后整体替换），否则走增量合并通道 */
const applyTaskRecord: RecordHandler = (r, { stores, forceSink }) => {
  const t = r.data as Task
  if (forceSink) forceSink.tasks.push(t)
  else stores.task.upsertSyncedTask(t)
  return true
}

const applyScheduleRecord: RecordHandler = (r, { stores, forceSink }) => {
  const s = r.data as Schedule
  if (forceSink) forceSink.schedules.push(s)
  else stores.task.upsertSyncedSchedule(s)
  return true
}

const applySettingsRecord: RecordHandler = (r, { stores, dirty, key, force }) => {
  if (!dirty.has(key) || force) (stores.settings.settings as Record<string, unknown>)[r.id] = r.data
  return true
}

const applyMetaRecord: RecordHandler = (r, { stores, dirty, key, force }) => {
  if (dirty.has(key) && !force) return false
  if (r.id === 'theme') stores.theme.isDark = r.data === true
  else if (r.id === 'todoVisible') stores.ui.setTodoVisible(r.data === true)
  return true
}

/** usage 追加型流水：墓碑按 id 移除，普通记录 upsert（已存在则忽略——对端旧版不回退本地） */
const applyUsageRecord: RecordHandler = (r, { stores }) => {
  const d = r.data as { deleted?: boolean }
  if (d?.deleted) stores.usage.usageHistory = stores.usage.usageHistory.filter(u => u.id !== r.id)
  else {
    const u = r.data as UsageRecord
    if (!stores.usage.usageHistory.some(x => x.id === r.id)) stores.usage.usageHistory = [u, ...stores.usage.usageHistory]
  }
  return true
}

/** 集合名 → 应用器注册表。未知集合 no-op 对齐基线（等价拆分前 else-if 链落空分支） */
const noopHandler: RecordHandler = () => true
const recordHandlers: Record<string, RecordHandler> = {
  tasks: applyTaskRecord,
  schedules: applyScheduleRecord,
  settings: applySettingsRecord,
  meta: applyMetaRecord,
  usage: applyUsageRecord
}

function applyRecords(records: PullRecord[], force: boolean): void {
  const stores = {
    task: useTaskStore(),
    settings: useSettingsStore(),
    theme: useThemeStore(),
    usage: useUsageStore(),
    ui: useUIStore()
  }
  const base = {
    stores,
    dirty: force ? new Set<string>() : new Set(diffChanges(collectAll()).map(r => recKey(r.c, r.id))),
    force,
    forceSink: force ? { tasks: [] as Task[], schedules: [] as Schedule[] } : null
  }

  for (const r of records) {
    const key = recKey(r.c, r.id)
    const handler = recordHandlers[r.c] ?? noopHandler
    // 基线对齐：已应用的记录进入基线（避免下轮 diff 误判为本机变更；meta 脏跳过除外）
    if (handler(r, { ...base, key })) lastSyncedMap.set(key, { json: ser(r.data), rev: r.rev })
  }

  if (force) {
    stores.task.tasks = base.forceSink!.tasks
    stores.task.schedules = base.forceSink!.schedules
  }
}

async function pull(force = false): Promise<void> {
  if (pulling && !force) return // SSE 信号突发防重入（force 的云端恢复不排队，整轮幂等）
  pulling = true
  try {
    const PAGE = 500
    let since = force ? 0 : Number(localStorage.getItem(LS_CURSOR) || 0)
    let sinceId = '' // 复合游标的组内偏移（recv_time 平局组内按 record_id 推进）
    // 分页循环，整轮拉完才一次性应用：force 的整体替换必须看到全集；
    // 中途失败（离线/限流 429）整轮作废，下轮从旧游标重拉（幂等无损耗）
    let allRecords: PullRecord[] = []
    for (;;) {
      const r = await api<{ records: PullRecord[]; hasMore: boolean; nextSince: number; nextSinceId: string; serverNow: number }>(
        `/sync/pull?since=${since}&sinceId=${encodeURIComponent(sinceId)}&limit=${PAGE}`
      )
      allRecords = allRecords.concat(r.records)
      if (!r.hasMore) {
        applyRecords(allRecords, force)
        localStorage.setItem(LS_CURSOR, String(r.serverNow))
        break
      }
      since = r.nextSince
      sinceId = r.nextSinceId
    }
    if (syncState.value !== 'error') syncState.value = 'synced'
  } catch {
    // 拉取失败（离线）不阻塞本地使用
  } finally {
    pulling = false
  }
}

// ===== SSE 实时同步信号：对端 push → 服务端广播 → 立即 pull =====
// 与 30s 防抖/5min 兜底互补：轮询保底不丢，SSE 把多设备触达从分钟级提到秒级。
// 信号不携带数据，拉取仍走增量游标——与轮询共用同一合并路径，语义零分叉。

/** 设备自报标识：SSE 连接 ?tag= 与推送头 x-sync-tag 同值，服务端据此不给自己发信号 */
const SYNC_TAG = Math.random().toString(36).slice(2)
let es: EventSource | null = null
let esRetryTimer: number | null = null
let esBackoffMs = 1_000
let ssePullTimer: number | null = null

/** 信号合流：500ms 窗口内的突发广播只拉一次 */
const scheduleSSEPull = () => {
  if (ssePullTimer) return
  ssePullTimer = window.setTimeout(() => {
    ssePullTimer = null
    void pull()
  }, 500)
}

function closeES(): void {
  es?.close()
  es = null
}

function queueReconnect(): void {
  closeES()
  if (esRetryTimer) return
  esRetryTimer = window.setTimeout(() => {
    esRetryTimer = null
    connectSSE()
  }, esBackoffMs)
  esBackoffMs = Math.min(esBackoffMs * 2, 60_000)
}

function connectSSE(): void {
  if (es || esRetryTimer) return // 已连接 / 重连已在排队
  if (typeof EventSource === 'undefined') return // 环境兜底（三端均支持，理论不可达）
  void api<{ ticket: string }>('/sync/sse-ticket', { method: 'POST' })
    .then(({ ticket }) => {
      if (es || esRetryTimer) return // 领票期间 stopSync 过
      es = new EventSource(`${apiBase()}/api/sync/events?ticket=${ticket}&tag=${SYNC_TAG}`)
      es.onopen = () => { esBackoffMs = 1_000 }
      es.onmessage = (ev: MessageEvent) => {
        try {
          if ((JSON.parse(ev.data) as { type?: string }).type === 'changed') scheduleSSEPull()
        } catch { /* 坏帧忽略 */ }
      }
      es.onerror = () => {
        // 连接票一次性：EventSource 自带的重连必然 401，必须关闭后自管退避重连（重新领票）
        queueReconnect()
      }
    })
    .catch((e) => {
      // 旧版服务端无此接口（404）：实时通道不可用，停止重试（防无限循环；轮询兜底照常）
      if (e instanceof ApiError && e.status === 404) return
      queueReconnect() // 领票失败（离线/登录态失效）：退避重试；401 由 auth 层统一登出
    })
}

function stopSSE(): void {
  closeES()
  if (esRetryTimer) { clearTimeout(esRetryTimer); esRetryTimer = null }
  if (ssePullTimer) { clearTimeout(ssePullTimer); ssePullTimer = null }
  esBackoffMs = 1_000
}

// ===== 生命周期（App 挂载/登录态变化时调用） =====

const onVisibility = () => {
  // 移动端切后台的关键出口：visibilitychange → hidden 立即推一次
  if (document.visibilityState === 'hidden') void push(true)
}
const onPageHide = () => void push(true)

export function startSync(): void {
  if (!useAuthStore().isLoggedIn || stopWatch) return // 未登录 / 已启动则跳过
  syncState.value = 'idle'
  // 基线为空（内存态）→ 先全量推送（幂等，服务端逐条裁决，顺带补上上次会话漏推的变更）
  void push().then(() => pull())

  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const usageStore = useUsageStore()
  const uiStore = useUIStore()
  stopWatch = watch(
    () => [
      taskStore.tasks,
      taskStore.schedules,
      settingsStore.settings,
      usageStore.usageHistory,
      themeStore.isDark,
      uiStore.todoVisible
    ],
    scheduleDebouncedPush,
    { deep: true }
  )
  intervalTimer = window.setInterval(() => {
    // 兜底降频：SSE 健在（连接对象存在即健在；真断了 onerror 会置空）→ 跳过 6 个 tick 里的 5 个；
    // 断开 → 立即回 5min 全速兜底。定时器本身不重排，避免连接状态抖动引发的重排竞态。
    if (es) {
      fallbackTicks = (fallbackTicks + 1) % SSE_FALLBACK_TICKS
      if (fallbackTicks !== 0) return
    } else {
      fallbackTicks = 0
    }
    void push().then(ok => { if (ok) void pull() })
  }, PUSH_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('pagehide', onPageHide)
  connectSSE()
}

export function stopSync(): void {
  stopWatch?.()
  stopWatch = null
  if (intervalTimer) clearInterval(intervalTimer)
  intervalTimer = null
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('pagehide', onPageHide)
  stopSSE()
  fallbackTicks = 0
  syncState.value = 'off'
  lastSyncedMap.clear()
  localStorage.removeItem(LS_CURSOR)
  // 账号产物一并清除（含 401 被动登出路径）：游标/最近同步时间属于上一账号
  localStorage.removeItem(LS_LAST_SYNC)
  lastSyncAt.value = null
}

// ===== 手动操作（数据管理页/同步指示器入口） =====

/** 立即推送 + 拉取（返回是否成功） */
export function syncNow(): Promise<boolean> {
  return push().then(ok => { if (ok) void pull(); return ok })
}

/** 强制从云端恢复：拉全量整体覆盖本机（不可逆，本机未同步改动会丢失——动刀前应先导出备份） */
export async function restoreFromCloud(): Promise<boolean> {
  if (!useAuthStore().isLoggedIn) return false
  await pull(true)
  return syncState.value === 'synced'
}
