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
 * - Electron（file:// 协议）：相对路径不可用，指向远程服务器；
 *   默认公网域名，可用 localStorage['shiguang_server_url'] 覆盖（换自建服务器时改）
 */
const API_BASE = (() => {
  if (typeof window === 'undefined' || window.location.protocol !== 'file:') return ''
  return localStorage.getItem('shiguang_server_url') || 'http://shiguang.rl.ylh.pub'
})()

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
    res = await fetch(`${API_BASE}/api${path}`, {
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
