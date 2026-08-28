import { ref, computed, watch, type Ref } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type { Schedule, Task } from '../types/bundle'
import { quadrantOf } from '../constants/quadrant'
import { DEFAULT_SCHEDULE_COLOR } from '../constants/schedule'

// ===== Types =====
// 契约定义在 types/bundle.ts（前后端共享），此处 re-export 保持既有 import 路径兼容
export type { Schedule, Task } from '../types/bundle'

// ===== Storage keys =====
const LS_TASKS = 'canvas_tasks'
const LS_SCHEDULES = 'canvas_schedules'
const MAX_LEVEL = 3

// Generate unique ID
const generateId = (): string => {
  return 'task-' + Math.random().toString(36).substring(2, 9)
}

// 安全解析 localStorage 的 JSON：数据损坏时回退 fallback，避免启动阶段抛异常导致白屏
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    console.error('[taskStore] localStorage 数据解析失败，回退默认值。', e)
    return fallback
  }
}

export const useTaskStore = defineStore('task', () => {
  // ===== State =====
  const tasks = ref<Task[]>([])
  const schedules = ref<Schedule[]>([])

  // ===== Seed (fresh install) =====
  // 本地时区日期（toISOString 是 UTC，凌晨会差一天）
  const getTodayDateStr = (offsetDays = 0): string =>
    dayjs().add(offsetDays, 'day').format('YYYY-MM-DD')

  const seedInitialData = () => {
    // seed 的 order 为各象限内的序号（q1:日程系统测试0 / q2:傍晚0·重构1·设计树2 / q3:超市0 / q4:探索0·编写1）
    const seedTasks: Task[] = [
      { id: 'todo-1', parentId: null, title: '探索玻璃拟态设计规范', description: '研究高颜值暗黑太空玻璃拟物化设计准则', category: 'work', important: false, urgent: false, completed: false, order: 0 },
      { id: 'todo-2', parentId: null, title: '日程系统测试', description: '验证基于 Canvas 的拖动与拉伸调度交互', category: 'ideas', important: true, urgent: true, completed: false, order: 0 },
      { id: 'todo-3', parentId: null, title: '傍晚去健身房锻炼', description: '做有氧和力量训练，保持健康状态', category: 'fitness', important: true, urgent: false, completed: false, order: 0 },
      { id: 'todo-4', parentId: null, title: '超市采购食材', description: '买一些鸡蛋、牛奶、蔬菜和鸡胸肉', category: 'shopping', important: false, urgent: true, completed: false, order: 0 },
      { id: 'todo-5', parentId: null, title: '重构数据模型', description: '任务树 + 独立日程', category: 'work', important: true, urgent: false, completed: false, order: 1 },
      { id: 'todo-6', parentId: 'todo-5', title: '设计任务树结构', description: '', category: 'work', important: true, urgent: false, completed: false, order: 2 },
      { id: 'todo-7', parentId: 'todo-5', title: '编写单元测试', description: '', category: 'work', important: false, urgent: false, completed: false, order: 1 }
    ]

    const todayStr = getTodayDateStr(0)
    const tomorrowStr = getTodayDateStr(1)
    const seedSchedules: Schedule[] = [
      { id: 'task-1', taskId: 'todo-1', title: '探索玻璃拟态设计规范', date: todayStr, startTime: '08:30', endTime: '10:00', color: 'blue', remindMinutes: 10 },
      { id: 'task-2', taskId: 'todo-2', title: '日程系统测试', date: todayStr, startTime: '11:00', endTime: '12:15', color: 'rose', remindMinutes: 0 },
      { id: 'task-3', taskId: 'todo-3', title: '傍晚去健身房锻炼', date: tomorrowStr, startTime: '18:00', endTime: '19:30', color: 'emerald', remindMinutes: 0 }
    ]

    localStorage.setItem(LS_TASKS, JSON.stringify(seedTasks))
    localStorage.setItem(LS_SCHEDULES, JSON.stringify(seedSchedules))

    tasks.value = seedTasks
    schedules.value = seedSchedules
  }

  // ===== Load =====
  const loadFromStorage = () => {
    if (typeof window === 'undefined') return

    const storedTasks = localStorage.getItem(LS_TASKS)
    const storedSchedules = localStorage.getItem(LS_SCHEDULES)

    // 全新安装（无任何数据）→ 种子演示数据
    if (!storedTasks && !storedSchedules) {
      seedInitialData()
      return
    }

    tasks.value = safeParse<Task[]>(storedTasks, [])

    const parsedSchedules = safeParse<Schedule[]>(storedSchedules, [])
    // 过滤掉含 NaN / Infinity 的损坏数据
    schedules.value = parsedSchedules.filter((s: any) => {
      if (!s.startTime || !s.endTime) return false
      const startStr = String(s.startTime)
      const endStr = String(s.endTime)
      if (startStr.includes('NaN') || startStr.includes('Infinity')) return false
      if (endStr.includes('NaN') || endStr.includes('Infinity')) return false
      return true
    })
  }

  // 启动时立即加载
  loadFromStorage()

  // ===== 持久化 watchers =====
  watch(tasks, (v) => localStorage.setItem(LS_TASKS, JSON.stringify(v)), { deep: true })
  watch(schedules, (v) => localStorage.setItem(LS_SCHEDULES, JSON.stringify(v)), { deep: true })

  // ===== 记录级同步基础设施 =====
  // 墓碑记录保留在数组中（同步层需要传播删除语义），UI 只看活跃视图。

  /** 本地修改打点：刷新修订时间并复活（清除墓碑） */
  const touch = (r: { revTime?: number; deletedAt?: number }) => {
    r.revTime = Date.now()
    delete r.deletedAt
  }

  /** 活跃任务 = 未墓碑 且 父链完整（父被删的孤儿随父隐藏，等同步对端记录到达自愈） */
  const activeTasks = computed(() => {
    const alive = new Set(tasks.value.filter((t) => !t.deletedAt).map((t) => t.id))
    return tasks.value.filter((t) => !t.deletedAt && (!t.parentId || alive.has(t.parentId)))
  })

  /** 活跃日程 = 未墓碑 且 关联任务（若有）仍活跃 */
  const activeSchedules = computed(() => {
    const alive = new Set(tasks.value.filter((t) => !t.deletedAt).map((t) => t.id))
    return schedules.value.filter((s) => !s.deletedAt && (!s.taskId || alive.has(s.taskId)))
  })

  /**
   * 同步层写入通道：按 revTime 裁决后覆盖（不走 action——action 会重打本地时间）。
   * 覆盖数组元素保持响应式引用（index 替换）。
   * tasks/schedules 记录结构同构——deepClone/upsert/patch 泛型收敛为单一实现，
   * 改裁决/克隆策略只改一处（历史上三组函数逐字重复，双份维护易改一漏一）。
   */
  const deepClone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

  const upsertSynced = <T extends { id: string; revTime?: number }>(list: Ref<T[]>, item: T) => {
    const idx = list.value.findIndex((x) => x.id === item.id)
    if (idx === -1) list.value.push(deepClone(item))
    else if ((item.revTime || 0) >= (list.value[idx].revTime || 0)) list.value[idx] = deepClone(item)
  }
  const upsertSyncedTask = (t: Task) => upsertSynced(tasks, t)
  const upsertSyncedSchedule = (s: Schedule) => upsertSynced(schedules, s)

  /** 定位合并补丁并打点（updateTask/updateSchedule 共享实现） */
  const patchById = <T extends { id: string; revTime?: number; deletedAt?: number }>(
    list: Ref<T[]>, id: string, updates: Partial<T>
  ) => {
    const idx = list.value.findIndex((x) => x.id === id)
    if (idx !== -1) {
      list.value[idx] = { ...list.value[idx], ...updates }
      touch(list.value[idx])
    }
  }

  // ===== Tree helpers（展示类基于活跃集；遍历类基于全集） =====
  /** 所有祖先（从近到远）——活跃集：墓碑祖先不再参与完成态联动 */
  const getAncestors = (id: string): Task[] => {
    const result: Task[] = []
    let cur = activeTasks.value.find((t) => t.id === id)
    while (cur?.parentId) {
      const parent = activeTasks.value.find((t) => t.id === cur!.parentId)
      if (!parent) break
      result.push(parent)
      cur = parent
    }
    return result
  }

  /** 所有后代——全集：级联删除需要覆盖含墓碑的子树（重复标墓碑幂等无害） */
  const getDescendants = (id: string): Task[] => {
    const result: Task[] = []
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const t of tasks.value) {
        if (t.parentId === cur) {
          result.push(t)
          stack.push(t.id)
        }
      }
    }
    return result
  }

  const getTaskLevel = (id: string): number => getAncestors(id).length + 1

  const canAddChild = (id: string): boolean => getTaskLevel(id) < MAX_LEVEL

  /** 是否为叶子任务（无子节点）——出现在右侧「待办」中（活跃集） */
  const isLeaf = (id: string): boolean => !activeTasks.value.some((t) => t.parentId === id)

  // ===== Getter: 待办 = 所有叶子任务（活跃集） =====
  const leafTasks = computed(() => {
    const parentIds = new Set<string>()
    for (const t of activeTasks.value) if (t.parentId) parentIds.add(t.parentId)
    return activeTasks.value
      .filter((t) => !parentIds.has(t.id))
      .sort((a, b) => a.order - b.order)
  })

  // ===== Task actions =====
  const addTask = (data: Omit<Task, 'id' | 'completed' | 'order' | 'parentId'> & { parentId?: string | null }) => {
    const parentId = data.parentId ?? null
    // order = 象限内序号：新增追加到同象限末尾（活跃集计数）；
    // 后续位置调整的唯一入口 = 矩阵视图面板内拖拽（reconcile 重编号）
    const q = quadrantOf({ important: data.important, urgent: data.urgent })
    const sameQuadrantCount = activeTasks.value.filter(t => quadrantOf(t) === q).length
    const newTask: Task = {
      id: generateId(),
      parentId,
      title: data.title,
      description: data.description,
      category: data.category,
      important: data.important,
      urgent: data.urgent,
      completed: false,
      order: sameQuadrantCount
    }
    touch(newTask)
    tasks.value.push(newTask)
    return newTask
  }

  // 给指定父节点加子任务（受层级上限守卫）
  const addChildTask = (parentId: string, data: Omit<Task, 'id' | 'parentId' | 'completed' | 'order'>) => {
    if (!canAddChild(parentId)) return null
    return addTask({ ...data, parentId })
  }

  const updateTask = (id: string, updates: Partial<Task>) => patchById(tasks, id, updates)

  /**
   * 设置完成状态，自动联动：
   * - 完成 → 下推所有子孙完成（整体完成时子任务理应都完成）
   * - 取消完成 → 上推所有祖先为未完成（子未完成，父不应算完成）
   * 注意：不再「子全完成→父自动完成」。父任务是否完成只由用户手动勾选决定，
   * 这样「未完成/已完成」视图可严格按各任务自身 completed 归类。
   */
  const setTaskCompleted = (id: string, value: boolean) => {
    const task = tasks.value.find((t) => t.id === id)
    if (!task) return
    task.completed = value
    touch(task)

    if (value) {
      for (const d of getDescendants(id)) {
        d.completed = true
        touch(d)
      }
    } else {
      for (const a of getAncestors(id)) {
        a.completed = false
        touch(a)
      }
    }
  }

  // 删除任务：级联标墓碑（子孙 + 关联日程）——记录级同步下删除即墓碑，跨端按 revTime 传播
  const deleteTask = (id: string) => {
    const toDelete = new Set<string>([id])
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const t of tasks.value) {
        if (t.parentId === cur) {
          toDelete.add(t.id)
          stack.push(t.id)
        }
      }
    }
    const now = Date.now()
    for (const t of tasks.value) {
      if (toDelete.has(t.id)) {
        t.deletedAt = t.deletedAt || now
        t.revTime = now
      }
    }
    for (const s of schedules.value) {
      if (s.taskId && toDelete.has(s.taskId) && !s.deletedAt) {
        s.deletedAt = now
        s.revTime = now
      }
    }
  }

  // ===== Schedule actions =====
  const addSchedule = (data: Omit<Schedule, 'id'>) => {
    const newSchedule: Schedule = { ...data, id: generateId() }
    touch(newSchedule)
    schedules.value.push(newSchedule)
    return newSchedule
  }

  const updateSchedule = (id: string, updates: Partial<Schedule>) => patchById(schedules, id, updates)

  const deleteSchedule = (id: string) => {
    const s = schedules.value.find((x) => x.id === id)
    if (s) {
      s.deletedAt = Date.now()
      s.revTime = s.deletedAt
    }
  }

  // 从叶子任务创建日程（排期）——活跃集：墓碑任务不可再排期。
  // description 缺省继承任务描述（日程描述字段本就源自任务场景，屏保任务卡/日历悬浮展示用）
  const addScheduleFromTask = (taskId: string, date: string, startTime: string, endTime: string, color: string = DEFAULT_SCHEDULE_COLOR, description?: string, remindMinutes: number = 0) => {
    const task = activeTasks.value.find((t) => t.id === taskId)
    if (!task) return null
    return addSchedule({ taskId, title: task.title, description: description ?? task.description, date, startTime, endTime, color, remindMinutes })
  }

  return {
    // state（全集：含墓碑，同步层/导入导出用）
    tasks,
    schedules,
    // 活跃视图（UI 消费：过滤墓碑与孤儿）
    activeTasks,
    activeSchedules,
    // getter
    leafTasks,
    // task actions
    addTask,
    addChildTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
    // 同步层写入通道（revTime 裁决，不重打本地时间）
    upsertSyncedTask,
    upsertSyncedSchedule,
    // tree helpers
    getDescendants,
    getTaskLevel,
    canAddChild,
    isLeaf,
    // schedule actions
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addScheduleFromTask
  }
})
