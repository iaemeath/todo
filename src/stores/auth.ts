/**
 * 登录态：token/user 持久化 localStorage，启动 bootstrap() 用 /auth/me 恢复会话。
 * 特性开关（features）由服务端下发，当前唯一生效的是 sync（云同步）；
 * voice 字段为预留，暂无消费方。
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api, onUnauthorized } from '../services/apiClient'
import { getToken, setToken } from '../services/tokenStore'

export interface AuthUser {
  id: string
  username: string
  nickname: string | null
}

interface AuthFeatures {
  voice: boolean
  sync: boolean
  /** 管理员白名单（服务端 ADMIN_USERS）：仅控侧栏"用户管理"入口显隐，权限边界在 /api/admin */
  admin: boolean
}

const USER_KEY = 'shiguang_user'

export const useAuthStore = defineStore('auth', () => {
  // ===== State =====
  const token = ref<string | null>(getToken())
  const user = ref<AuthUser | null>(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))
  /** 启动会话恢复完成标记：App 据此决定何时启动云同步 */
  const ready = ref(false)
  const features = ref<AuthFeatures>({ voice: false, sync: false, admin: false })

  // ===== Getter =====
  const isLoggedIn = computed(() => !!token.value && !!user.value)

  // ===== 内部 =====
  const persist = () => {
    setToken(token.value)
    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    else localStorage.removeItem(USER_KEY)
  }

  const clear = () => {
    token.value = null
    user.value = null
    features.value = { voice: false, sync: false, admin: false }
    persist()
  }

  // 任何接口 401 → 统一清登录态（token 过期唯一出口；setup 只执行一次不会重复注册）
  onUnauthorized(clear)

  // ===== Actions =====

  /** 启动会话恢复：有 token 则校验并刷新 user/features；网络失败保留本地态下次再试 */
  async function bootstrap(): Promise<void> {
    if (token.value) {
      try {
        const r = await api<{ user: AuthUser; features: AuthFeatures }>('/auth/me')
        user.value = r.user
        features.value = r.features
        persist()
      } catch {
        // 401 已由 onUnauthorized 清态；其他错误静默（离线仍可本地使用）
      }
    }
    ready.value = true
  }

  async function login(username: string, password: string): Promise<void> {
    const r = await api<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { username, password }
    })
    token.value = r.token
    user.value = r.user
    persist()
    void bootstrap() // 已登录态下再拉一次 features
  }

  async function register(
    username: string,
    password: string,
    nickname?: string,
    inviteCode?: string
  ): Promise<void> {
    const r = await api<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: { username, password, nickname, inviteCode }
    })
    token.value = r.token
    user.value = r.user
    persist()
    void bootstrap()
  }

  /** JWT 无状态，退出即清本地凭据 */
  function logout() {
    clear()
  }

  return { token, user, ready, features, isLoggedIn, bootstrap, login, register, logout }
})
