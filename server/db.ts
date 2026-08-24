/**
 * 数据库：node:sqlite（Node 24 内置，零 npm 依赖）。
 * 单文件 data/shiguang.db，WAL 模式。自用规模下无并发压力，无需连接池概念。
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

export const db = new DatabaseSync(join(DATA_DIR, 'shiguang.db'))

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

// 用户隔离不依赖 WHERE 记得写 user_id：快照表主键即 user_id，一用户至多一行。
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT,
    username   TEXT,
    password   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    user_id    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- v4.5 记录级同步：每条数据一行（墓碑也是记录）。双时间戳：
  --   rev_time  = 客户端时钟（LWW 裁决"数据多新"）
  --   recv_time = 服务端时钟（增量拉取游标，单调可靠不漏数据）
  CREATE TABLE IF NOT EXISTS records (
    user_id    TEXT NOT NULL,
    collection TEXT NOT NULL,
    record_id  TEXT NOT NULL,
    data       TEXT NOT NULL,
    rev_time   INTEGER NOT NULL,
    recv_time  INTEGER NOT NULL,
    PRIMARY KEY (user_id, collection, record_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// 旧库迁移：v4.2 前的表无 email 列（ALTER 不能加 NOT NULL 无默认值，故列可空、应用层强制注册必填）
const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
if (!userCols.some(c => c.name === 'email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT')
// v4.4：昵称概念移除，DROP 旧列（SQLite ≥3.35 支持；Node 24 内置版本满足）
if (userCols.some(c => c.name === 'nickname')) db.exec('ALTER TABLE users DROP COLUMN nickname')

// email 唯一（部分索引：历史/未绑邮箱的 NULL 不参与唯一约束）
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL')

// v4.5 一次性迁移：旧整包快照拆成记录（每用户至多执行一次：有快照且该用户尚无记录）
{
  const rows = db.prepare('SELECT user_id, data, updated_at FROM snapshots').all() as {
    user_id: string; data: string; updated_at: string
  }[]
  const rev = Date.now() // 拆包时间作为初始修订时间
  const ins = db.prepare(
    'INSERT OR IGNORE INTO records (user_id, collection, record_id, data, rev_time, recv_time) VALUES (?, ?, ?, ?, ?, ?)'
  )
  for (const s of rows) {
    const has = db.prepare('SELECT 1 FROM records WHERE user_id = ? LIMIT 1').get(s.user_id)
    if (has) continue
    try {
      const b = JSON.parse(s.data)
      for (const t of Array.isArray(b.tasks) ? b.tasks : []) ins.run(s.user_id, 'tasks', String(t.id), JSON.stringify(t), rev, rev)
      for (const sc of Array.isArray(b.schedules) ? b.schedules : []) ins.run(s.user_id, 'schedules', String(sc.id), JSON.stringify(sc), rev, rev)
      for (const [k, v] of Object.entries(b.settings || {})) {
        if (k !== 'apiKey') ins.run(s.user_id, 'settings', k, JSON.stringify(v ?? null), rev, rev)
      }
      if (b.theme) ins.run(s.user_id, 'meta', 'theme', JSON.stringify(b.theme.isDark === true), rev, rev)
      ins.run(s.user_id, 'meta', 'todoVisible', JSON.stringify(b.todoVisible !== false), rev, rev)
      for (const u of Array.isArray(b.usage) ? b.usage : []) ins.run(s.user_id, 'usage', String(u.id), JSON.stringify(u), rev, rev)
    } catch {
      // 单个快照损坏跳过（记录级同步首轮全量推会重建）
    }
  }
  // 拆解完成后清掉旧快照表数据（表保留作回滚线索，路由已下线）
  db.exec('DELETE FROM snapshots')
}
