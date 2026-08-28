# 多设备同步架构（当前态）

> 本文是无状态的**现在时**描述：只写"现在是什么"，不写历史。历史见 [evolution.md](evolution.md)，
> 每个设计决定的理由见 [adr/](adr/)。架构变更时本文随代码同步重写。

## 一句话

**local-first 记录级同步**：localStorage 是运行时唯一主存储（断网完全可用），同步是旁路任务；
轮询保底保证正确性，SSE 信令只负责把延迟从分钟级压到秒级。任何一层失效都只退化速度，不伤数据。

## 总览拓扑

```
                 设备 A（编辑方）                       设备 B（感知方）
              ┌─────────────────┐                 ┌─────────────────┐
              │  Vue 组件        │                 │  Vue 组件        │
              │      ↓ 改数据    │                 │      ↑ 响应式更新 │
              │  Pinia stores   │                 │  Pinia stores   │
              │      ↓ touch    │                 │      ↑ LWW 合并  │
              │ localStorage ◄──┼── 持久化/恢复 ──►│ localStorage    │
              └───────┬─────────┘                 └───────▲─────────┘
                      │ push（前沿立即/2s 微批）            │ pull（增量游标）
                      ▼                                   │
   ═══════════════════════════════════════════════════════╪═══════════
    服务器（带账号的记录仓库：LWW 逐条裁决，不懂业务字段）       │
   ───────────────────────────────────────────────────────┼───────────
    POST /api/sync/push ──► records 表逐条落库 ──► SSE 广播  │
    GET  /api/sync/pull ◄──────────── 增量游标查询 ──────────┘
                      │
                      │ SSE 裸信号 {"type":"changed"}（不含数据）
                      ▼
              设备 B 的长连接（登录后建连，一次性票据认证）
```

## 数据模型

每条数据独立成记录 `{c, id, data, rev}`，集合 `c` 五种：`tasks / schedules / settings / meta / usage`。

| 字段/机制 | 语义 |
|---|---|
| `rev`（记录内嵌 revTime，客户端时钟） | **LWW 裁决方向**：同记录谁的新谁赢。容忍设备时钟偏差 |
| `recv_time`（服务端时钟） | **pull 游标**：单调可靠，保证不漏数据，与客户端时钟解耦 |
| `deletedAt`（墓碑） | 删除的传播载体：删除即打标，随普通记录同步，UI 层过滤、同步层保留 |
| settings 按字段记录化 | 一个字段一条记录：A 改主题色与 B 改时段互不覆盖 |
| usage 追加型流水 | 按 id 幂等合并，墓碑按 id 移除 |
| 基线 `lastSyncedMap` | 客户端内存态：key → (json, rev)。推送 diff 的依据，刷新即空 → 首轮全量推（服务端幂等裁决） |

## 服务端接口契约（server/sync.ts）

| 接口 | 行为 |
|---|---|
| `POST /sync/push` | 逐条 LWW 裁决（表内 rev_time ≥ 推来 rev 则拒），返回 `rejected` key 列表；有落库即广播 SSE（排除发起设备 tag）；限流 30/分 |
| `GET /sync/pull?since&sinceId&limit` | 复合游标 `(recv_time, record_id)` 增量分页（500/页，LIMIT+1 探针）；`>=` 语义防同毫秒漏数据；限流 60/分 |
| `POST /sync/sse-ticket` | requireAuth 后签发一次性 SSE 连接票（30s 有效、单次使用） |
| `GET /sync/events?ticket&tag` | SSE 通道（票认证，不过 requireAuth）：hello 帧 → 心跳 25s → `changed` 广播；`X-Accel-Buffering: no` 穿透 nginx；每用户连接上限 8 |

## 客户端 syncManager（src/services/syncManager.ts）

- **push**：`collectAll()` 全量收集（settings 跳过 apiKey）→ `diffChanges()` 对基线逐条比 JSON → 变更集上行；成功后更新基线与 `lastPushedAt`，被拒条目不更新基线并立即 pull。
- **pull**：复合游标分页拉取，**整轮拉完才一次性应用**（中途失败整轮作废，从旧游标重拉幂等无损耗）；`applyRecords` 按集合注册表分发（tasks/schedules 走 revTime 裁决通道，settings/meta 有脏保护，usage 幂等合并）。
- **importBundle**：文件导入 = "备份为准"覆盖语义——包内记录 revTime=now 复活 + 差集墓碑 + 基线作废（ADR-0007）。
- **推送调度**：前沿立即（距上次成功推送 >30s）/ 后沿 2s 固定节流窗合并（ADR-0010）。
- **SSE 客户端**：领票建连 → 500ms 合流信号 → pull；断线自管指数退避重连（1s→60s 封顶，重新领票）；旧版服务端 404 静停。

## 触发链全景

| 方向 | 触发 | 说明 |
|---|---|---|
| 推 | **前沿立即** | 距上次成功推送 >30s 的首个变更，秒级上云 |
| 推 | **后沿 2s 微批** | 刚推过/在途时的变更合并（拖拽排序/导入不放大请求） |
| 推 | 页面隐藏/卸载 | visibilitychange / pagehide → keepalive 补推（body ≤ 60KB） |
| 推 | 兜底定时 | 5min 一跳；**SSE 健在时降频为 30min**（信令在，轮询只是保险，ADR-0009） |
| 推 | 手动 | syncNow（数据管理页 / 同步指示器） |
| 拉 | push 成功后 | 含"被拒即拉"（对端有更新） |
| 拉 | 兜底定时 | 同上，随 push 成功顺带 |
| 拉 | SSE 信号 | 对端 push 秒级唤醒；信号可丢，丢了由兜底补齐 |

## SSE 生命周期

```
登录成功 → startSync() → POST sse-ticket（JWT）→ EventSource 建连（?ticket&tag）
  → hello 确认 → 心跳保活 → changed 信号 → 500ms 合流 → pull
断网/冻结/服务重启 → onerror → 关闭 → 指数退避重连（1s→60s）→ 重新领票
旧版服务端 404 → 静停重试（纯轮询兜底）
登出/账号切换 → stopSSE() 拆除
```

## 失败矩阵

| 故障 | 后果 | 兜底 |
|---|---|---|
| SSE 信号丢失 | 对端感知变慢 | 兜底轮询（≤30min）补齐，数据零丢失 |
| 推送时断网 | syncState=offline | 下次变更前沿重试 + 兜底定时；下次启动基线为空全量重推（幂等） |
| pull 中途失败 | 整轮作废游标不动 | 下轮从旧游标重拉，幂等无损耗 |
| 两端同时改同一条 | LWW 裁决，输方收 rejected | 被拒即拉，本地修正为对端版 |
| 服务器重启 | 票/连接蒸发（内存态） | 客户端退避重连续上 |
| 票据重放 | — | 单次使用 + 30s TTL |

## 不变量（铁律，改动前必读）

1. **localStorage 始终是运行时主存储**——同步失败只改状态，绝不阻塞使用。
2. **pull 是唯一的数据合并入口**——信令层不得携带数据（ADR-0008 的核心取舍）。
3. **apiKey 永不上云**——collectAll 跳过该字段；仅存在于本机与导出文件（ADR-0004）。
4. **删除即墓碑**——UI 过滤、同步层保留；导出文件只含活跃数据。
5. **双时间戳不可混用**——rev 管裁决方向、recv_time 管游标完整性（ADR-0002）。
6. **同 id 记录在集合中唯一**——任何复活/替换路径必须剔除旧记录（2026-08 修复的复活覆盖 bug）。
7. **拖拽改序必须重打 revTime**——order 是记录内容的一部分，否则不触发同步（P0 教训）。
8. **「从云端恢复」与「文件导入」不要连用**——都是整体覆盖语义，最后操作说了算；后悔药只有事先导出的备份。

## 关键参数

| 参数 | 值 | 位置 |
|---|---|---|
| 前沿窗口 | 30s | syncManager `PUSH_LEADING_GAP_MS` |
| 后沿节流窗 | 2s | syncManager `PUSH_TRAILING_MS` |
| 兜底间隔 | 5min（SSE 健在 ×6 = 30min） | `PUSH_INTERVAL_MS` / `SSE_FALLBACK_TICKS` |
| keepalive 上限 | 60KB | `KEEPALIVE_MAX_BYTES` |
| pull 页大小 | 500 | `PULL_PAGE`（服务端）/ `PAGE`（客户端） |
| push/pull 限流 | 30/分、60/分 | server/sync.ts `RATE_LIMITS` |
| 票据 TTL | 30s 单次使用 | `TICKET_TTL_MS` |
| 每用户 SSE 连接上限 | 8 | `MAX_CONNS_PER_USER` |
| SSE 心跳 | 25s | `HEARTBEAT_MS` |
