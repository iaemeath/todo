# 0006. pull 复合游标分页：(recv_time, record_id)

- **状态**：已采纳
- **决策时间**：2026-08 下旬（回填记录，关联提交 b5ba422）
- **关联**：server/sync.ts pull 路由、src/services/syncManager.ts（pull 分页循环）

## 背景

push 整批变更共用同一 `recv_time`（服务端时钟同毫秒），形成大平局组。
仅按 `recv_time > since` 翻页时，页尾落在平局组中间会**原地踏步死循环**；
而用 `>=` 又会重拉边界记录。

## 决定

复合游标 `(recv_time, record_id)`：查询条件
`recv_time > since OR (recv_time = since AND record_id > sinceId)`，组内按 record_id 稳定推进。
`LIMIT n+1` 探针判定 hasMore；客户端**整轮拉完才一次性应用**，
仅 `hasMore=false` 时以响应 serverNow 落游标；中途失败整轮作废从旧游标重拉（幂等无损耗）。

## 后果

- (+) 平局组正确翻页；重拉边界记录由客户端 revTime 幂等合并消化。
- (+) "整轮应用"语义让 force（云端恢复）能看到全集，失败无半套状态。
- (-) 客户端必须维护双游标参数；游标协议成为前后端共享契约（改动需两端同步）。

## 被否决的备选

- **push 逐条打独立 recv_time**：改动服务端写入路径，且高并发下时钟分辨率仍可能平局。
- **拉全量不分页**：数据量线性增长，一次性灌爆响应与客户端内存。
