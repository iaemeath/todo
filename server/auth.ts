/**
 * 认证路由：注册 / 登录 / 会话恢复。
 * 密码 scrypt（salt:hash hex）；登录限流内存 Map（自用规模足够，重启清零可接受）。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from './db'
import { signJwt, verifyJwt, type JwtPayload } from './jwt'
import { isAdmin } from './roles'

export const router = Router()

/** 从请求头解出 JWT payload；无效返回 null */
export function getAuth(req: Request): JwtPayload | null {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  return token ? verifyJwt(token) : null
}

/** 登录守卫中间件：有效则把 payload 挂到 res.locals.user */
export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  const payload = getAuth(_req)
  if (!payload) return res.status(401).json({ ok: false, message: '未登录或登录已过期' })
  res.locals.user = payload
  next()
}

// ===== 密码 =====

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(password, salt, 64).toString('hex')
}
export { hashPassword }

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const calc = scryptSync(password, salt, 64)
  const orig = Buffer.from(hash, 'hex')
  return calc.length === orig.length && timingSafeEqual(calc, orig)
}

// ===== 登录限流：同用户名 5 次失败锁 10 分钟 =====

const MAX_FAILS = 5
const LOCK_MS = 10 * 60 * 1000
const loginFails = new Map<string, { count: number; lockedUntil: number }>()

function checkLock(username: string): number | null {
  const rec = loginFails.get(username)
  if (rec && rec.lockedUntil > Date.now()) return rec.lockedUntil
  return null
}

function recordFail(username: string) {
  const rec = loginFails.get(username) || { count: 0, lockedUntil: 0 }
  rec.count += 1
  if (rec.count >= MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOCK_MS
    rec.count = 0
  }
  loginFails.set(username, rec)
}

// ===== 注册邀请码：环境变量 INVITE_CODE 设置后注册必须携带（公网防扫描）；未设置则开放 =====

const INVITE_CODE = process.env.INVITE_CODE || ''

// ===== 路由 =====

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

/** POST /api/auth/register {username, password, nickname?, inviteCode?} */
router.post('/register', (req, res) => {
  const { username, password, nickname, inviteCode } = req.body || {}

  if (INVITE_CODE && inviteCode !== INVITE_CODE) {
    return res.status(403).json({ ok: false, message: '邀请码错误' })
  }
  if (!USERNAME_RE.test(String(username || ''))) {
    return res.status(400).json({ ok: false, message: '用户名需 3~20 位字母/数字/下划线' })
  }
  const pwd = String(password || '')
  if (pwd.length < 6 || pwd.length > 64) {
    return res.status(400).json({ ok: false, message: '密码长度需 6~64 位' })
  }

  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)
  if (exists) {
    return res.status(409).json({ ok: false, message: '用户名已存在' })
  }

  const id = 'u-' + randomBytes(8).toString('hex')
  db.prepare('INSERT INTO users (id, username, password, nickname) VALUES (?, ?, ?, ?)')
    .run(id, username, hashPassword(pwd), nickname ? String(nickname).slice(0, 30) : null)

  const user = { id, username, nickname: nickname || null }
  res.json({ ok: true, data: { token: signJwt(id, username), user } })
})

/** POST /api/auth/login {username, password} */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {}

  const lockedUntil = checkLock(String(username || ''))
  if (lockedUntil) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000)
    return res.status(429).json({ ok: false, message: `失败次数过多，请 ${mins} 分钟后再试` })
  }

  const row = db.prepare('SELECT id, username, password, nickname FROM users WHERE username = ?')
    .get(String(username || '')) as { id: string; username: string; password: string; nickname: string | null } | undefined

  // 统一错误文案，不区分「用户不存在/密码错误」，避免枚举用户名
  if (!row || !verifyPassword(String(password || ''), row.password)) {
    recordFail(String(username || ''))
    return res.status(401).json({ ok: false, message: '用户名或密码错误' })
  }

  loginFails.delete(row.username)
  const user = { id: row.id, username: row.username, nickname: row.nickname }
  res.json({ ok: true, data: { token: signJwt(row.id, row.username), user } })
})

/** GET /api/auth/me —— 刷新页面恢复会话 */
router.get('/me', requireAuth, (req, res) => {
  const payload = res.locals.user as JwtPayload
  const row = db.prepare('SELECT id, username, nickname FROM users WHERE id = ?')
    .get(payload.uid) as { id: string; username: string; nickname: string | null } | undefined
  if (!row) return res.status(401).json({ ok: false, message: '账号不存在' })
  res.json({
    ok: true,
    data: {
      user: { id: row.id, username: row.username, nickname: row.nickname },
      // 服务端可控特性开关（当前恒开；将来语音走后端代理时可远程关）。
      // admin 仅控前端管理入口显隐，真正的权限边界在 /api/admin 的 requireAdmin
      features: { voice: true, sync: true, admin: isAdmin(row.username) }
    }
  })
})
