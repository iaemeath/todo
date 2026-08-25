/**
 * API 客户端：fetch 封装（同源 /api 前缀，开发时由 vite proxy 转发）。
 * - 自动附加 Bearer token（auth store 持久化在 localStorage）
 * - 非 2xx 抛 ApiError（带 status/message），401 通过注册的回调通知登出
 * - keepalive 支持：页面隐藏/卸载时的同步请求用 fetch keepalive 继续送达
 */
import { getToken } from './tokenStore'

/**
 * API 基址：
 * - Web（http/https 部署）：同源相对路径 /api（nginx 反代）
 * - Electron（file:// 协议）与 Capacitor 原生壳（https://localhost）：相对路径不可用，
 *   指向远程服务器；默认公网域名，可在数据管理页改（localStorage['shiguang_server_url']，支持 https）
 */
const SHELL_DEFAULT_URL = 'http://weekly.rl.ylh.pub'
export const isDesktopShell = typeof window !== 'undefined' && window.location.protocol === 'file:'
export const isNativeShell = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
/** 任意原生壳（Electron / Capacitor）：API 必须指向远程服务器而非同源相对路径 */
export const isShellApp = isDesktopShell || isNativeShell
/** Electron 桥在否（preload 注入即真）——桌面能力判断用这个而非 isDesktopShell：
 *  dev 联调（ELECTRON_START_URL=http://localhost）下 protocol 是 http，但桥照样注入 */
export const hasDesktopBridge = typeof window !== 'undefined' && !!window.shiguang

/** 原生壳（Electron / Capacitor）当前指向的服务器地址（Web 同源部署用不到） */
export function getServerUrl(): string {
  const u = (localStorage.getItem('shiguang_server_url') || SHELL_DEFAULT_URL)
    .trim().replace(/\/+$/, '')
  return u || SHELL_DEFAULT_URL
}

/** 切换服务器地址：立即生效（每次请求现取）。空串=恢复默认。token 不跨服务器迁移，换服务器需重新登录 */
export function setServerUrl(url: string): void {
  const u = url.trim().replace(/\/+$/, '')
  if (u) localStorage.setItem('shiguang_server_url', u)
  else localStorage.removeItem('shiguang_server_url')
}

const apiBase = () => (isShellApp ? getServerUrl() : '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface ApiEnvelope<T> {
  ok: boolean
  message?: string
  data: T
}

type UnauthorisedHandler = () => void
let unauthorizedHandler: UnauthorisedHandler | null = null

/** auth store 启动时注册：任何接口 401 → 清登录态（token 过期统一出口） */
export function onUnauthorized(cb: UnauthorisedHandler) {
  unauthorizedHandler = cb
}

export interface ApiOptions {
  method?: string
  body?: unknown
  keepalive?: boolean
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${apiBase()}/api${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      keepalive: opts.keepalive
    })
  } catch {
    // 网络不可达（服务器停机/断网）：syncManager 据此转 offline 态
    throw new ApiError(0, '网络不可达，请检查网络或服务状态')
  }

  if (res.status === 401) {
    unauthorizedHandler?.()
    throw new ApiError(401, '未登录或登录已过期')
  }

  if (res.status === 204) return undefined as T

  let json: ApiEnvelope<T> | null = null
  try {
    json = await res.json() as ApiEnvelope<T>
  } catch {
    // 非 JSON 响应（如网关错误页）
  }

  if (!res.ok || !json?.ok) {
    throw new ApiError(res.status, json?.message || `请求失败（${res.status}）`)
  }
  return json.data
}
