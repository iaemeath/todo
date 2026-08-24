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
    nickname   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    user_id    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// 旧库迁移：v4.2 前的表无 email 列（ALTER 不能加 NOT NULL 无默认值，故列可空、应用层强制注册必填）
const hasEmail = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[])
  .some(c => c.name === 'email')
if (!hasEmail) db.exec('ALTER TABLE users ADD COLUMN email TEXT')

// email 唯一（部分索引：历史/未绑邮箱的 NULL 不参与唯一约束）
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL')
