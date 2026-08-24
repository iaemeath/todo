/**
 * 记录级同步：POST /api/sync/push、GET /api/sync/pull（requireAuth）。
 * 服务端是"带账号的记录仓库"：逐条 LWW 裁决（rev_time 新者胜），
 * 不解析业务字段（data 原样整存整取），墓碑记录与普通记录同权。
 */
import { Router, type Response } from 'express'
import { db } from './db'
import { requireAuth } from './auth'
import type { JwtPayload } from './jwt'

export const router = Router()
router.use(requireAuth)

const me = (res: Response) => (res.locals.user as JwtPayload).uid

interface PushChange {
  c: string
  id: string
  data: unknown
  rev: number
}

/** 单次推送的变更条数上限（防御性：异常客户端不至于一次灌爆） */
const MAX_CHANGES = 5000

/**
 * POST /api/sync/push { changes: [{c, id, data, rev}] }
 * 逐条裁决：表内 rev_time < 推来的 rev 才更新（recv_time 刷新）；
 * 否则拒绝该条（对端更新），返回被拒 key 列表触发客户端拉取修正。
 */
router.post('/push', (req, res) => {
  const uid = me(res)
  const changes = Array.isArray((req.body || {}).changes) ? (req.body.changes as PushChange[]) : []
  if (changes.length > MAX_CHANGES) {
    return res.status(400).json({ ok: false, message: `单次推送条数超限（${MAX_CHANGES}）` })
  }

  const now = Date.now()
  const rejected: string[] = []
  const select = db.prepare('SELECT rev_time FROM records WHERE user_id = ? AND collection = ? AND record_id = ?')
  const upsert = db.prepare(`
    INSERT INTO records (user_id, collection, record_id, data, rev_time, recv_time)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, collection, record_id) DO UPDATE SET
      data = excluded.data, rev_time = excluded.rev_time, recv_time = excluded.recv_time
  `)

  for (const ch of changes) {
    if (!ch || typeof ch.c !== 'string' || typeof ch.id !== 'string' || typeof ch.rev !== 'number') {
      continue // 非法条目跳过（不炸整批）
    }
    const row = select.get(uid, ch.c, ch.id) as { rev_time: number } | undefined
    if (row && row.rev_time >= ch.rev) {
      rejected.push(`${ch.c}:${ch.id}`)
      continue
    }
    upsert.run(uid, ch.c, ch.id, JSON.stringify(ch.data ?? null), ch.rev, now)
  }

  res.json({ ok: true, data: { rejected, serverNow: now } })
})

/** GET /api/sync/pull?since=<recv_time> —— 增量拉取（recv_time 服务端时钟游标，不漏数据） */
router.get('/pull', (req, res) => {
  const uid = me(res)
  const since = Number(req.query.since || 0) || 0
  const now = Date.now()

  const rows = db.prepare(
    'SELECT collection, record_id, data, rev_time FROM records WHERE user_id = ? AND recv_time > ?'
  ).all(uid, since) as { collection: string; record_id: string; data: string; rev_time: number }[]

  res.json({
    ok: true,
    data: {
      records: rows.map(r => ({
        c: r.collection,
        id: r.record_id,
        data: JSON.parse(r.data),
        rev: r.rev_time
      })),
      serverNow: now
    }
  })
})
