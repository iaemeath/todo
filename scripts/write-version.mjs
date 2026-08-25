// 构建产物落 dist/version.json：Web 端运行时与构建时注入的 __APP_VERSION__ 比对，
// 不一致即"站点已部署新版本"→ 提示刷新（SPA 刷新即升级）。桌面壳不走此通道（autoUpdater）。
// version=四位完整版本（与 __APP_VERSION__ 同源，见 scripts/version.mjs）；
// semver 三段供人读、对齐 exe 安装包名；build 为构建号（git 提交计数）。
import { writeFileSync } from 'node:fs'
import { semver, build, full } from './version.mjs'

writeFileSync('dist/version.json', JSON.stringify({
  version: full,
  semver,
  build,
  buildAt: new Date().toISOString()
}))
console.log(`[write-version] dist/version.json -> ${full}`)
