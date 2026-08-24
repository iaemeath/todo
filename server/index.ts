/**
 * 拾光后端入口：Express 5 + node:sqlite。
 * 监听 127.0.0.1:8787（nginx 反代 /api/ → 本服务，不直接暴露公网）。
 */
import express from 'express'
import { router as authRouter } from './auth'
import { router as snapshotRouter } from './snapshot'
import { router as adminRouter } from './admin'

const app = express()
app.use(express.json({ limit: '2mb' }))

// CORS：Electron 壳以 file:// 加载（Origin 为 null）跨域访问 API 需要；
// 纯 Bearer 认证无 Cookie，自用服务对公开接口全放行。
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use('/api/auth', authRouter)
app.use('/api/snapshot', snapshotRouter)
app.use('/api/admin', adminRouter)

// API 404 统一 JSON
app.use((_req, res) => res.status(404).json({ ok: false, message: 'Not Found' }))

// 统一错误出口：不让栈信息泄漏到响应
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[shiguang-server] unhandled error:', err)
  if (res.headersSent) return
  res.status(500).json({ ok: false, message: '服务器内部错误' })
})

const PORT = Number(process.env.PORT || 8787)
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[shiguang-server] listening on http://127.0.0.1:${PORT}`)
})
