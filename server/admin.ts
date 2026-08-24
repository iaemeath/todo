/**
 * 用户管理（管理员）：列表 / 改昵称 / 重置密码 / 删除。
 * 权限=白名单角色（roles.ts），前端 features.admin 仅控入口显隐，安全边界在此。
 * 删除用户时快照由 FK ON DELETE CASCADE 级联清除；对方浏览器本地数据不受影响（本地优先架构）。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { db } from './db'
import { requireAuth, hashPassword } from './auth'
import { isAdmin } from './roles'
import type { JwtPayload } from './jwt'

export const router = Router()

/** 管理员守卫：requireAuth 之后校验白名单（401 优先于 403，不泄漏角色信息给未登录者） */
function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const payload = res.locals.user as JwtPayload
  if (!isAdmin(payload.username)) {
    return res.status(403).json({ ok: false, message: '需要管理员权限' })
  }
  next()
}

router.use(requireAuth, requireAdmin)

interface AdminUserRow {
  id: string
  username: string
  nickname: string | null
  created_at: string
  synced_at: string | null
  snapshot_chars: number | null
}

/** GET /api/admin/users —— 全量用户列表（含快照概览） */
router.get('/users', (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.nickname, u.created_at,
           s.updated_at AS synced_at,
           length(s.data) AS snapshot_chars
    FROM users u
    LEFT JOIN snapshots s ON s.user_id = u.id
    ORDER BY u.created_at
  `).all() as unknown as AdminUserRow[]

  res.json({
    ok: true,
    data: {
      users: rows.map(r => ({
        id: r.id,
        username: r.username,
        nickname: r.nickname,
        createdAt: r.created_at,
        syncedAt: r.synced_at,
        snapshotKb: r.snapshot_chars ? Math.round(r.snapshot_chars / 1024) : 0
      }))
    }
  })
})

/** PATCH /api/admin/users/:id {nickname} —— 改昵称 */
router.patch('/users/:id', (req, res) => {
  const nickname = String((req.body || {}).nickname || '').trim().slice(0, 30)
  if (!nickname) return res.status(400).json({ ok: false, message: '昵称不能为空' })

  const r = db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, req.params.id)
  if (r.changes === 0) return res.status(404).json({ ok: false, message: '用户不存在' })
  res.json({ ok: true, data: null })
})

/** PUT /api/admin/users/:id/password {password} —— 重置密码（对方已发 token 到期前仍有效，无状态 JWT 的固有限制） */
router.put('/users/:id/password', (req, res) => {
  const pwd = String((req.body || {}).password || '')
  if (pwd.length < 6 || pwd.length > 64) {
    return res.status(400).json({ ok: false, message: '密码长度需 6~64 位' })
  }

  const r = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(pwd), req.params.id)
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
