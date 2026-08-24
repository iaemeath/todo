/**
 * token 的裸存取：独立于 auth store，供 apiClient（非响应式上下文）读取。
 * 放在独立文件还有一个用途：登录/登出时 SyncManager 需要 token 判断通道，
 * 避免与 pinia store 的循环依赖。
 */
const TOKEN_KEY = 'shiguang_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
