import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'

// ===== Types =====

/**
 * 任务（树形，最多 3 级）。
 * 顶级任务 parentId = null；有子节点的任务不会出现在右侧「待办」中。
 */
export interface Task {
  id: string
  parentId: string | null
  title: string
  description: string
  category: string // work, personal, fitness, ideas, shopping, other
  priority: string // high, medium, low
  completed: boolean
  order: number // 同级排序
}

/**
 * 日程（相对独立的日历事件）。可通过 taskId 关联到一个叶子任务。
 */
export interface Schedule {
  id: string
  taskId?: string // 关联叶子任务；独立日程为空
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  color: string // violet, blue, emerald, amber, rose, cyan
}

// ===== Storage keys =====
const LS_TASKS = 'canvas_tasks'
const LS_SCHEDULES = 'canvas_schedules'
const LS_SCHEMA = 'canvas_schema_version'
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

  // ===== Migration =====
  // 旧数据: canvas_todos(清单) + canvas_tasks(日历事件)
  // 新数据: canvas_tasks(任务树) + canvas_schedules(日历事件)
  // 关键: 旧 canvas_tasks 键装的是日历事件，不能被新任务树直接覆盖读取，
  // 因此用 canvas_schema_version 隔离，先读后写。
  const migrateLegacyData = () => {
    if (typeof window === 'undefined') return
    const oldTodosRaw = localStorage.getItem('canvas_todos') // 旧清单
    const oldEventsRaw = localStorage.getItem('canvas_tasks') // 旧日历事件

    const newTasks: Task[] = oldTodosRaw
      ? (safeParse<any[]>(oldTodosRaw, [])).map((t, i) => ({
        id: t.id,
        parentId: null,
        title: t.title ?? '',
        description: t.description ?? '',
        category: t.category ?? 'other',
        priority: t.priority ?? 'medium',
        completed: !!t.completed,
        order: i
      }))
      : []

    const newSchedules: Schedule[] = oldEventsRaw
      ? (safeParse<any[]>(oldEventsRaw, [])).map((t) => ({
        id: t.id,
        taskId: t.todoId, // 旧 todoId → 新 taskId
        title: t.title ?? '',
        date: t.date ?? '',
        startTime: t.startTime ?? '',
        endTime: t.endTime ?? '',
        color: t.color ?? 'blue'
      }))
      : []

    localStorage.setItem(LS_TASKS, JSON.stringify(newTasks))
    localStorage.setItem(LS_SCHEDULES, JSON.stringify(newSchedules))
    localStorage.removeItem('canvas_todos')
    localStorage.setItem(LS_SCHEMA, '1')
  }

  // ===== Seed (fresh install) =====
  const getTodayDateStr = (offsetDays = 0): string => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return d.toISOString().split('T')[0]
  }

  const seedInitialData = () => {
    const seedTasks: Task[] = [
      { id: 'todo-1', parentId: null, title: '探索 Antigravity 设计规范', description: '研究高颜值暗黑太空玻璃拟物化设计准则', category: 'work', priority: 'high', completed: false, order: 0 },
      { id: 'todo-2', parentId: null, title: '日程系统测试', description: '验证基于 Canvas 的拖动与拉伸调度交互', category: 'ideas', priority: 'medium', completed: false, order: 1 },
      { id: 'todo-3', parentId: null, title: '傍晚去健身房锻炼', description: '做有氧和力量训练，保持健康状态', category: 'fitness', priority: 'low', completed: false, order: 2 },
      { id: 'todo-4', parentId: null, title: '超市采购食材', description: '买一些鸡蛋、牛奶、蔬菜和鸡胸肉', category: 'shopping', priority: 'low', completed: false, order: 3 },
      { id: 'todo-5', parentId: null, title: '重构数据模型', description: '任务树 + 独立日程', category: 'work', priority: 'high', completed: false, order: 4 },
      { id: 'todo-6', parentId: 'todo-5', title: '设计任务树结构', description: '', category: 'work', priority: 'high', completed: false, order: 0 },
      { id: 'todo-7', parentId: 'todo-5', title: '迁移旧数据', description: '', category: 'work', priority: 'medium', completed: false, order: 1 }
    ]

    const todayStr = getTodayDateStr(0)
    const tomorrowStr = getTodayDateStr(1)
    const seedSchedules: Schedule[] = [
      { id: 'task-1', taskId: 'todo-1', title: '探索 Antigravity 设计规范', date: todayStr, startTime: '08:30', endTime: '10:00', color: 'blue' },
      { id: 'task-2', taskId: 'todo-2', title: '日程系统测试', date: todayStr, startTime: '11:00', endTime: '12:15', color: 'rose' },
      { id: 'task-3', taskId: 'todo-3', title: '傍晚去健身房锻炼', date: tomorrowStr, startTime: '18:00', endTime: '19:30', color: 'emerald' }
    ]

    localStorage.setItem(LS_TASKS, JSON.stringify(seedTasks))
    localStorage.setItem(LS_SCHEDULES, JSON.stringify(seedSchedules))
    localStorage.setItem(LS_SCHEMA, '1')

    tasks.value = seedTasks
    schedules.value = seedSchedules
  }

  // ===== Load =====
  const loadFromStorage = () => {
    if (typeof window === 'undefined') return

    // 一次性迁移旧数据
    if (!localStorage.getItem(LS_SCHEMA)) {
      if (localStorage.getItem('canvas_todos') || localStorage.getItem('canvas_tasks')) {
        migrateLegacyData()
      } else {
        seedInitialData()
        return
      }
    }

    const storedTasks = localStorage.getItem(LS_TASKS)
    const storedSchedules = localStorage.getItem(LS_SCHEDULES)

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
