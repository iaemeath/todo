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

无自动化测试框架——验证方式：curl 边界用例 + 浏览器 GUI（playwright）走完整链路。

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
| shiguang_token / shiguang_user / shiguang_last_user | 登录态与账号切换检测 |
| shiguang_last_synced_at / shiguang_sync_cursor | 同步产物（退出登录时清除） |
| shiguang_server_url | Electron 壳 API 地址覆盖（空 = 默认域名） |

## 7. 约定与提交习惯

- 前后端共享逻辑（弱口令校验、数据契约）以纯函数下沉 `src/types/`，双端 import——新共享逻辑沿用此模式
- 提交按语义拆批，中文 conventional 风格（feat/fix/refactor/chore：一句话讲清动机与手段，参考 git log 既有风格）
