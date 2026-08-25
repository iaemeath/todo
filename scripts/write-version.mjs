// 构建产物落 dist/version.json：Web 端运行时与构建时注入的 __APP_VERSION__ 比对，
// 不一致即"站点已部署新版本"→ 提示刷新（SPA 刷新即升级）。桌面壳不走此通道（autoUpdater）。
import { writeFileSync, readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
writeFileSync('dist/version.json', JSON.stringify({
  version: pkg.version,
  buildAt: new Date().toISOString()
}))
console.log(`[write-version] dist/version.json -> ${pkg.version}`)
