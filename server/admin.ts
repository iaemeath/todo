/**
 * 用户管理（管理员）：列表 / 重置密码 / 删除。
 * 权限=白名单角色（roles.ts），前端 features.admin 仅控入口显隐，安全边界在此。
 * 删除用户时快照由 FK ON DELETE CASCADE 级联清除；对方浏览器本地数据不受影响（本地优先架构）。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { db } from './db'
import { requireAuth, hashPassword } from './auth'
import { isAdmin } from './roles'
import { validatePassword } from '../src/types/password'
import type { JwtPayload } from './jwt'

export const router = Router()

/** 管理员守卫：requireAuth 之后校验白名单（401 优先于 403，不泄漏角色信息给未登录者） */
function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const payload = res.locals.user as JwtPayload
  if (!isAdmin(payload.email)) {
    return res.status(403).json({ ok: false, message: '需要管理员权限' })
  }
  next()
}

router.use(requireAuth, requireAdmin)

interface AdminUserRow {
  id: string
  email: string | null
  username: string | null
  created_at: string
  synced_ms: number | null
  data_chars: number | null
}

/** GET /api/admin/users —— 全量用户列表（含记录存储概览） */
router.get('/users', (_req, res) => {
  // v4.5 记录级同步后 snapshots 表恒空，概览改从 records 聚合：
  // 最近同步 = MAX(recv_time)（最后收到推送的时刻），占用 = SUM(length(data))
  const rows = db.prepare(`
    SELECT u.id, u.email, u.username, u.created_at,
           r.synced_ms AS synced_ms,
           r.data_chars AS data_chars
    FROM users u
    LEFT JOIN (
      SELECT user_id, MAX(recv_time) AS synced_ms, SUM(length(data)) AS data_chars
      FROM records GROUP BY user_id
    ) r ON r.user_id = u.id
    ORDER BY u.created_at
  `).all() as unknown as AdminUserRow[]

  res.json({
    ok: true,
    data: {
      users: rows.map(r => ({
        id: r.id,
        email: r.email,
        username: r.username,
        createdAt: r.created_at,
        // 对齐旧 snapshots.updated_at 的 localtime 文本格式，前端 fmtTime 无需改动
        syncedAt: r.synced_ms ? new Date(r.synced_ms).toLocaleString('sv-SE').replace(' ', 'T') : null,
        snapshotKb: r.data_chars ? Math.round(r.data_chars / 1024) : 0
      }))
    }
  })
})

/** PUT /api/admin/users/:id/password {password} —— 重置密码
 *  bump token_ver（对方全部会话即时失效）+ 共享弱口令策略（与注册同规，不再绕行） */
router.put('/users/:id/password', (req, res) => {
  const pwd = String((req.body || {}).password || '')
  const payload = res.locals.user as JwtPayload
  const target = db.prepare('SELECT email FROM users WHERE id = ?').get(req.params.id) as { email: string | null } | undefined
  const pwdCheck = validatePassword(pwd, target?.email || '')
  if (!pwdCheck.ok) return res.status(400).json({ ok: false, message: pwdCheck.reason })

  const r = db.prepare('UPDATE users SET password = ?, token_ver = token_ver + 1 WHERE id = ?')
    .run(hashPassword(pwd), req.params.id)
  if (r.changes === 0) return res.status(404).json({ ok: false, message: '用户不存在' })
  res.json({ ok: true, data: null })
})

/** DELETE /api/admin/users/:id —— 删除用户（快照级联清除；禁止删除自己） */
router.delete('/users/:id', (req, res) => {
  const payload = res.locals.user as JwtPayload
  if (payload.uid === req.params.id) {
    return res.status(400).json({ ok: false, message: '不能删除自己的账号' })
  }

  const r = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  if (r.changes === 0) return res.status(404).json({ ok: false, message: '用户不存在' })
  res.json({ ok: true, data: null })
})
