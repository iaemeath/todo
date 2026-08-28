/**
 * task store 数据裁决语义单测（node:test）。
 * 覆盖：删除级联（墓碑树）、活跃视图孤儿过滤、同步写入通道 LWW、完成态联动、
 * 叶子身份判定、墓碑任务排期拒绝——这些是「UI 看到什么」与「同步传播什么」的分界线。
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStubs, freshPinia, resetBetweenTests } from './helpers'

installBrowserStubs()

const { useTaskStore } = await import('../src/stores/task')
import type { Task } from '../src/types/bundle'

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

/** 挂一颗三级树：父 → 子 → 孙 */
function seedTree(store: ReturnType<typeof useTaskStore>) {
  store.tasks = [
    mkTask({ id: 'parent', title: '父' }),
    mkTask({ id: 'child', parentId: 'parent', title: '子' }),
    mkTask({ id: 'grandchild', parentId: 'child', title: '孙' }),
    mkTask({ id: 'other', title: '无关任务' })
  ]
  store.schedules = [
    { id: 's-child', taskId: 'child', title: '子的日程', date: '2026-08-28', startTime: '09:00', endTime: '10:00', color: 'blue' },
    { id: 's-other', taskId: 'other', title: '无关日程', date: '2026-08-28', startTime: '11:00', endTime: '12:00', color: 'rose' },
    { id: 's-orphan', title: '独立日程', date: '2026-08-28', startTime: '13:00', endTime: '14:00', color: 'emerald' }
  ]
}

beforeEach(async () => {
  await freshPinia()
})

afterEach(async () => {
  await resetBetweenTests()
})

const byId = (store: ReturnType<typeof useTaskStore>) =>
  Object.fromEntries(store.tasks.map((t) => [t.id, t]))

// ===== deleteTask 级联 =====

test('deleteTask：整棵子树级联打墓碑，关联日程随删，无关记录不动', () => {
  const store = useTaskStore()
  seedTree(store)

  store.deleteTask('parent')

  const t = byId(store)
  for (const id of ['parent', 'child', 'grandchild']) {
    assert.ok(t[id].deletedAt, `${id} 应打墓碑`)
    assert.equal(t[id].revTime, t[id].deletedAt, '墓碑同时重打 revTime（触发同步）')
  }
  assert.ok(!t['other'].deletedAt, '无关任务不受牵连')
  const s = Object.fromEntries(store.schedules.map((x) => [x.id, x]))
  assert.ok(s['s-child'].deletedAt, '被删子树的关联日程墓碑')
  assert.ok(!s['s-other'].deletedAt, '无关任务的日程不动')
  assert.ok(!s['s-orphan'].deletedAt, '独立日程不动')
})

test('deleteTask 幂等：已墓碑的后代保留原 deletedAt，仅 revTime 刷新', () => {
  const store = useTaskStore()
  const oldTomb = 12345
  store.tasks = [
    mkTask({ id: 'parent' }),
    mkTask({ id: 'child', parentId: 'parent', deletedAt: oldTomb, revTime: oldTomb })
  ]

  store.deleteTask('parent')

  const t = byId(store)
  assert.equal(t['child'].deletedAt, oldTomb, '不重复打墓碑（避免制造无谓的上行变更差异）')
  assert.ok((t['child'].revTime ?? 0) > oldTomb, 'revTime 刷新以传播')
  assert.ok(t['parent'].deletedAt)
})

test('活跃视图：父被删后子从 activeTasks 消失（父链完整性过滤），墓碑永不出现', () => {
  const store = useTaskStore()
  seedTree(store)
  assert.deepEqual(store.activeTasks.map((t) => t.id).sort(), ['child', 'grandchild', 'other', 'parent'])

  store.deleteTask('parent')

  // child/grandchild 数据仍在（同步层全集），只是父链断裂后不再展示
  assert.deepEqual(store.activeTasks.map((t) => t.id), ['other'])
  assert.ok(store.tasks.some((t) => t.id === 'child' && t.deletedAt), '墓碑保留在全集里等同步传播')
})

// ===== upsertSynced 同步写入通道（LWW）=====

test('upsertSyncedTask：新记录插入深拷贝；rev 更大覆盖；更小/相等旧值拒绝', () => {
  const store = useTaskStore()
  store.tasks = [mkTask({ id: 'a', title: '本机', revTime: 100 })]

  store.upsertSyncedTask(mkTask({ id: 'brand-new', title: '对端新', revTime: 50 }))
  assert.ok(store.tasks.some((t) => t.id === 'brand-new'))

  store.upsertSyncedTask({ ...store.tasks[0], title: '对端更新', revTime: 200 })
  assert.equal(store.tasks.find((t) => t.id === 'a')?.title, '对端更新', 'rev 更大 → 覆盖')

  store.upsertSyncedTask(mkTask({ id: 'a', title: '对端过期', revTime: 50 }))
  assert.equal(store.tasks.find((t) => t.id === 'a')?.title, '对端更新', 'rev 更小 → 拒绝（LWW 拒旧）')

  // 深拷贝语义：改源对象不影响 store 内记录
  const src = mkTask({ id: 'clone-me', title: '原始', revTime: 1 })
  store.upsertSyncedTask(src)
  src.title = '外部被改'
  assert.equal(store.tasks.find((t) => t.id === 'clone-me')?.title, '原始', 'deepClone 隔离外部引用')
})

// ===== setTaskCompleted 完成态联动 =====

test('完成下推子孙、取消上推祖先，联动记录均重打 revTime', () => {
  const store = useTaskStore()
  seedTree(store)

  store.setTaskCompleted('parent', true)
  const t = byId(store)
  assert.ok(t['parent'].completed && t['child'].completed && t['grandchild'].completed, '完成 → 整棵子树下推')
  assert.ok(!t['other'].completed)
  assert.ok(t['grandchild'].revTime, '联动也 touch（否则不触发同步——P0 教训同源）')

  store.setTaskCompleted('grandchild', false)
  const t2 = byId(store)
  assert.ok(!t2['child'].completed && !t2['parent'].completed, '取消 → 祖先链上推未完成')
  assert.ok(t2['grandchild'].completed === false)
})

// ===== 叶子身份与排期 =====

test('leafTasks：有活跃子节点的父不进待办；子被删后父回归叶子身份', () => {
  const store = useTaskStore()
  store.tasks = [
    mkTask({ id: 'p', title: '父' }),
    mkTask({ id: 'c', parentId: 'p', title: '子' }),
    mkTask({ id: 'solo', title: '独立' })
  ]
  assert.deepEqual(store.leafTasks.map((t) => t.id).sort(), ['c', 'solo'], '父有活跃子 → 不是叶子')

  store.deleteTask('c')
  assert.deepEqual(store.leafTasks.map((t) => t.id).sort(), ['p', 'solo'], '子墓碑后父回归待办')
})

test('addScheduleFromTask：墓碑任务拒绝排期', () => {
  const store = useTaskStore()
  store.tasks = [mkTask({ id: 'dead', title: '已删', deletedAt: 1 })]
  const r = store.addScheduleFromTask('dead', '2026-08-28', '09:00', '10:00')
  assert.equal(r, null)
})
