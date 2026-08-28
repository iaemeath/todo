/**
 * syncManager 端到端语义单测（node:test，经公开 API 驱动真实链路）。
 *
 * 覆盖 CLAUDE.md §4「同步与数据语义不变量」中可离线验证的部分：
 * - 推送：首推全量、diff 增量、apiKey 永不上云、服务端拒绝后基线不更新
 * - 拉取：复合游标分页、LWW 合并、settings/meta 脏保护、usage 幂等合并、整轮失败游标不动
 * - 导入：覆盖语义（revTime 重打复活）、差集墓碑、apiKey 回退、墓碑随推送传播
 *
 * 设计取舍：数据裁决语义（push/pull/merge）全量覆盖；推送调度语义（前沿/后沿）用
 * mock timers 走真实 startSync watch 链路覆盖；其余定时器胶水（keepalive 等）不测——
 * 裁决坏了症状是静默丢数据，调度坏了症状是快慢与请求量，风险等级不同。
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  installBrowserStubs,
  fakeLogin,
  freshPinia,
  resetBetweenTests,
  stubFetch,
  pushCalls,
  pullCalls,
  settle,
  type CapturedCall
} from './helpers'

installBrowserStubs()

// 动态 import：必须在 stub 装配之后（见 helpers.ts 头注）
const sm = await import('../src/services/syncManager')
const { useTaskStore, useSettingsStore, useThemeStore, useUsageStore, useUIStore } = await import('../src/stores')
import { defaultSettings, type Task, type Schedule, type ExportBundle } from '../src/types/bundle'

let seq = 0
const mkTask = (over: Partial<Task> = {}): Task => ({
  id: `t-${++seq}`,
  parentId: null,
  title: `任务${seq}`,
  description: '',
  category: 'work',
  important: false,
  urgent: false,
  completed: false,
  order: 0,
  ...over
})
const mkSchedule = (over: Partial<Schedule> = {}): Schedule => ({
  id: `s-${++seq}`,
  title: `日程${seq}`,
  date: '2026-08-28',
  startTime: '09:00',
  endTime: '10:00',
  color: 'blue',
  remindMinutes: 0,
  ...over
})
const mkBundle = (over: Partial<ExportBundle> = {}): ExportBundle => ({
  version: 1,
  exportedAt: '2026-08-28T00:00:00.000Z',
  tasks: [],
  schedules: [],
  settings: freshSettings(),
  theme: { isDark: false },
  usage: [],
  todoVisible: true,
  ...over
})
/** defaultSettings 深拷贝（直接改引用会污染后续用例） */
function freshSettings() {
  return JSON.parse(JSON.stringify(defaultSettings))
}

beforeEach(async () => {
  await freshPinia()
  fakeLogin()
})

afterEach(async () => {
  await resetBetweenTests()
})

const parsePushBody = (c: CapturedCall) => c.body as { changes: { c: string; id: string; data: unknown; rev: number }[] }

// ===== 推送 =====

test('首推全量：tasks/schedules/settings/meta/usage 全集合上行，apiKey 不在其中', async () => {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const usageStore = useUsageStore()
  taskStore.tasks = [mkTask({ id: 't-1' })]
  taskStore.schedules = [mkSchedule({ id: 's-1' })]
  settingsStore.settings.apiKey = 'sk-secret-never-up'
  settingsStore.settings.slotDuration = '00:45:00'
  usageStore.usageHistory = [{ id: 'u-1', date: '2026-08-28', model: 'm', promptTokens: 1, completionTokens: 2, totalTokens: 3 }]

  const calls = stubFetch([
    { match: '/sync/pull', reply: () => ({ records: [], hasMore: false, nextSince: 0, nextSinceId: '', serverNow: 100 }) },
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 100 }) }
  ])
  const ok = await sm.syncNow()
  await settle()

  assert.equal(ok, true)
  const changes = parsePushBody(pushCalls(calls)[0]).changes
  assert.ok(changes.some((c) => c.c === 'tasks' && c.id === 't-1'))
  assert.ok(changes.some((c) => c.c === 'schedules' && c.id === 's-1'))
  assert.ok(changes.some((c) => c.c === 'settings' && c.id === 'slotDuration'))
  assert.ok(changes.some((c) => c.c === 'meta' && c.id === 'theme'))
  assert.ok(changes.some((c) => c.c === 'meta' && c.id === 'todoVisible'))
  assert.ok(changes.some((c) => c.c === 'usage' && c.id === 'u-1'))
  // 铁律：apiKey 永不上云
  assert.ok(!changes.some((c) => c.c === 'settings' && c.id === 'apiKey'))
})

test('diff 增量：推送成功后无变更不再上行，改动一条只推一条', async () => {
  const taskStore = useTaskStore()
  taskStore.tasks = [mkTask({ id: 't-1' }), mkTask({ id: 't-2' })]
  const calls = stubFetch([
    { match: '/sync/pull', reply: () => ({ records: [], hasMore: false, nextSince: 0, nextSinceId: '', serverNow: 100 }) },
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 100 }) }
  ])
  await sm.syncNow()
  await settle()
  assert.equal(pushCalls(calls).length, 1)

  // 无变更的第二次手动同步：push 内部 diff 为空直接返回，不发请求
  await sm.syncNow()
  await settle()
  assert.equal(pushCalls(calls).length, 1)

  // 只改一条 → 只推该条
  taskStore.updateTask('t-1', { title: '改名' })
  await sm.syncNow()
  await settle()
  assert.equal(pushCalls(calls).length, 2)
  const last = parsePushBody(pushCalls(calls)[1]).changes
  assert.equal(last.length, 1)
  assert.equal(last[0].id, 't-1')
})

test('服务端拒绝（对端更新）：被拒条目基线不更新，下轮重推并触发拉取修正', async () => {
  const taskStore = useTaskStore()
  taskStore.tasks = [mkTask({ id: 't-1', title: '本机版', revTime: 100 })]
  let pushCount = 0
  const calls = stubFetch([
    {
      match: '/sync/push',
      reply: () => {
        pushCount++
        return pushCount === 1
          ? { rejected: ['tasks:t-1'], serverNow: 200 } // 对端 rev 更新，拒绝
          : { rejected: [], serverNow: 300 }
      }
    },
    {
      match: '/sync/pull',
      reply: () => ({
        records: [{ c: 'tasks', id: 't-1', data: { ...taskStore.tasks[0], title: '对端版', revTime: 300 }, rev: 300 }],
        hasMore: false,
        nextSince: 0,
        nextSinceId: '',
        serverNow: 200
      })
    }
  ])

  await sm.syncNow()
  await settle()
  // 拒绝 → 立即 pull 修正为对端版
  assert.equal(taskStore.tasks[0].title, '对端版')

  // 拉取应用后基线已对齐 → 再同步无上行（push 内部 diff 为空，不发请求）
  await sm.syncNow()
  await settle()
  assert.equal(pushCalls(calls).length, 1)
  assert.equal(sm.syncState.value, 'synced')
})

test('推送网络失败：syncState 转 offline，不炸不重试（等定时兜底）', async () => {
  useTaskStore().tasks = [mkTask()]
  stubFetch([
    { match: '/sync/push', reply: () => { throw new Error('ECONNREFUSED') } }
  ])
  const ok = await sm.syncNow()
  assert.equal(ok, false)
  assert.equal(sm.syncState.value, 'offline')
})

// ===== 拉取与合并 =====

test('pull 复合游标分页：hasMore 续拉带 (since, sinceId)，拉完游标落 serverNow', async () => {
  useTaskStore().tasks = []
  const calls = stubFetch([
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 1 }) },
    {
      match: '/sync/pull',
      reply: (call) => {
        if (!call.url.includes('since=111')) {
          return {
            records: [{ c: 'tasks', id: 't-1', data: mkTask({ id: 't-1' }), rev: 50 }],
            hasMore: true,
            nextSince: 111,
            nextSinceId: 't-1',
            serverNow: 999 // hasMore 时客户端不落此值
          }
        }
        return {
          records: [{ c: 'tasks', id: 't-2', data: mkTask({ id: 't-2' }), rev: 60 }],
          hasMore: false,
          nextSince: 111,
          nextSinceId: 't-1',
          serverNow: 222
        }
      }
    }
  ])

  await sm.syncNow()
  await settle()
  const pulls = pullCalls(calls)
  assert.equal(pulls.length, 2)
  assert.ok(pulls[1].url.includes('since=111') && pulls[1].url.includes('sinceId=t-1'), '续拉请求应携带复合游标')
  assert.equal(localStorage.getItem('shiguang_sync_cursor'), '222', '整轮拉完才落 serverNow 游标')
  const taskStore = useTaskStore()
  assert.equal(taskStore.tasks.length, 2, '两页记录整轮应用')
})

test('pull LWW 合并：对端新则覆盖、对端旧则保留本机、新记录插入', async () => {
  const taskStore = useTaskStore()
  taskStore.tasks = [
    mkTask({ id: 't-local-newer', title: '本机新', revTime: 300 }),
    mkTask({ id: 't-remote-newer', title: '本机旧', revTime: 100 })
  ]
  stubFetch([
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 1 }) },
    {
      match: '/sync/pull',
      reply: () => ({
        records: [
          { c: 'tasks', id: 't-remote-newer', data: mkTask({ id: 't-remote-newer', title: '对端新', revTime: 200 }), rev: 200 },
          { c: 'tasks', id: 't-local-newer', data: mkTask({ id: 't-local-newer', title: '对端旧', revTime: 50 }), rev: 50 },
          { c: 'tasks', id: 't-brand-new', data: mkTask({ id: 't-brand-new', title: '对端新增', revTime: 150 }), rev: 150 }
        ],
        hasMore: false,
        nextSince: 0,
        nextSinceId: '',
        serverNow: 400
      })
    }
  ])
  await sm.syncNow()
  await settle()

  const byId = Object.fromEntries(taskStore.tasks.map((t) => [t.id, t]))
  assert.equal(byId['t-remote-newer'].title, '对端新', '对端 revTime 更新 → 覆盖')
  assert.equal(byId['t-local-newer'].title, '本机新', '对端 revTime 更旧 → 保留本机（LWW 拒旧）')
  assert.equal(byId['t-brand-new'].title, '对端新增', '新记录插入')
  assert.equal(taskStore.tasks.length, 3)
})

test('settings 脏保护：本机值未被服务端接受（拒绝→基线不对齐）时，pull 的同名字段不覆盖本机', async () => {
  const settingsStore = useSettingsStore()
  settingsStore.settings.slotDuration = '00:15:00' // 本机值
  stubFetch([
    {
      match: '/sync/push',
      reply: () => ({ rejected: ['settings:slotDuration'], serverNow: 1 }) // 对端更新，拒绝 → 该键基线不对齐
    },
    {
      match: '/sync/pull',
      reply: () => ({
        records: [{ c: 'settings', id: 'slotDuration', data: '00:25:00', rev: 999 }], // 对端想覆盖
        hasMore: false,
        nextSince: 0,
        nextSinceId: '',
        serverNow: 400
      })
    }
  ])
  const ok = await sm.syncNow()
  await settle()
  assert.equal(ok, true)
  assert.equal(settingsStore.settings.slotDuration, '00:15:00', '本机脏值不被 clobber，等下轮 diff 上行裁决')
})

test('usage 幂等合并：新记录插入、同 id 忽略、墓碑移除', async () => {
  const usageStore = useUsageStore()
  usageStore.usageHistory = [{ id: 'u-keep', date: 'd', model: 'm', promptTokens: 1, completionTokens: 1, totalTokens: 2 }]
  stubFetch([
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 1 }) },
    {
      match: '/sync/pull',
      reply: () => ({
        records: [
          { c: 'usage', id: 'u-new', data: { id: 'u-new', date: 'd', model: 'm', promptTokens: 2, completionTokens: 2, totalTokens: 4 }, rev: 1 },
          // 同 id 重复推送（对端旧版）：忽略不重复
          { c: 'usage', id: 'u-keep', data: { id: 'u-keep', date: 'other', model: 'x', promptTokens: 9, completionTokens: 9, totalTokens: 18 }, rev: 1 },
          { c: 'usage', id: 'u-gone', data: { deleted: true }, rev: 2 }
        ],
        hasMore: false,
        nextSince: 0,
        nextSinceId: '',
        serverNow: 400
      })
    }
  ])
  await sm.syncNow()
  await settle()
  const ids = usageStore.usageHistory.map((u) => u.id)
  assert.ok(ids.includes('u-new'))
  assert.ok(!ids.includes('u-gone'))
  const keep = usageStore.usageHistory.find((u) => u.id === 'u-keep')
  assert.equal(keep?.model, 'm', '已存在的 usage 按 id 幂等，不被对端覆盖')
})

test('pull 中途失败：整轮作废游标不动、记录不应用（幂等重拉无损耗）', async () => {
  localStorage.setItem('shiguang_sync_cursor', '77')
  const taskStore = useTaskStore()
  taskStore.tasks = []
  stubFetch([
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 1 }) },
    {
      match: '/sync/pull',
      reply: (call) => {
        if (!call.url.includes('since=111')) {
          return { records: [{ c: 'tasks', id: 't-1', data: mkTask({ id: 't-1' }), rev: 1 }], hasMore: true, nextSince: 111, nextSinceId: 't-1', serverNow: 1 }
        }
        throw new Error('网络中断') // 第二页失败
      }
    }
  ])
  await sm.syncNow()
  await settle()
  assert.equal(localStorage.getItem('shiguang_sync_cursor'), '77', '游标保持旧值')
  assert.equal(taskStore.tasks.length, 0, '整轮未应用')
})

// ===== 云端恢复（force 整体覆盖）=====

test('restoreFromCloud：tasks/schedules 整体替换（含墓碑），meta 应用，apiKey 因不上云而不丢', async () => {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const uiStore = useUIStore()
  taskStore.tasks = [
    mkTask({ id: 't-local-only', title: '仅本机' }), // 云端没有 → force 后应消失
    mkTask({ id: 't-both', title: '本机版', revTime: 100 })
  ]
  taskStore.schedules = [mkSchedule({ id: 's-local-only' })]
  settingsStore.settings.apiKey = 'sk-local-key'
  themeStore.isDark = false
  uiStore.setTodoVisible(true)

  stubFetch([
    {
      match: '/sync/pull',
      reply: () => ({
        records: [
          { c: 'tasks', id: 't-both', data: mkTask({ id: 't-both', title: '云端版', revTime: 50, completed: false }), rev: 50 }, // rev 更旧也覆盖
          { c: 'tasks', id: 't-tomb', data: { ...mkTask({ id: 't-tomb' }), deletedAt: 1 }, rev: 40 }, // 墓碑也是记录
          { c: 'schedules', id: 's-cloud', data: mkSchedule({ id: 's-cloud' }), rev: 60 },
          { c: 'meta', id: 'theme', data: true, rev: 60 },
          { c: 'meta', id: 'todoVisible', data: false, rev: 60 }
        ],
        hasMore: false,
        nextSince: 0,
        nextSinceId: '',
        serverNow: 500
      })
    }
  ])

  const ok = await sm.restoreFromCloud()
  await settle()
  assert.equal(ok, true)
  const ids = taskStore.tasks.map((t) => t.id).sort()
  assert.deepEqual(ids, ['t-both', 't-tomb'], '整体替换：本机独有消失、云端墓碑保留（同步层全集）')
  assert.equal(taskStore.tasks.find((t) => t.id === 't-both')?.title, '云端版', 'force 无视 LWW')
  assert.deepEqual(taskStore.schedules.map((s) => s.id), ['s-cloud'])
  assert.equal(themeStore.isDark, true, 'meta clean 路径应用')
  assert.equal(uiStore.todoVisible, false)
  assert.equal(settingsStore.settings.apiKey, 'sk-local-key', 'apiKey 不上云 → 云端恢复也不丢')
})

// ===== 文件导入（importBundle 覆盖语义）=====

test('importBundle：包内复活+差集墓碑+已墓碑不重打+apiKey 双路', async () => {
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()
  const oldTombTime = 12345
  taskStore.tasks = [
    mkTask({ id: 't-only-local', title: '包里没有的活跃记录' }), // → 差集墓碑
    mkTask({ id: 't-in-bundle', title: '包里有，会复活', deletedAt: 1, revTime: 9 }), // → 复活
    mkTask({ id: 't-stay-tomb', title: '包里没有的墓碑', deletedAt: oldTombTime, revTime: 9 }), // → 幂等不重打
    mkTask({ id: 't-replaced', title: '被包覆盖', revTime: 5 })
  ]
  taskStore.schedules = [mkSchedule({ id: 's-only-local' })]
  settingsStore.settings.apiKey = 'sk-local'

  // 场景 1：包内无 apiKey → 回退本机现值
  sm.importBundle(mkBundle({
    tasks: [mkTask({ id: 't-in-bundle', title: '复活后标题' }), mkTask({ id: 't-replaced', title: '包内新版' })],
    schedules: [],
    theme: { isDark: true },
    usage: [{ id: 'u-1', date: 'd', model: 'm', promptTokens: 1, completionTokens: 1, totalTokens: 2 }],
    todoVisible: false
  }))

  const byId = Object.fromEntries(taskStore.tasks.map((t) => [t.id, t]))
  assert.ok(byId['t-only-local'].deletedAt, '差集墓碑：本机活跃而包内无 → 打墓碑')
  assert.equal(byId['t-in-bundle'].deletedAt, undefined, '包内记录复活（清墓碑）')
  assert.equal(byId['t-in-bundle'].title, '复活后标题')
  assert.ok((byId['t-in-bundle'].revTime ?? 0) > 9, '复活重打 revTime=now（作为新修订上行）')
  assert.equal(byId['t-stay-tomb'].deletedAt, oldTombTime, '已墓碑且包内无 → 不重打（避免无谓上行）')
  assert.equal(byId['t-replaced'].title, '包内新版')
  assert.equal(taskStore.schedules.length, 1)
  assert.ok(taskStore.schedules[0].deletedAt, '包内空 → 本机日程差集墓碑')
  assert.equal(settingsStore.settings.apiKey, 'sk-local', '旧备份无 key → 回退本机现值')
  assert.equal(useThemeStore().isDark, true)
  assert.equal(useUIStore().todoVisible, false)

  // 场景 2：包内有 apiKey → 随备份覆盖
  sm.importBundle(mkBundle({ settings: { ...freshSettings(), apiKey: 'sk-from-backup' } }))
  assert.equal(useSettingsStore().settings.apiKey, 'sk-from-backup', 'apiKey 随备份导入')
})

test('importBundle 后立即同步：墓碑随推送传播（删除跨端语义闭环）', async () => {
  const taskStore = useTaskStore()
  taskStore.tasks = [mkTask({ id: 't-doomed', title: '将被导入覆盖删除' })]
  const calls = stubFetch([
    { match: '/sync/pull', reply: () => ({ records: [], hasMore: false, nextSince: 0, nextSinceId: '', serverNow: 100 }) },
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 100 }) }
  ])

  sm.importBundle(mkBundle({ tasks: [mkTask({ id: 't-fresh', title: '包内新世界' })], schedules: [] }))
  await sm.syncNow()
  await settle()

  const changes = parsePushBody(pushCalls(calls)[0]).changes
  const doomed = changes.find((c) => c.id === 't-doomed')
  assert.ok(doomed, '墓碑记录随全量推送上行')
  const data = doomed!.data as { deletedAt?: number }
  assert.ok(data.deletedAt, '墓碑标记在推送数据中（对端据此删除）')
})

// ===== 推送调度：前沿立即 + 后沿微批（mock timers 走真实 startSync watch 链路） =====

/** 真实异步冲刷（setImmediate 未被 mock）：让 stub fetch 的 promise 链跑完 */
const flushAsync = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r))
}

/** 启动同步并冲掉启动期全量推拉（mock timers 环境：tick + setImmediate 冲刷） */
async function startSyncAndFlush(t: import('node:test').TestContext, routes: Parameters<typeof stubFetch>[0]) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  const calls = stubFetch(routes)
  sm.startSync()
  t.mock.timers.tick(1)
  await flushAsync()
  return calls
}

test('前沿立即推：距上次成功推送超 30s 的变更立即上云，不等防抖', async (t) => {
  const calls = await startSyncAndFlush(t, [
    { match: '/sync/pull', reply: () => ({ records: [], hasMore: false, nextSince: 0, nextSinceId: '', serverNow: 1 }) },
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 1 }) }
  ])
  const base = pushCalls(calls).length
  t.mock.timers.tick(31_000) // 拉开前沿窗口（Date 同被 mock，lastPushedAt 距今 >30s）
  await flushAsync()

  useTaskStore().tasks = [...useTaskStore().tasks, mkTask({ id: 't-lead' })]
  await flushAsync() // 只冲微任务，未推进任何定时器
  assert.equal(pushCalls(calls).length, base + 1, '变更后立即推送（零定时器等待）')
  sm.stopSync()
})

test('后沿微批：刚推过时的变更进 2s 节流窗，窗内多次变更合并为一次推送', async (t) => {
  const calls = await startSyncAndFlush(t, [
    { match: '/sync/pull', reply: () => ({ records: [], hasMore: false, nextSince: 0, nextSinceId: '', serverNow: 1 }) },
    { match: '/sync/push', reply: () => ({ rejected: [], serverNow: 1 }) }
  ])
  const base = pushCalls(calls).length
  const ts = useTaskStore()

  ts.tasks = [...ts.tasks, mkTask({ id: 't-b1' })] // 距始次推送 <30s → 后沿窗
  t.mock.timers.tick(500)
  await flushAsync()
  ts.tasks = [...ts.tasks, mkTask({ id: 't-b2' })] // 窗内第二次变更 → 合并
  await flushAsync()
  assert.equal(pushCalls(calls).length, base, '节流窗内不发请求')

  t.mock.timers.tick(2_000)
  await flushAsync()
  assert.equal(pushCalls(calls).length, base + 1, '窗到期只推一次')
  const ids = parsePushBody(pushCalls(calls).at(-1)!).changes.map((c) => c.id)
  assert.ok(ids.includes('t-b1') && ids.includes('t-b2'), '两次变更合并在同一次推送里')
  sm.stopSync()
})
