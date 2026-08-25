/**
 * 一次性图标生成：用 Electron 离屏窗口把 public/favicon.svg 栅格化为——
 *   electron/tray.png  32px  托盘图标（Tray 不认 SVG，PNG 必备）
 *   build/icon.ico    256px  安装包/窗口图标（electron-builder Win 默认取此路径，
 *                            修复此前一直用 Electron 默认图标的问题）
 * 运行：npx electron scripts/gen-icons.mjs（产物提交入库，不进构建链）。
 * ICO 为 PNG-in-ICO 单尺寸 256（Vista+ 全兼容；256 尺寸字节编码为 0）。
 */
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** PNG 字节包一层 ICO 容器（单尺寸 256px） */
const wrapIco = (png) => {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // count: 1
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0) // width 256 → 0
  entry.writeUInt8(0, 1) // height 256 → 0
  entry.writeUInt8(0, 2) // palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bpp
  entry.writeUInt32LE(png.length, 8) // bytes in resource
  entry.writeUInt32LE(6 + 16, 12) // data offset
  return Buffer.concat([header, entry, png])
}

/** 离屏渲染 SVG → 指定尺寸 NativeImage（透明背景，等比居中） */
const renderSvg = async (svg, size) => {
  const html = `<!doctype html><html><head><style>
    * { margin: 0; padding: 0 }
    html, body { width: ${size}px; height: ${size}px; background: transparent }
    svg { width: 100%; height: 100%; display: block }
  </style></head><body>${svg}</body></html>`
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  // paint 事件确认首帧渲染，加 50ms 缓冲让 SVG 完整光栅化；1s 超时兜底
  const img = await new Promise((resolve) => {
    let settled = false
    const done = async () => {
      if (settled) return
      settled = true
      await new Promise((r) => setTimeout(r, 50))
      resolve(await win.webContents.capturePage())
    }
    win.webContents.once('paint', done)
    setTimeout(done, 1000)
  })
  win.destroy()
  if (img.isEmpty()) throw new Error(`capturePage 结果为空（size=${size}）`)
  return img
}

app.whenReady().then(async () => {
  try {
    const svg = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8')

    const img256 = await renderSvg(svg, 256)
    mkdirSync(join(ROOT, 'build'), { recursive: true })
    writeFileSync(join(ROOT, 'build/icon.ico'), wrapIco(img256.toPNG()))
    console.log('[gen-icons] build/icon.ico (256px) done')

    const img32 = img256.resize({ width: 32, height: 32, quality: 'best' })
    writeFileSync(join(ROOT, 'electron/tray.png'), img32.toPNG())
    console.log('[gen-icons] electron/tray.png (32px) done')

    app.quit()
  } catch (e) {
    console.error('[gen-icons] failed:', e)
    app.exit(1)
  }
})
