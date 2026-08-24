/**
 * JWT（HS256）——node:crypto 手写，不引第三方库。
 * 签名密钥首次启动随机生成并持久化到 data/secret.key（重启不失效，否则全部 token 作废）。
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR } from './db'

function loadSecret(): string {
  const file = join(DATA_DIR, 'secret.key')
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const s = randomBytes(32).toString('hex')
  writeFileSync(file, s, 'utf8')
  return s
}
const SECRET = loadSecret()

export interface JwtPayload {
  uid: string
  username: string
  iat: number
  exp: number // 秒级 unix
}

const b64url = (input: string) => Buffer.from(input, 'utf8').toString('base64url')

export function signJwt(uid: string, username: string, ttlSec = 7 * 24 * 3600): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ uid, username, iat: now, exp: now + ttlSec }))
  const sig = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

/** 校验签名与有效期；任何异常路径返回 null（不抛错，调用方按未登录处理） */
export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, sig] = parts
  const expected = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest()
  let sigBuf: Buffer
  try {
    sigBuf = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  // 长度不等时 timingSafeEqual 会抛错，先比长度
  if (sigBuf.length !== expected.length || !timingSafeEqual(sigBuf, expected)) return null
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof obj.uid !== 'string' || typeof obj.exp !== 'number') return null
    if (obj.exp < Math.floor(Date.now() / 1000)) return null
    return obj as JwtPayload
  } catch {
    return null
  }
}
