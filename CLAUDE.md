# 拾光（todo）项目须知

个人 todo / 日历应用，local-first 架构。本文件沉淀"代码里看不出来"的项目知识与实战教训，动手改同步/导入导出/认证前必读第 4、5 节。

## 1. 形态与技术栈

- 前端：Vue 3 `<script setup>` + Element Plus + FullCalendar + Pinia，localStorage 持久化（运行时主存储，断网完全可用）
- 后端：Express 5 + node:sqlite（`server/`），零 npm 运行时依赖哲学（JWT/滑块验证码/PNG 编码全手写）；需 Node ≥ 22（node:sqlite）
- 桌面壳：Electron 加载 dist/index.html，API 走绝对地址（数据管理页可配置服务器地址，支持 https）
- 服务端监听 127.0.0.1:8787，设计为 nginx 同机反代 `/api` → 8787；`trust proxy='loopback'` 已设——`req.ip` 依赖它从 X-Forwarded-For 还原真实客户端地址，不设则所有请求挤在同一个限流桶

## 2. 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 前端 vite dev（HMR 自动生效；起前先确认端口上无既有实例） |
| `npm run build` | vue-tsc 类型检查 + 构建（类型错误在这里暴露，无独立 lint 命令） |
| `cd server && npm run dev` | 后端 `tsx watch`（注意 `npm run start` 是无 watch 版，改码不热载） |
| `npm run electron:dev` | 构建 + Electron 壳 |

测试已补：`cd server && npm test`（node:test 内置框架 + tsx，纯函数单测零新依赖）；其余验证 = curl 边界用例 + 浏览器 GUI（playwright）走完整链路。

### 版本纪律与产品更新

- **发版必须 bump `package.json` version**（0.1.0 起步）——桌面自动更新与 Web 刷新提示都靠它比对
- 三形态更新通道：**Web**=运行时拉 `dist/version.json` 与 `__APP_VERSION__`（vite define 注入）比对，不一致 toast 提示刷新；**桌面**=electron-updater（generic feed `https://域名/updates/`，启动+每 6h 检查、后台静默下载、就绪弹窗重启安装）
- 桌面主进程必须 `npm run bundle-main` 打成单文件 CJS（`electron/main.bundle.cjs`）：package.json "type":"module" 下 .js 会按 ESM 解析直接崩；且 electron-builder 的 `!node_modules/**/*` 排除要求把 updater 依赖树打进 bundle（.cjs 扩展名强制 CJS 语义）
- **NSIS 打包（electron:build）只能在联网机器执行**——electron-builder 需下载自带 Electron/NSIS 工具链，内网机不可达（release/ 产物经 Syncthing 同步分发）。发版流程：bump version → electron:build → 上传 `release/拾光-Setup-*.exe` + `latest.yml` 到服务器 `/updates/`（nginx 静态服务）

环境变量（server/）：`PORT`、`INVITE_CODE`（设置后注册必带）、`ADMIN_USERS`（管理员邮箱）、`SMTP_HOST/PORT/USER/PASS/FROM`（验证码邮件）。JWT 密钥自动生成于 `server/data/secret.key`（gitignored）。

## 3. 目录速览

- `src/components/` 页面组件；`src/stores/` Pinia + localStorage 持久化；`src/services/` syncManager（同步单例）/ apiClient / tokenStore
- `src/types/bundle.ts` 前后端共享数据契约——铁律：禁 import vue/pinia 等运行时依赖，后端直接引用做校验
- `server/`：index 入口 / auth 认证+滑块 / sync 记录同步 / admin 用户管理 / db / jwt / sliderCaptcha / mailCode / mailer / roles
- `server/data/` 运行数据（gitignored）

## 4. 同步与数据语义不变量

- 记录级同步（每条数据独立记录），双时间戳分工**不可混用**：
  `rev` = 客户端编辑时刻 → LWW 裁决方向（同记录谁新谁赢）；`recv_time` = 服务端时钟 → 拉取游标（绝不漏数据）
- 墓碑 `deletedAt`：删除的传播机制。UI 层过滤、同步层保留；导出文件只含活跃数据（不含墓碑）
- apiKey 永不上云（collectAll 跳过 settings 的该字段）；存在于本机与导出文件——导入时随备份恢复，旧备份无 key 回退本机现值
- `importBundle` = "备份为准"覆盖语义：包内记录 revTime=now 复活 + 差集墓碑（本机有而包里没有的删除）→ 登录态下约 30 秒内传播到云端与其他设备
- 「从云端恢复」与「文件导入」都是整体覆盖，最后操作说了算，**不要连用**；无自动快照/撤销层，后悔药只有事先导出的备份文件
- 任务 `order` 字段是记录内容的一部分：拖拽改序必须重打 revTime，否则不触发同步（P0 教训）
- 同步触发四条：变更防抖 30s / 每 5 分钟兜底推+拉 / 页面隐藏·关闭 keepalive 补推（body ≤ 60KB）/ 手动
- settings 按字段记录化（改主题色与改时段互不覆盖）；usage 追加型流水按 id 合并

## 5. 坑清单（全部实战踩过）

- 后端以无 watch 方式启动时改码不热载且无任何提示——重启前先 `netstat -ano` 查 8787 端口进程确认启动方式
- 测登录限流必须带伪造 `X-Forwarded-For`，否则失败计数会锁真实 127.0.0.1 桶 10 分钟，影响后续所有本机登录测试
- 登录限流双维度：同邮箱 5 次 / 同 IP 20 次失败锁 10 分钟（防定点爆破 + 防换邮箱撞库喷洒）
- 校验顺序铁律：可重试项（格式/邀请码/弱口令）→ 消耗性资源（sliderToken/邮箱验证码）→ 唯一性查询——顺序反了会浪费用户验证码或给未验证者探测注册占用
- token_ver 会话吊销：改密/重置 bump，requireAuth 比对 JWT payload.ver（无 ver 按 0 兼容存量）；自助改密成功需重签 token 返回给当前设备
- 日程跨零点校验（endTime ≤ startTime 即拒绝并 revert）在 eventDrop / eventResize / eventReceive 三处都要有
- 服务端 push/pull 每用户限流（30/分、60/分），429 文案统一"同步请求过于频繁"

## 6. localStorage 键名表（排障用）

| 键 | 内容 |
|---|---|
| canvas_tasks / canvas_schedules / canvas_settings / canvas_theme / canvas_api_usage | 各 store 持久化 |
| todo_visible / nav_rail_visible | UI 偏好（'0'/'1'） |
| screensaver_hour12 | 屏保 12/24 小时制偏好（'0'=24/'1'=12，默认 24） |
| shiguang_token / shiguang_user / shiguang_last_user | 登录态与账号切换检测 |
| shiguang_last_synced_at / shiguang_sync_cursor | 同步产物（退出登录时清除） |
| shiguang_server_url | Electron 壳 API 地址覆盖（空 = 默认域名） |

## 7. 前端编写规范

### 令牌族（theme.css 单一定义点，样式必用 var() 引用）

- 令牌只在 `src/styles/theme.css` 定义一次，组件一律 `var(--xxx)` 引用，**禁裸值**——stylelint 已强制：padding/gap 禁裸 px、border-radius 仅允许 9999px（胶囊特例）、transition 禁手写秒数与 cubic-bezier、font-weight 禁裸数字；确需特例时行内 `stylelint-disable-line` 并注明原因（参考既有写法）
- 色彩：`--color-primary`（运行时可被用户主题色覆盖，派生 light/dark/alpha 用 color-mix 跟随）；语义色 `--color-success/warning/danger/info`（各带 `*-alpha` 弱底）；文本三档 `--text-primary/secondary/muted`；边框 `--border-glass(-subtle)`
- 间距五档 `--space-xs/sm/md/lg/xl`（4/8/12/16/24px，语义=图标间距/组内/卡片内/区块内/区块间）
- 其余族：圆角 `--radius-sm/md/lg`、阴影 `--shadow-sm/md/lg`、字号 `--font-xs/sm/base/md`、字重 `--weight-regular~bold`、动效 `--duration-fast/base/slow` + `--ease-spring`（招牌弹性）/`--ease-standard`、浮层 `--z-overlay`
- Element Plus 主题已桥接：`--el-*` 映射到上述令牌——调整 EP 观感改 theme.css 映射，不在组件里覆盖 `--el-` 变量

### 平台与主题双态

- 断点 768px 单一定义（`ui.ts` 的 `MOBILE_BREAKPOINT`）：JS 判断用 `useUIStore().isMobile`；CSS 用 `html.platform-mobile` 作用域（与 isMobile 同源挂载，自动切换平台变体令牌：--space 收紧、--touch-target 44px）
- 暗色主题在 theme.css 覆盖同名令牌——组件内不写颜色双分支，令牌自动切换

### 组件约定

- SFC 段落顺序：template → `<script setup lang="ts">` → `<style scoped>`；覆盖 EP 内部样式用 `:deep()`
- 图标双库分工：按钮/工具栏用 `@element-plus/icons-vue`（配 `:icon` 属性）；自绘交互区（日历/待办栏/滑块/语音）用 `lucide-vue-next`
- Pinia 解构纪律：state/getter 走 `storeToRefs()`，action 直接解构（防响应性丢失）
- 触控热区纵向 ≥ `var(--touch-target)`；移动端弹窗宽度 92vw 惯例（见 style.css）
- 模糊搜索用 Fuse.js（threshold 0.4 惯例）

### 多端开发规则（移动优先）

- **移动优先写法**：基础样式面向移动端，桌面增强一律 `@media (width >= 769px)`（既有实践 10:1）；反向 max-width 仅 style.css 全局弹窗一处特例，新代码不再增
- **统一指针模型**：交互用 pointerdown/move/up + `setPointerCapture`，鼠标/触摸/手写笔一套逻辑（SliderCaptcha/TodoSidebar 模式）；不写 mouse+touch 双份监听
- **滚动性能**：scroll/touch 类监听加 `{ passive: true }`（既有先例）；动效只动 transform/opacity（合成层不触 reflow），时长曲线走动效令牌
- **视口高度**：用 `svh`/`dvh` 不用 `vh`（移动端地址栏收缩，#app 100svh 既有）
- **触控反馈**：热区纵向 ≥ `var(--touch-target)`；关键信息不靠 hover 传达（触屏 sticky-hover），纯 hover 效果用 `@media (hover: hover)` 门控
- **iOS 输入**：根字号 18px ≥ 16px 防 focus 自动放大（既有）；表单键盘语义用 `inputmode`，不改 type
- **安全区**：底部固定元素必须 `env(safe-area-inset-bottom)` 兜底（当前无此类 UI，出现时必加）

## 8. 约定与提交习惯

- 前后端共享逻辑（弱口令校验、数据契约）以纯函数下沉 `src/types/`，双端 import——新共享逻辑沿用此模式
- 提交按语义拆批，中文 conventional 风格（feat/fix/refactor/chore：一句话讲清动机与手段，参考 git log 既有风格）

<!-- claude-mem-lite:begin v1 -->
## claude-mem-lite — persistent memory

PreToolUse hooks already run `mem_recall` for past lessons before Read/Edit/Write. The calls worth making proactively:

| When | Call |
|------|------|
| Before Edit/Write | hook already recalled; if a `#NN` lesson was injected, cite `#NN` next time you produce user-visible text (citing = adopting the feedback; uncited lessons decay) |
| After fixing a non-trivial bug | `mem_save(type="bugfix", lesson_learned="<root cause + fix>", importance=2)` |
| After a non-obvious architecture decision | `mem_save(type="decision", lesson_learned="<constraint + tradeoff>")` |
| Deferring to a future session | `mem_defer({title, priority:1|2|3, detail})`; when fixed, add `closes_deferred=[N]` to `mem_save` |
| Looking up past work / history | `mem_search "keywords"` · `mem_recent` · `mem_timeline` |

Path cost is round-trips, not milliseconds: the PreToolUse hook above already recalls (0 calls) — prefer it. For an explicit query, if these `mem_*` tools are deferred behind ToolSearch this session, the Bash CLI (exact path in the detail doc) is one call vs two (ToolSearch + call).

Full tool + CLI tables, citation/decay rules, and save discipline → `.claude/plugin_claude_mem_lite.md`
<!-- claude-mem-lite:end -->
