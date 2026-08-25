// 版本唯一真相源：package.json 三段语义版本（semver）+ 第四位构建号（git 提交计数）。
//
// 版本谱系（勿混）：
// - 试错期：origin/v1 v2 v3 三分支是三条技术路线留档；v3.1 / v4.0.0 / v4.0.1 / v4.1.0
//   标签为该期临时编号（含"岁月史书"博物馆封存），纯历史档案，不参与现行任何比较。
// - 现行期：ae26b8b「版本纪律 0.1.0 起步」重开编号，0.2.0 = 到点提醒/安卓壳/三通道更新
//   等自 0.1.0 以来的功能集。
//
// 版本纪律：
// - 语义三段 MAJOR.MINOR.PATCH：功能集 → MINOR，修复 → PATCH，博物馆级重构才 MAJOR；
//   进 package.json，是 electron-updater（latest.yml 按 semver 比较更新）与 exe 文件名
//   （拾光-Setup-0.2.0.exe）的依据——这两处必须保持三段，四位会破坏更新判定。
// - 构建号（第四位）= 构建那一刻的 git 提交总数，自动派生永不手工维护；
//   用于四位完整版本（0.2.0.146）的展示与追溯：version.json / Web 版本比对 /
//   Android versionCode / git tag（v0.2.0.146）。
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))

export const semver = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

export const build = Number(
  execSync('git rev-list --count HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
) || 0

/** 四位完整版本：语义三段 + 构建号（如 0.2.0.144） */
export const full = `${semver}.${build}`
