/**
 * Web 端版本检查（桌面壳走 electron-updater，本模块在 file:// 协议下自动关闭）。
 * 原理：构建时版本号注入 __APP_VERSION__，产物目录同时落 version.json（scripts/write-version.mjs）；
 * 运行时定时拉 version.json 比对——不一致即"站点已部署新版本"，提示刷新（SPA 刷新即升级）。
 */
import { ElMessage } from 'element-plus'

const CHECK_INTERVAL_MS = 30 * 60_000

export function startVersionCheck(): void {
  // Electron 壳（file://）不走此通道；无 window 环境（SSR 防御）同样跳过
  if (typeof window === 'undefined' || window.location.protocol === 'file:') return

  let notified = false
  const check = async () => {
    if (notified) return
    try {
      // 相对 base（'./'）与部署形态一致；查询串防 CDN/浏览器缓存
      const r = await fetch(`version.json?t=${Date.now()}`)
      if (!r.ok) return
      const v = (await r.json()) as { version?: string }
      if (v.version && v.version !== __APP_VERSION__) {
        notified = true // 每个会话只提示一次，刷新后自然消失
        ElMessage({
          message: `新版本 ${v.version} 已发布，刷新页面即可升级`,
          type: 'info',
          duration: 10_000,
          showClose: true
        })
      }
    } catch {
      // 版本检查失败（离线/未部署 version.json）静默——绝不影响使用
    }
  }
  setTimeout(check, 5_000) // 首次延迟，避开启动高峰
  setInterval(check, CHECK_INTERVAL_MS)
}
