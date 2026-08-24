/**
 * 图形人机验证（零依赖手绘 SVG 算术题，svg-captcha 模式）：
 * 答案存内存 Map（TTL 5 分钟），验证即销毁（无论对错），防重放。
 * 算术题比字符码对 OCR 更稳、对人更友好；自用规模下足够"验收非机器"。
 */
import { randomUUID } from 'node:crypto'

interface CaptchaEntry {
  answer: number
  expiresAt: number
}

const TTL_MS = 5 * 60 * 1000
const store = new Map<string, CaptchaEntry>()

// 过期清扫：每次生成时顺手清，不起定时器（与登录限流同一"内存态可丢"取舍）
function sweep() {
  const now = Date.now()
  for (const [id, e] of store) if (e.expiresAt < now) store.delete(id)
}

/** 两个 1~20 的加减法（保证结果非负），手绘 SVG 带干扰线与噪点 */
export function createCaptcha(): { id: string; svg: string } {
  sweep()
  const a = 1 + Math.floor(Math.random() * 20)
  const b = 1 + Math.floor(Math.random() * 20)
  const usePlus = a >= b || Math.random() < 0.5
  const op = usePlus ? '+' : '-'
  const x = usePlus ? a : b
  const y = usePlus ? b : a
  const answer = usePlus ? a + b : b - a

  const id = randomUUID()
  store.set(id, { answer, expiresAt: Date.now() + TTL_MS })

  const W = 120, H = 40
  let noise = ''
  for (let i = 0; i < 5; i++) {
    noise += `<line x1="${Math.random() * W}" y1="${Math.random() * H}" x2="${Math.random() * W}" y2="${Math.random() * H}" stroke="rgba(120,120,140,0.35)" stroke-width="1"/>`
  }
  for (let i = 0; i < 24; i++) {
    noise += `<circle cx="${Math.random() * W}" cy="${Math.random() * H}" r="${Math.random() * 1.6}" fill="rgba(100,100,120,0.4)"/>`
  }
  const text = `${x} ${op} ${y} = ?`
  // 每个字符轻微错位旋转，加大机器识别成本
  let glyphs = ''
  for (let i = 0; i < text.length; i++) {
    const tx = 12 + i * 14 + (Math.random() * 4 - 2)
    const ty = 26 + (Math.random() * 5 - 2.5)
    const rot = Math.random() * 16 - 8
    const fill = `hsl(${215 + Math.random() * 40}, 45%, ${30 + Math.random() * 15}%)`
    glyphs += `<text x="${tx}" y="${ty}" font-size="19" font-family="Georgia, serif" fill="${fill}" transform="rotate(${rot} ${tx} ${ty})">${text[i]}</text>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="6" fill="rgba(245,246,250,0.9)"/>${noise}${glyphs}</svg>`
  return { id, svg }
}

/** 校验：答对且未过期才通过；无论对错当场销毁（用户重取新图） */
export function verifyCaptcha(id: string, input: string | number): boolean {
  const entry = store.get(id)
  store.delete(id)
  if (!entry || entry.expiresAt < Date.now()) return false
  return Number(input) === entry.answer
}
