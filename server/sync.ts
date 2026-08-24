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
 * 每用户固定窗口限流（认证后接口，per-uid 而非 per-IP）：
 * 客户端正常节奏 = 30s 防抖 + 5min 兜底 + 页面隐藏/手动同步，远低于配额。
 * push 是写操作（逐条裁决打库）配额更紧；超限 429，客户端按 offline 兜底重试。
 */
const RATE_LIMITS = { push: { max: 30, windowMs: 60_000 }, pull: { max: 60, windowMs: 60_000 } } as const
const rateBuckets = new Map<string, { push: { count: number; start: number }; pull: { count: number; start: number } }>()

/** 过期清扫：每次判定顺带清（小规模遍历，不起定时器——与登录限流同一取舍） */
function allow(uid: string, kind: keyof typeof RATE_LIMITS): boolean {
  const now = Date.now()
  const { max, windowMs } = RATE_LIMITS[kind]
  for (const [u, b] of rateBuckets) {
    if (now - b.push.start > windowMs && now - b.pull.start > windowMs) rateBuckets.delete(u)
  }
  let bucket = rateBuckets.get(uid)
  if (!bucket) {
    bucket = { push: { count: 0, start: now }, pull: { count: 0, start: now } }
    rateBuckets.set(uid, bucket)
  }
  const slot = bucket[kind]
  if (now - slot.start > windowMs) { slot.count = 0; slot.start = now }
  slot.count += 1
  return slot.count <= max
}

/**
 * POST /api/sync/push { changes: [{c, id, data, rev}] }
 * 逐条裁决：表内 rev_time < 推来的 rev 才更新（recv_time 刷新）；
 * 否则拒绝该条（对端更新），返回被拒 key 列表触发客户端拉取修正。
 */
router.post('/push', (req, res) => {
  const uid = me(res)
  if (!allow(uid, 'push')) {
    return res.status(429).json({ ok: false, message: '同步请求过于频繁，请稍后再试' })
  }
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

/** 单次 pull 返回条数上限（分页：防大结果集一次性灌爆响应与客户端内存） */
const PULL_PAGE = 500

/** GET /api/sync/pull?since=<recv_time>&sinceId=<record_id>&limit=<n> —— 增量分页拉取
 *  复合游标 (recv_time, record_id)：push 整批共用同一 recv_time（大平局组），
 *  仅按 recv_time 翻页会在组内原地踏步死循环，必须以 record_id 在组内推进 */
router.get('/pull', (req, res) => {
  const uid = me(res)
  if (!allow(uid, 'pull')) {
    return res.status(429).json({ ok: false, message: '同步请求过于频繁，请稍后重试' })
  }
  const since = Number(req.query.since || 0) || 0
  const sinceId = String(req.query.sinceId || '')
  // 客户端可请求更小页（弱网/测试），不可超过上限
  const limit = Math.min(Math.max(Number(req.query.limit || 0) || PULL_PAGE, 1), PULL_PAGE)
  const now = Date.now()

  // >= 语义（sinceId 为空时等价 recv_time >= since）：pull 返回 serverNow 与紧随的 push
  // 写入可能落在同一毫秒，用 > 会让该记录被增量漏掉；>= 最多重拉边界记录（客户端按 rev 幂等合并）
  // ORDER BY 稳定序 + LIMIT+1 探针：探针行存在即 hasMore，响应前裁掉
  const rows = db.prepare(
    'SELECT collection, record_id, data, rev_time, recv_time FROM records'
    + ' WHERE user_id = ? AND (recv_time > ? OR (recv_time = ? AND record_id > ?))'
    + ' ORDER BY recv_time ASC, record_id ASC LIMIT ?'
  ).all(uid, since, since, sinceId, limit + 1) as { collection: string; record_id: string; data: string; rev_time: number; recv_time: number }[]

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  // 续拉复合游标=本页末条 (recv_time, record_id)；客户端仅 hasMore=false 时才以 serverNow 落游标
  const last = page[page.length - 1]
  const nextSince = last ? last.recv_time : since
  const nextSinceId = last ? last.record_id : sinceId

  res.json({
    ok: true,
    data: {
      records: page.map(r => ({
        c: r.collection,
        id: r.record_id,
        data: JSON.parse(r.data),
        rev: r.rev_time
      })),
      hasMore,
      nextSince,
      nextSinceId,
      serverNow: now
    }
  })
})
