/**
 * 认证路由：邮箱注册（验证码验真）/ 登录 / 忘记密码 / 改密 / 会话恢复。
 * 密码 scrypt（salt:hash hex）；登录限流内存 Map（邮箱+IP 双维度，自用规模足够，重启清零可接受）。
 * 人机验证=滑块拼图（获取邮箱验证码前必过，一次性 sliderToken）；邮箱验证码 6 位、单次、10 分钟。
 * 弱口令策略前后端共享（src/types/password.ts，类型下沉模式同 bundle.ts）。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from './db'
import { signJwt, verifyJwt, type JwtPayload } from './jwt'
import { isAdmin } from './roles'
import { createChallenge, verifySlider, consumeSliderToken, type TrackPoint } from './sliderCaptcha'
import { issueMailCode, verifyMailCode } from './mailCode'
import { validatePassword, EMAIL_RE } from '../src/types/password'

export const router = Router()

interface UserRow {
  id: string
  email: string | null
  username: string | null
  password: string
}

/** 从请求头解出 JWT payload；无效返回 null */
export function getAuth(req: Request): JwtPayload | null {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  return token ? verifyJwt(token) : null
}

/**
 * 登录守卫中间件：验 JWT 签名/有效期 + 用户仍存在 + 会话代次未过期（token_ver），
 * 有效则把 payload 挂到 res.locals.user。
 * 无状态 JWT 本身不可吊销——存在性查询与 ver 比对共同构成「token 到期前的吊销位」：
 * 删号即时失效；改密/重置 bump ver → 全部旧 token 即时失效（被盗号改密即踢线）。
 * 自用规模下每请求一次主键查询无性能压力。
 */
export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  const payload = getAuth(_req)
  if (!payload) return res.status(401).json({ ok: false, message: '未登录或登录已过期' })
  const row = db.prepare('SELECT token_ver FROM users WHERE id = ?').get(payload.uid) as { token_ver: number } | undefined
  // 旧 token 无 ver 字段按 0 计（部署 token_ver 后存量会话平滑过渡，不强制全体重登）
  if (!row) return res.status(401).json({ ok: false, message: '账号不存在或已注销' })
  if (Number(payload.ver || 0) !== row.token_ver) {
    return res.status(401).json({ ok: false, message: '登录态已失效（密码已变更），请重新登录' })
  }
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

// ===== 登录限流：双维度防爆破（内存 Map，自用规模足够，重启清零可接受）=====
// - 同邮箱 5 次失败锁 10 分钟：防定点爆破单个账号
// - 同 IP 20 次失败锁 10 分钟：防换邮箱撞库喷洒（password spraying），
//   阈值放宽以兼容家庭/办公室共享出口 IP 的正常多用户

const MAX_FAILS = 5
const IP_MAX_FAILS = 20
const LOCK_MS = 10 * 60 * 1000
const loginFails = new Map<string, { count: number; max: number; lockedUntil: number }>()

function checkLock(key: string): number | null {
  const rec = loginFails.get(key)
  if (rec && rec.lockedUntil > Date.now()) return rec.lockedUntil
  return null
}

function recordFail(key: string, max: number) {
  const rec = loginFails.get(key) || { count: 0, max, lockedUntil: 0 }
  rec.count += 1
  if (rec.count >= max) {
    rec.lockedUntil = Date.now() + LOCK_MS
    rec.count = 0
  }
  loginFails.set(key, rec)
  // 过期锁顺手清扫，防长跑膨胀（只清锁已过期的条目，保留累计中的失败计数）
  if (loginFails.size > 1000) {
    const now = Date.now()
    for (const [k, r] of loginFails) if (r.lockedUntil && r.lockedUntil < now) loginFails.delete(k)
  }
}

// ===== 注册邀请码：环境变量 INVITE_CODE 设置后注册必须携带（公网防扫描）；未设置则开放 =====

const INVITE_CODE = process.env.INVITE_CODE || ''

// ===== 公共校验 =====

const normEmail = (raw: unknown) => String(raw || '').trim().toLowerCase()

/** 图形码校验失败统一文案（不区分过期/答错，反正已销毁需重取） */
function badCaptcha(res: Response) {
  return res.status(400).json({ ok: false, message: '人机验证未通过或已失效，请重新拖动滑块' })
}

// ===== 路由 =====

/** GET /api/auth/slider/challenge —— 滑块拼图挑战（注册/忘记密码共用，IP 频控防 x 枚举） */
router.get('/slider/challenge', (req, res) => {
  const c = createChallenge(req.ip || 'unknown')
  if (!c) return res.status(429).json({ ok: false, message: '操作过于频繁，请稍后再试' })
  res.json({ ok: true, data: c })
})

/** POST /api/auth/slider/verify {id, x, track:[{t,x}]}
 *  位置容差 + 轨迹校验 → 通过签发一次性 sliderToken（业务接口消费） */
router.post('/slider/verify', (req, res) => {
  const { id, x, track } = req.body || {}
  const r = verifySlider(String(id || ''), Number(x), Array.isArray(track) ? (track as TrackPoint[]) : [])
  if (r.status === 'ok') return res.json({ ok: true, data: { token: r.token } })
  return badCaptcha(res)
})

/** POST /api/auth/register/code {email, password, sliderToken, inviteCode?}
 *  注册第一步：格式/邀请码/弱口令预检 → 滑块 token（消耗性，放可重试校验后、
 *  唯一性查询前——token 不被格式小错浪费，也不给未验证者探测注册占用）→ 发邮箱验证码 */
router.post('/register/code', async (req, res) => {
  const { sliderToken, inviteCode } = req.body || {}
  const email = normEmail(req.body?.email)
  const password = String(req.body?.password || '')

  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, message: '邮箱格式不正确' })
  if (INVITE_CODE && inviteCode !== INVITE_CODE) {
    return res.status(403).json({ ok: false, message: '邀请码错误' })
  }
  const pwdCheck = validatePassword(password, email)
  if (!pwdCheck.ok) return res.status(400).json({ ok: false, message: pwdCheck.reason })
  if (!consumeSliderToken(String(sliderToken || ''))) return badCaptcha(res)
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)
  if (exists) return res.status(409).json({ ok: false, message: '该邮箱已注册' })

  const reject = await issueMailCode('register', email)
  if (reject) return res.status(429).json({ ok: false, message: reject })
  res.json({ ok: true, data: null })
})

/** POST /api/auth/register {email, password, inviteCode?, code}
 *  注册第二步：邮箱验证码单次校验 → 建号 → 发 JWT */
router.post('/register', (req, res) => {
  const { inviteCode, code } = req.body || {}
  const email = normEmail(req.body?.email)
  const password = String(req.body?.password || '')

  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, message: '邮箱格式不正确' })
  if (INVITE_CODE && inviteCode !== INVITE_CODE) {
    return res.status(403).json({ ok: false, message: '邀请码错误' })
  }
  const pwdCheck = validatePassword(password, email)
  if (!pwdCheck.ok) return res.status(400).json({ ok: false, message: pwdCheck.reason })
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)
  if (exists) return res.status(409).json({ ok: false, message: '该邮箱已注册' })
  if (!verifyMailCode('register', email, String(code || ''))) {
    return res.status(400).json({ ok: false, message: '邮箱验证码错误或已过期' })
  }

  const id = 'u-' + randomBytes(8).toString('hex')
  // username 为展示名（邮箱前缀），登录标识是 email
  const username = email.split('@')[0].slice(0, 30)
  db.prepare('INSERT INTO users (id, email, username, password) VALUES (?, ?, ?, ?)')
    .run(id, email, username, hashPassword(password))

  const user = { id, email, username }
  res.json({ ok: true, data: { token: signJwt(id, email, 0), user } })
})

/** POST /api/auth/login {email, password} */
router.post('/login', (req, res) => {
  const email = normEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const ipKey = 'ip:' + (req.ip || 'unknown')

  // 双维度任一命中锁定即拒（req.ip 依赖 index.ts 的 trust proxy 还原真实地址）
  const lockedUntil = checkLock(email) || checkLock(ipKey)
  if (lockedUntil) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000)
    return res.status(429).json({ ok: false, message: `失败次数过多，请 ${mins} 分钟后再试` })
  }

  const row = db.prepare('SELECT id, email, username, password, token_ver FROM users WHERE email = ?')
    .get(email) as (UserRow & { token_ver: number }) | undefined

  // 统一错误文案，不区分「邮箱未注册/密码错误」，避免枚举用户
  if (!row || !verifyPassword(password, row.password)) {
    recordFail(email, MAX_FAILS)
    recordFail(ipKey, IP_MAX_FAILS)
    return res.status(401).json({ ok: false, message: '邮箱或密码错误' })
  }

  loginFails.delete(email)
  loginFails.delete(ipKey)
  const user = { id: row.id, email: row.email, username: row.username }
  res.json({ ok: true, data: { token: signJwt(row.id, row.email || email, row.token_ver), user } })
})

/** POST /api/auth/forgot {email, sliderToken}
 *  忘记密码第一步：滑块验人 → 发重置验证码。
 *  防枚举：邮箱不存在时同样返回成功文案（不发码） */
router.post('/forgot', async (req, res) => {
  const { sliderToken } = req.body || {}
  const email = normEmail(req.body?.email)

  if (!consumeSliderToken(String(sliderToken || ''))) return badCaptcha(res)

  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)
  if (exists) {
    const reject = await issueMailCode('reset', email)
    if (reject) return res.status(429).json({ ok: false, message: reject })
  }
  // 统一文案：不暴露邮箱是否注册
  res.json({ ok: true, message: '若该邮箱已注册，验证码已发送，请查收（含垃圾邮件箱）' })
})

/** POST /api/auth/reset {email, code, password} —— 忘记密码第二步 */
router.post('/reset', (req, res) => {
  const email = normEmail(req.body?.email)
  const { code } = req.body || {}
  const password = String(req.body?.password || '')

  // 弱口令先于验码校验：避免"码被销毁却因密码不合格失败"迫使重新收码（对齐 register 顺序）
  const pwdCheck = validatePassword(password, email)
  if (!pwdCheck.ok) return res.status(400).json({ ok: false, message: pwdCheck.reason })

  if (!verifyMailCode('reset', email, String(code || ''))) {
    return res.status(400).json({ ok: false, message: '验证码错误或已过期' })
  }

  // bump token_ver：重置后该账号全部旧 token 即时失效（被盗号场景的兜底踢线）
  const r = db.prepare('UPDATE users SET password = ?, token_ver = token_ver + 1 WHERE email = ?')
    .run(hashPassword(password), email)
  if (r.changes === 0) return res.status(400).json({ ok: false, message: '重置失败，请重新发起' })
  res.json({ ok: true, data: null })
})

/** PUT /api/auth/password {oldPassword, newPassword} —— 自助改密（需登录，先验原密码）
 *  bump token_ver：其他设备旧 token 即时失效；本设备重签新 token 无缝续期 */
router.put('/password', requireAuth, (req, res) => {
  const payload = res.locals.user as JwtPayload
  const oldPassword = String((req.body || {}).oldPassword || '')
  const newPassword = String((req.body || {}).newPassword || '')

  const row = db.prepare('SELECT password FROM users WHERE id = ?').get(payload.uid) as { password: string } | undefined
  if (!row) return res.status(401).json({ ok: false, message: '账号不存在' })
  if (!verifyPassword(oldPassword, row.password)) {
    return res.status(400).json({ ok: false, message: '原密码错误' })
  }
  const pwdCheck = validatePassword(newPassword, payload.email || '')
  if (!pwdCheck.ok) return res.status(400).json({ ok: false, message: pwdCheck.reason })

  db.prepare('UPDATE users SET password = ?, token_ver = token_ver + 1 WHERE id = ?')
    .run(hashPassword(newPassword), payload.uid)
  const { token_ver: ver } = db.prepare('SELECT token_ver FROM users WHERE id = ?')
    .get(payload.uid) as { token_ver: number }
  res.json({ ok: true, data: { token: signJwt(payload.uid, payload.email, ver) } })
})

/** GET /api/auth/me —— 刷新页面恢复会话 */
router.get('/me', requireAuth, (req, res) => {
  const payload = res.locals.user as JwtPayload
  const row = db.prepare('SELECT id, email, username FROM users WHERE id = ?')
    .get(payload.uid) as Omit<UserRow, 'password'> | undefined
  if (!row) return res.status(401).json({ ok: false, message: '账号不存在' })
  res.json({
    ok: true,
    data: {
      user: { id: row.id, email: row.email, username: row.username },
      // 服务端可控特性开关。admin 仅控前端管理入口显隐，真正的权限边界在 /api/admin 的 requireAdmin
      features: { sync: true, admin: isAdmin(row.email || '') }
    }
  })
})
