/**
 * 云同步管理器（模块级单例）：登录后由 App 启动，本地优先——
 * localStorage 始终是运行时主存储，同步是旁路任务，失败只改状态不阻塞使用。
 *
 * 推送触发：① 数据变更防抖 30s ② 每 5 分钟兜底 ③ 页面隐藏/卸载 keepalive ④ 手动 syncNow
 * 拉取时机：启动登录后对比云端 updated_at（LWW：云端新才覆盖本地，覆盖前存档最近 3 份）
 */
import { ref, watch, type WatchStopHandle } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  exportAllData,
  importAllData,
  useSettingsStore,
  useTaskStore,
  useThemeStore,
  useUIStore,
  useUsageStore,
  type ExportBundle
} from '../stores'
import { api, ApiError } from './apiClient'

const LS_LAST_SYNC = 'shiguang_last_synced_at'
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
let lastPushedJson = ''

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

/** 回滚到某份本地备份（数据管理页入口） */
export function restoreLocalBackup(bundle: ExportBundle): void {
  const localApiKey = useSettingsStore().settings.apiKey
  importAllData({ ...bundle, settings: { ...bundle.settings, apiKey: localApiKey } })
  lastPushedJson = '' // 强制下次推送，让云端与回滚后的本地一致
}

// ===== 推送 =====

async function push(keepalive = false): Promise<boolean> {
  if (!useAuthStore().isLoggedIn || syncing) return false
  const bundle = exportAllData()
  const json = JSON.stringify(bundle)
  if (json === lastPushedJson) return true // 无变化
  if (keepalive && json.length > KEEPALIVE_MAX_BYTES) return false // 太大不让 keepalive 扛

  syncing = true
  syncState.value = 'syncing'
  try {
    const r = await api<{ updated_at: string }>('/snapshot', {
      method: 'PUT',
      body: { snapshot: bundle },
      keepalive
    })
    lastPushedJson = json
    lastSyncAt.value = r.updated_at
    localStorage.setItem(LS_LAST_SYNC, r.updated_at)
    syncState.value = 'synced'
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

// ===== 拉取（LWW） =====

async function pullIfRemoteNewer(): Promise<void> {
  try {
    // 204 无云端快照 → 本地即唯一真相，等首次推送
    const r = await api<{ snapshot: ExportBundle; updated_at: string } | undefined>('/snapshot')
    if (!r) return
    // ISO 字符串同格式下字典序即时间序；云端不比上次同步新就不动本地
    if (r.updated_at <= (lastSyncAt.value || '')) return

    saveLocalBackup()
    // 快照不含 apiKey（导出时剔除）：回填本机密钥，避免登录后丢配置
    const localApiKey = useSettingsStore().settings.apiKey
    importAllData({ ...r.snapshot, settings: { ...r.snapshot.settings, apiKey: localApiKey } })
    lastSyncAt.value = r.updated_at
    // 对齐基线：导入触发的 watch 防抖到期时内容未变会被判重跳过
    lastPushedJson = JSON.stringify(exportAllData())
    syncState.value = 'synced'
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
  lastPushedJson = JSON.stringify(exportAllData())
  void pullIfRemoteNewer()

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
  intervalTimer = window.setInterval(() => void push(), PUSH_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
}

export function stopSync(): void {
  stopWatch?.()
  stopWatch = null
  if (intervalTimer) clearInterval(intervalTimer)
  intervalTimer = null
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  syncState.value = 'off'
  lastPushedJson = ''
}

// ===== 手动操作（数据管理页/同步指示器入口） =====

/** 立即推送（返回是否成功） */
export function syncNow(): Promise<boolean> {
  return push()
}

/** 强制从云端恢复：无视 LWW 判定直接拉取覆盖（覆盖前仍存档） */
export async function restoreFromCloud(): Promise<boolean> {
  if (!useAuthStore().isLoggedIn) return false
  lastSyncAt.value = '' // 清空基线使 pull 必然生效
  await pullIfRemoteNewer()
  return syncState.value === 'synced'
}
