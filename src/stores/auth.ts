/**
 * 登录态：token/user 持久化 localStorage，启动 bootstrap() 用 /auth/me 恢复会话。
 * 特性开关（features）由服务端下发，当前生效的是 sync 与 admin。
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api, onUnauthorized } from '../services/apiClient'
import { getToken, setToken } from '../services/tokenStore'
import { clearAllStores } from './index'

export interface AuthUser {
  id: string
  email: string | null
  username: string | null
}

interface AuthFeatures {
  sync: boolean
  /** 管理员白名单（服务端 ADMIN_USERS）：仅控侧栏"用户管理"入口显隐，权限边界在 /api/admin */
  admin: boolean
}

const USER_KEY = 'shiguang_user'
/** 上次登录账号标记：账号隔离的依据（本地数据无账号归属） */
const LAST_USER_KEY = 'shiguang_last_user'

export const useAuthStore = defineStore('auth', () => {
  // ===== State =====
  const token = ref<string | null>(getToken())
  const user = ref<AuthUser | null>(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))
  /** 启动会话恢复完成标记：App 据此决定何时启动云同步 */
  const ready = ref(false)
  const features = ref<AuthFeatures>({ sync: false, admin: false })

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
    features.value = { sync: false, admin: false }
    persist()
  }

  // 任何接口 401 → 统一清登录态（token 过期唯一出口；setup 只执行一次不会重复注册）
  onUnauthorized(clear)

  /**
   * 账号切换检测：本地数据无账号归属，切换账号必须先清空业务数据，
   * 否则 A 的数据会在下次全量推送时被推给 B。
   * - 游客→首次登录：不清（游客数据归属首个登录者是既有语义）
   * - 同账号重登（含 401 过期后重登）：不清（保留未同步数据，登录后补推）
   */
  const onAccountSwitch = (userId: string) => {
    const prev = localStorage.getItem(LAST_USER_KEY)
    localStorage.setItem(LAST_USER_KEY, userId)
    if (prev && prev !== userId) clearAllStores()
  }

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

  async function login(email: string, password: string): Promise<void> {
    const r = await api<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    onAccountSwitch(r.user.id)
    token.value = r.token
    user.value = r.user
    persist()
    void bootstrap() // 已登录态下再拉一次 features
  }

  async function register(
    email: string,
    password: string,
    inviteCode?: string,
    code?: string
  ): Promise<void> {
    const r = await api<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: { email, password, inviteCode, code }
    })
    onAccountSwitch(r.user.id)
    token.value = r.token
    user.value = r.user
    persist()
    void bootstrap()
  }

  /**
   * 退出即清本机业务数据（隐私默认：公用电脑不留痕；云端数据不受影响，
   * 重新登录会从云端全量恢复）。无状态 JWT，本地凭据随清。
   */
  function logout() {
    clearAllStores()
    localStorage.removeItem(LAST_USER_KEY)
    clear()
  }

  return { token, user, ready, features, isLoggedIn, bootstrap, login, register, logout }
})
