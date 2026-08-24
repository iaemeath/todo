/**
 * 快照同步：GET/PUT /api/snapshot（requireAuth）。
 * 服务端不解析业务数据，只用 parseBundle 校验结构后整存整取——
 * 本地优先架构下服务端只是「带账号的备份盘」。
 */
import { Router, type Response } from 'express'
import { db } from './db'
import { requireAuth } from './auth'
import type { JwtPayload } from './jwt'
import { parseBundle } from '../src/types/bundle'

export const router = Router()
router.use(requireAuth)

const me = (res: Response) => res.locals.user as JwtPayload

/** GET /api/snapshot → 200 {snapshot, updated_at} | 204 无快照 */
router.get('/', (_req, res) => {
  const row = db.prepare('SELECT data, updated_at FROM snapshots WHERE user_id = ?')
    .get(me(res).uid) as { data: string; updated_at: string } | undefined
  if (!row) return res.status(204).end()
  res.json({ ok: true, data: { snapshot: JSON.parse(row.data), updated_at: row.updated_at } })
})

/** PUT /api/snapshot {snapshot: ExportBundle} —— upsert 全量快照 */
router.put('/', (req, res) => {
  const bundle = parseBundle((req.body || {}).snapshot)
  if (!bundle) {
    return res.status(400).json({ ok: false, message: '快照结构非法（tasks/schedules 必须为数组）' })
  }
  const updatedAt = new Date().toISOString()
  db.prepare(`
    INSERT INTO snapshots (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(me(res).uid, JSON.stringify(bundle), updatedAt)
  res.json({ ok: true, data: { updated_at: updatedAt } })
})
