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
 */
import { ref, watch, type WatchStopHandle } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  exportAllData,
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
import { api, ApiError } from './apiClient'

const LS_LAST_SYNC = 'shiguang_last_synced_at'
const LS_CURSOR = 'shiguang_sync_cursor'
const LS_BACKUPS = 'shiguang_local_backups'
const BACKUP_KEEP = 3
const PUSH_DEBOUNCE_MS = 30_000
const PUSH_INTERVAL_MS = 5 * 60_000
/** fetch keepalive 的 body 上限是 64KB，逼近即放弃（等定时兜底），避免请求被浏览器拒绝 */
const KEEPALIVE_MAX_BYTES = 60_000

export type SyncState = 'off' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
export const syncState = ref<SyncState>('off')
export const lastSyncAt = ref<string | null>(localStorage.getItem(LS_LAST_SYNC))

let stopWatch: WatchStopHandle | null = null
let intervalTimer: number | null = null
let debounceTimer: number | null = null
let syncing = false

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

/** 全量收集本机记录（含墓碑——删除需要跨端传播）。settings 排除 apiKey（永不出本机）。 */
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

// ===== 本地备份（防覆盖手滑） =====

function saveLocalBackup(): void {
  try {
    const list: ExportBundle[] = JSON.parse(localStorage.getItem(LS_BACKUPS) || '[]')
    list.unshift(exportAllData())
    localStorage.setItem(LS_BACKUPS, JSON.stringify(list.slice(0, BACKUP_KEEP)))
  } catch {
    // 备份失败不阻塞同步主流程
  }
}

export function getLocalBackups(): ExportBundle[] {
  try {
    return JSON.parse(localStorage.getItem(LS_BACKUPS) || '[]')
  } catch {
    return []
  }
}

/**
 * 导入式覆盖：整包写入并统一打 revTime=now（文件导入/本地备份回滚都是"本机所见即真相"语义）。
 * - 本机 apiKey 永不导入（导出文件已剔除）：保留本机现值，避免登录态丢密钥
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
  const localApiKey = settingsStore.settings.apiKey
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
  // 墓碑记录随活跃记录一起写入（同步层全集）
  taskStore.tasks = [...tasks, ...taskStore.tasks.filter(t => t.deletedAt)]
  taskStore.schedules = [...schedules, ...taskStore.schedules.filter(s => s.deletedAt)]
  settingsStore.settings = { ...bundle.settings, apiKey: localApiKey }
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
      keepalive
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
function applyRecords(records: PullRecord[], force: boolean): void {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const usageStore = useUsageStore()
  const uiStore = useUIStore()

  const dirty = force ? new Set<string>() : new Set(diffChanges(collectAll()).map(r => recKey(r.c, r.id)))
  const forceTasks: Task[] = []
  const forceSchedules: Schedule[] = []

  for (const r of records) {
    const key = recKey(r.c, r.id)
    if (r.c === 'tasks') {
      const t = r.data as Task
      if (force) forceTasks.push(t)
      else taskStore.upsertSyncedTask(t)
    } else if (r.c === 'schedules') {
      const s = r.data as Schedule
      if (force) forceSchedules.push(s)
      else taskStore.upsertSyncedSchedule(s)
    } else if (r.c === 'settings') {
      if (!dirty.has(key) || force) (settingsStore.settings as Record<string, unknown>)[r.id] = r.data
    } else if (r.c === 'meta') {
      if (dirty.has(key) && !force) continue
      if (r.id === 'theme') themeStore.isDark = r.data === true
      else if (r.id === 'todoVisible') uiStore.setTodoVisible(r.data === true)
    } else if (r.c === 'usage') {
      const d = r.data as { deleted?: boolean }
      if (d?.deleted) usageStore.usageHistory = usageStore.usageHistory.filter(u => u.id !== r.id)
      else {
        const u = r.data as UsageRecord
        if (!usageStore.usageHistory.some(x => x.id === r.id)) usageStore.usageHistory = [u, ...usageStore.usageHistory]
      }
    }
    // 基线对齐：已应用的记录进入基线（避免下轮 diff 误判为本机变更）
    lastSyncedMap.set(key, { json: ser(r.data), rev: r.rev })
  }

  if (force) {
    taskStore.tasks = forceTasks
    taskStore.schedules = forceSchedules
  }
}

async function pull(force = false): Promise<void> {
  const since = force ? 0 : Number(localStorage.getItem(LS_CURSOR) || 0)
  try {
    const r = await api<{ records: PullRecord[]; serverNow: number }>(`/sync/pull?since=${since}`)
    if (r.records.length > 0 || force) saveLocalBackup()
    applyRecords(r.records, force)
    localStorage.setItem(LS_CURSOR, String(r.serverNow))
    if (syncState.value !== 'error') syncState.value = 'synced'
  } catch {
    // 拉取失败（离线）不阻塞本地使用
  }
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
    void push().then(ok => { if (ok) void pull() })
  }, PUSH_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('pagehide', onPageHide)
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
  syncState.value = 'off'
  lastSyncedMap.clear()
  localStorage.removeItem(LS_CURSOR)
  // 账号产物一并清除（含 401 被动登出路径）：本地备份/最近同步时间属于上一账号，
  // 防止下一账号在数据管理页误恢复上一账号的备份
  localStorage.removeItem(LS_BACKUPS)
  localStorage.removeItem(LS_LAST_SYNC)
  lastSyncAt.value = null
}

// ===== 手动操作（数据管理页/同步指示器入口） =====

/** 立即推送 + 拉取（返回是否成功） */
export function syncNow(): Promise<boolean> {
  return push().then(ok => { if (ok) void pull(); return ok })
}

/** 强制从云端恢复：拉全量整体覆盖本机（覆盖前仍存档） */
export async function restoreFromCloud(): Promise<boolean> {
  if (!useAuthStore().isLoggedIn) return false
  await pull(true)
  return syncState.value === 'synced'
}
