/**
 * 邮箱验证码统一机制（注册验证 / 忘记密码共用）：
 * 6 位数字、TTL 10 分钟、单次销毁、60s 发送间隔、单邮箱每日 10 次上限。
 * 内存 Map 存储：重启清零（与登录限流同一取舍，自用规模可接受）。
 */
import { randomInt } from 'node:crypto'
import { sendCodeMail } from './mailer'

const TTL_MS = 10 * 60 * 1000
const RESEND_INTERVAL_MS = 60 * 1000
const DAILY_LIMIT = 10

/** 邮箱验证码用途（同时是 Map key 命名空间：同邮箱两种用途互不干扰） */
export type MailCodePurpose = 'register' | 'reset'

interface CodeEntry {
  code: string
  expiresAt: number
  /** 下次允许发送的时间戳（60s 间隔） */
  nextSendAt: number
  /** 当日已发送次数（跨 24h 窗口滚动简化：按自然累计 + 每次发送时惰性衰减） */
  sentCount: number
  sentWindowStart: number
  /** 校验失败次数（暴力防护：满 5 次作废重取） */
  fails: number
}

const store = new Map<string, CodeEntry>()
const key = (purpose: MailCodePurpose, email: string) => `${purpose}:${email.toLowerCase()}`

/**
 * 发码前检查并发码。返回 null=成功；非 null=拒绝原因（中文，可直接给用户看）。
 * 60s 间隔与每日上限在此统一把关，调用方无需重复判断。
 */
export async function issueMailCode(purpose: MailCodePurpose, email: string): Promise<string | null> {
  const k = key(purpose, email)
  const now = Date.now()
  const entry = store.get(k)

  if (entry) {
    if (entry.nextSendAt > now) {
      const secs = Math.ceil((entry.nextSendAt - now) / 1000)
      return `发送过于频繁，请 ${secs} 秒后再试`
    }
    // 24h 滚动窗口计数
    if (now - entry.sentWindowStart > 24 * 3600 * 1000) {
      entry.sentCount = 0
      entry.sentWindowStart = now
    }
    if (entry.sentCount >= DAILY_LIMIT) return '该邮箱今日验证码发送次数已达上限'
  }

  const code = String(randomInt(0, 1000000)).padStart(6, '0')
  await sendCodeMail(email, code, purpose)

  const next: CodeEntry = entry || { code: '', expiresAt: 0, nextSendAt: 0, sentCount: 0, sentWindowStart: now, fails: 0 }
  next.code = code
  next.expiresAt = now + TTL_MS
  next.nextSendAt = now + RESEND_INTERVAL_MS
  next.sentCount += 1
  next.fails = 0 // 新码重置失败计数
  store.set(k, next)
  return null
}

/** 验证码错误尝试上限：满 5 次作废（防在线穷举 6 位码） */
const MAX_FAILS = 5

/**
 * 校验验证码：匹配且未过期才通过，通过后即销毁（单次使用）。
 * 不匹配累计失败，满 5 次销毁（对调用方与过期同义：重取新码）。
 */
export function verifyMailCode(purpose: MailCodePurpose, email: string, input: string): boolean {
  const k = key(purpose, email)
  const entry = store.get(k)
  if (!entry || entry.expiresAt < Date.now()) return false
  if (entry.code !== String(input).trim()) {
    entry.fails += 1
    if (entry.fails >= MAX_FAILS) store.delete(k)
    return false
  }
  store.delete(k)
  return true
}
