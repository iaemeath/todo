import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type { Schedule, Task } from '../types/bundle'

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
    const seedTasks: Task[] = [
      { id: 'todo-1', parentId: null, title: '探索玻璃拟态设计规范', description: '研究高颜值暗黑太空玻璃拟物化设计准则', category: 'work', priority: 'high', completed: false, order: 0 },
      { id: 'todo-2', parentId: null, title: '日程系统测试', description: '验证基于 Canvas 的拖动与拉伸调度交互', category: 'ideas', priority: 'medium', completed: false, order: 1 },
      { id: 'todo-3', parentId: null, title: '傍晚去健身房锻炼', description: '做有氧和力量训练，保持健康状态', category: 'fitness', priority: 'low', completed: false, order: 2 },
      { id: 'todo-4', parentId: null, title: '超市采购食材', description: '买一些鸡蛋、牛奶、蔬菜和鸡胸肉', category: 'shopping', priority: 'low', completed: false, order: 3 },
      { id: 'todo-5', parentId: null, title: '重构数据模型', description: '任务树 + 独立日程', category: 'work', priority: 'high', completed: false, order: 4 },
      { id: 'todo-6', parentId: 'todo-5', title: '设计任务树结构', description: '', category: 'work', priority: 'high', completed: false, order: 0 },
      { id: 'todo-7', parentId: 'todo-5', title: '编写单元测试', description: '', category: 'work', priority: 'medium', completed: false, order: 1 }
    ]

    const todayStr = getTodayDateStr(0)
    const tomorrowStr = getTodayDateStr(1)
    const seedSchedules: Schedule[] = [
      { id: 'task-1', taskId: 'todo-1', title: '探索玻璃拟态设计规范', date: todayStr, startTime: '08:30', endTime: '10:00', color: 'blue' },
      { id: 'task-2', taskId: 'todo-2', title: '日程系统测试', date: todayStr, startTime: '11:00', endTime: '12:15', color: 'rose' },
      { id: 'task-3', taskId: 'todo-3', title: '傍晚去健身房锻炼', date: tomorrowStr, startTime: '18:00', endTime: '19:30', color: 'emerald' }
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

  // ===== Tree helpers =====
  const getChildren = (parentId: string | null): Task[] =>
    tasks.value.filter((t) => t.parentId === parentId).sort((a, b) => a.order - b.order)

  /** 所有祖先（从近到远） */
  const getAncestors = (id: string): Task[] => {
    const result: Task[] = []
    let cur = tasks.value.find((t) => t.id === id)
    while (cur?.parentId) {
      const parent = tasks.value.find((t) => t.id === cur!.parentId)
      if (!parent) break
      result.push(parent)
      cur = parent
    }
    return result
  }

  /** 所有后代 */
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

  /** 是否为叶子任务（无子节点）——出现在右侧「待办」中 */
  const isLeaf = (id: string): boolean => !tasks.value.some((t) => t.parentId === id)

  // ===== Getter: 待办 = 所有叶子任务 =====
  const leafTasks = computed(() => {
    const parentIds = new Set<string>()
    for (const t of tasks.value) if (t.parentId) parentIds.add(t.parentId)
    return tasks.value
      .filter((t) => !parentIds.has(t.id))
      .sort((a, b) => a.order - b.order)
  })

  // ===== Task actions =====
  const addTask = (data: Omit<Task, 'id' | 'completed' | 'order' | 'parentId'> & { parentId?: string | null }) => {
    const parentId = data.parentId ?? null
    const siblings = getChildren(parentId)
    const newTask: Task = {
      id: generateId(),
      parentId,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      completed: false,
      order: siblings.length
    }
    tasks.value.push(newTask)
    return newTask
  }

  // 给指定父节点加子任务（受层级上限守卫）
  const addChildTask = (parentId: string, data: Omit<Task, 'id' | 'parentId' | 'completed' | 'order'>) => {
    if (!canAddChild(parentId)) return null
    return addTask({ ...data, parentId })
  }

  const updateTask = (id: string, updates: Partial<Task>) => {
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...updates }
    }
  }

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

    if (value) {
      for (const d of getDescendants(id)) d.completed = true
    } else {
      for (const a of getAncestors(id)) a.completed = false
    }
  }

  // 删除任务：级联删除子孙 + 关联日程
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
    tasks.value = tasks.value.filter((t) => !toDelete.has(t.id))
    schedules.value = schedules.value.filter((s) => !s.taskId || !toDelete.has(s.taskId))
  }

  // ===== Schedule actions =====
  const addSchedule = (data: Omit<Schedule, 'id'>) => {
    const newSchedule: Schedule = { ...data, id: generateId() }
    schedules.value.push(newSchedule)
    return newSchedule
  }

  const updateSchedule = (id: string, updates: Partial<Schedule>) => {
    const idx = schedules.value.findIndex((s) => s.id === id)
    if (idx !== -1) {
      schedules.value[idx] = { ...schedules.value[idx], ...updates }
    }
  }

  const deleteSchedule = (id: string) => {
    schedules.value = schedules.value.filter((s) => s.id !== id)
  }

  // 从叶子任务创建日程（排期）
  const addScheduleFromTask = (taskId: string, date: string, startTime: string, endTime: string, color = 'blue') => {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return null
    return addSchedule({ taskId, title: task.title, date, startTime, endTime, color })
  }

  return {
    // state
    tasks,
    schedules,
    // getter
    leafTasks,
    // task actions
    addTask,
    addChildTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
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
