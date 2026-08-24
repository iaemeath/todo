/**
 * 滑块拼图人机验证（极验模式，零 npm 依赖：node:zlib 手写 PNG 编码）。
 *
 * 安全设计（对照被替换的算术 SVG 验证码——答案明文在 <text> 节点可正则提取）：
 * - 缺口以位图形式渲染进背景 PNG，答案 x 坐标永不下发，提取需图像分析
 * - 拼图块与缺口共享同一份随机纹理（从背景像素拷贝），拖到位纹理无缝衔接
 * - verify 校验：位置容差 ±5px + 轨迹真实性（点数/时长/覆盖度），失败 2 次销毁
 * - challenge 按 IP 频控（10 次/分钟）：堵 x 坐标暴力枚举的主闸
 * - 通过后签发一次性 sliderToken（10 分钟，消费即焚），业务接口只认 token
 * - 内存态存储（TTL 清扫），与登录限流/邮箱验证码同一"重启可丢"取舍
 */
import { randomUUID } from 'node:crypto'
import { deflateSync } from 'node:zlib'

// ===== 常量 =====
const BG_W = 280
const BG_H = 160
const PW = 44   // 拼图块画布宽（形状 32 + padding）
const PH = 50   // 拼图块画布高（形状 43 + padding）
const PCX = 22  // 形状中心在拼图画布内的位置
const PCY = 29
const PIECE_HALF = 16   // 拼图方块半边长（32×32 方块）
const BUMP_R = 7        // 上侧凸起圆半径
const BUMP_CY = -20     // 上侧凸起圆心 y
const TOL = 5           // 位置容差（px）
const CHALLENGE_TTL = 3 * 60_000
const TOKEN_TTL = 10 * 60_000
const MAX_FAILS = 2
const RATE_MAX = 10
const RATE_WINDOW = 60_000

// ===== PNG 编码（node:zlib + 手写 chunk/CRC，RGBAlpha 8bit） =====

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])))
  return Buffer.concat([len, typeB, data, crc])
}

function encodePng(w: number, h: number, rgba: Buffer): Buffer {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h) // 每行前加 filter byte 0（None）
  for (let y = 0; y < h; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const toDataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`

// ===== 小工具 =====

const rand = (min: number, max: number) => min + Math.random() * (max - min)

/** hsl(h∈[0,360), s/l∈[0,1]) → rgb(0~255) */
function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (h % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

// ===== 拼图形状：32×32 方块 + 上侧半圆凸起（经典拼图片） =====

/** (px,py) 相对形状中心，判定是否在拼图形状内 */
function insidePiece(px: number, py: number): boolean {
  if (Math.abs(px) <= PIECE_HALF && Math.abs(py) <= PIECE_HALF) return true
  const dx = px
  const dy = py - BUMP_CY
  if (dx * dx + dy * dy <= BUMP_R * BUMP_R) return true
  return false
}

// ===== 背景渲染：渐变底 + 随机几何形状 + 像素噪点（无外部素材） =====

interface Shape {
  kind: 'circle' | 'rect'
  cx: number; cy: number; a: number; b: number
  rgb: [number, number, number]
  alpha: number
}

function renderBackground(): Buffer {
  const hBase = rand(0, 360)
  const top = hsl(hBase, rand(0.35, 0.55), rand(0.62, 0.76))
  const bottom = hsl(hBase + rand(40, 140), rand(0.35, 0.55), rand(0.55, 0.7))
  const shapes: Shape[] = Array.from({ length: 10 }, () => ({
    kind: Math.random() < 0.65 ? 'circle' : 'rect',
    cx: rand(0, BG_W), cy: rand(0, BG_H),
    a: rand(14, 44), b: rand(14, 44),
    rgb: hsl(rand(0, 360), rand(0.4, 0.7), rand(0.45, 0.75)),
    alpha: rand(0.12, 0.3)
  }))

  const buf = Buffer.alloc(BG_W * BG_H * 4)
  for (let y = 0; y < BG_H; y++) {
    const t = y / (BG_H - 1)
    for (let x = 0; x < BG_W; x++) {
      let r = top[0] + (bottom[0] - top[0]) * t
      let g = top[1] + (bottom[1] - top[1]) * t
      let b = top[2] + (bottom[2] - top[2]) * t
      for (const s of shapes) {
        const hit = s.kind === 'circle'
          ? ((x - s.cx) ** 2 + (y - s.cy) ** 2) <= s.a * s.a
          : Math.abs(x - s.cx) <= s.a && Math.abs(y - s.cy) <= s.b
        if (hit) {
          r = r * (1 - s.alpha) + s.rgb[0] * s.alpha
          g = g * (1 - s.alpha) + s.rgb[1] * s.alpha
          b = b * (1 - s.alpha) + s.rgb[2] * s.alpha
        }
      }
      const n = rand(-9, 9) // 像素噪点：加大图像分析成本
      const o = (y * BG_W + x) * 4
      buf[o] = Math.max(0, Math.min(255, Math.round(r + n)))
      buf[o + 1] = Math.max(0, Math.min(255, Math.round(g + n)))
      buf[o + 2] = Math.max(0, Math.min(255, Math.round(b + n)))
      buf[o + 3] = 255
    }
  }
  return buf
}

/** 背景挖缺口：形状区变暗，边界描深色（视觉可辨但答案只存在于像素明暗中） */
function carveNotch(bg: Buffer, ax: number, ay: number): void {
  for (let j = 0; j < PH; j++) {
    for (let i = 0; i < PW; i++) {
      const px = i - PCX
      const py = j - PCY
      if (!insidePiece(px, py)) continue
      const bx = ax + px
      const by = ay + py
      if (bx < 0 || bx >= BG_W || by < 0 || by >= BG_H) continue
      const edge = !insidePiece(px - 1, py) || !insidePiece(px + 1, py)
        || !insidePiece(px, py - 1) || !insidePiece(px, py + 1)
      const o = (by * BG_W + bx) * 4
      if (edge) {
        bg[o] = 40; bg[o + 1] = 44; bg[o + 2] = 58
      } else {
        bg[o] = Math.round(bg[o] * 0.45)
        bg[o + 1] = Math.round(bg[o + 1] * 0.45)
        bg[o + 2] = Math.round(bg[o + 2] * 0.45)
      }
    }
  }
}

/** 拼图块：从背景缺口位置拷贝纹理 + 边界白描边（拖到位时纹理无缝衔接） */
function renderPiece(bg: Buffer, ax: number, ay: number): Buffer {
  const out = Buffer.alloc(PW * PH * 4) // 透明底
  for (let j = 0; j < PH; j++) {
    for (let i = 0; i < PW; i++) {
      const px = i - PCX
      const py = j - PCY
      if (!insidePiece(px, py)) continue
      const bx = ax + px
      const by = ay + py
      const o = (j * PW + i) * 4
      const edge = !insidePiece(px - 1, py) || !insidePiece(px + 1, py)
        || !insidePiece(px, py - 1) || !insidePiece(px, py + 1)
      if (edge) {
        out[o] = 255; out[o + 1] = 255; out[o + 2] = 255; out[o + 3] = 235
      } else if (bx >= 0 && bx < BG_W && by >= 0 && by < BG_H) {
        const s = (by * BG_W + bx) * 4
        out[o] = bg[s]; out[o + 1] = bg[s + 1]; out[o + 2] = bg[s + 2]; out[o + 3] = 255
      } else {
        out[o] = 128; out[o + 1] = 130; out[o + 2] = 140; out[o + 3] = 200 // 防御性兜底
      }
    }
  }
  return out
}

// ===== 状态存储（内存态，与登录限流同一取舍） =====

interface ChallengeEntry {
  answerX: number
  fails: number
  expiresAt: number
}
const challenges = new Map<string, ChallengeEntry>()
const tokens = new Map<string, number>() // sliderToken → expiresAt（一次性）
const rate = new Map<string, { count: number; windowStart: number }>()

function sweep(): void {
  const now = Date.now()
  for (const [id, e] of challenges) if (e.expiresAt < now) challenges.delete(id)
  for (const [t, exp] of tokens) if (exp < now) tokens.delete(t)
  for (const [ip, r] of rate) if (now - r.windowStart > RATE_WINDOW) rate.delete(ip)
}

// ===== 对外接口 =====

export interface SliderChallenge {
  id: string
  bg: string       // 背景 PNG data URL（含缺口）
  piece: string    // 拼图块 PNG data URL
  pieceY: number   // 拼图块 top（背景图坐标系，left 随拖动）
}

/** 生成挑战；null = 该 IP 触发频控（x 暴力枚举的主闸） */
export function createChallenge(ip: string): SliderChallenge | null {
  sweep()
  const now = Date.now()
  let rec = rate.get(ip)
  if (!rec || now - rec.windowStart > RATE_WINDOW) {
    rec = { count: 0, windowStart: now }
    rate.set(ip, rec)
  }
  if (++rec.count > RATE_MAX) return null

  const bg = renderBackground()
  // 缺口中心：x 留足两侧拖动行程（拼图块中心可达域 [PW/2, BG_W-PW/2]）
  const answerX = Math.round(rand(PW + 40, BG_W - 40))
  const answerY = Math.round(rand(55, BG_H - 40))
  carveNotch(bg, answerX, answerY)
  const piece = renderPiece(bg, answerX, answerY)

  const id = randomUUID()
  challenges.set(id, { answerX, fails: 0, expiresAt: now + CHALLENGE_TTL })
  return {
    id,
    bg: toDataUrl(encodePng(BG_W, BG_H, bg)),
    piece: toDataUrl(encodePng(PW, PH, piece)),
    pieceY: answerY - PCY
  }
}

export interface TrackPoint {
  t: number // 相对拖动开始的毫秒
  x: number // 滑块位移
}

/** 轨迹真实性：挡"直接 set x"的脚本调用（真实 pointermove 采样密集） */
function isValidTrack(track: TrackPoint[], x: number): boolean {
  if (!Array.isArray(track) || track.length < 3) return false
  const first = track[0]
  const last = track[track.length - 1]
  if (typeof first?.t !== 'number' || typeof last?.t !== 'number') return false
  if (last.t - first.t < 120) return false // 瞬移过快
  if (Number(first.x) > 8) return false // 起点应近左端
  const maxX = Math.max(...track.map(p => Number(p.x) || 0))
  if (Math.abs(maxX - x) > 3) return false // 轨迹须实际覆盖提交位移
  return true
}

/** 校验滑块：ok 时签发一次性 sliderToken；fail 2 次销毁挑战 */
export function verifySlider(
  id: string,
  x: number,
  track: TrackPoint[]
): { status: 'ok'; token: string } | { status: 'fail' | 'gone' } {
  const entry = challenges.get(id)
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) challenges.delete(id)
    return { status: 'gone' }
  }
  // 前端提交的 x = 滑块位移（拼图块画布 left），画布中心 = x + PW/2
  const posOk = Math.abs(x + PW / 2 - entry.answerX) <= TOL
  if (posOk && isValidTrack(track, x)) {
    challenges.delete(id)
    const token = randomUUID()
    tokens.set(token, Date.now() + TOKEN_TTL)
    return { status: 'ok', token }
  }
  if (++entry.fails >= MAX_FAILS) challenges.delete(id)
  return { status: 'fail' }
}

/** 消费一次性 token：无论成败即焚（业务接口调用处） */
export function consumeSliderToken(token: string): boolean {
  const exp = tokens.get(token)
  tokens.delete(token)
  return exp !== undefined && exp > Date.now()
}
