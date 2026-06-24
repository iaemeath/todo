import { ref, watch } from 'vue'

export interface Todo {
  id: string
  title: string
  description: string
  category: string // work, personal, fitness, ideas, shopping, other
  priority: string // high, medium, low
  completed: boolean
}

export interface Task {
  id: string
  todoId?: string
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  color: string // violet, blue, emerald, amber, rose, cyan
}

const LOCAL_STORAGE_TODOS = 'canvas_todos'
const LOCAL_STORAGE_TASKS = 'canvas_tasks'

// --- Helper Utilities ---
export const timeStrToMins = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export const minsToTimeStr = (mins: number): string => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Generate unique ID
export const generateId = (): string => {
  return 'task-' + Math.random().toString(36).substring(2, 9)
}

// State refs
const todos = ref<Todo[]>([])
const tasks = ref<Task[]>([])

// --- Initial Seed Data ---
const getTodayDateStr = (offsetDays = 0): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const seedInitialData = () => {
  const initialTodos: Todo[] = [
    {
      id: 'todo-1',
      title: '探索 Antigravity 设计规范',
      description: '研究高颜值暗黑太空玻璃拟物化设计准则',
      category: 'work',
      priority: 'high',
      completed: false
    },
    {
      id: 'todo-2',
      title: '日程系统测试',
      description: '验证基于 Canvas (Konva.js) 的拖动与拉伸调度交互',
      category: 'ideas',
      priority: 'medium',
      completed: false
    },
    {
      id: 'todo-3',
      title: '傍晚去健身房锻炼',
      description: '做有氧和力量训练，保持健康状态',
      category: 'fitness',
      priority: 'low',
      completed: false
    },
    {
      id: 'todo-4',
      title: '超市采购食材',
      description: '买一些鸡蛋、牛奶、蔬菜和鸡胸肉',
      category: 'shopping',
      priority: 'low',
      completed: false
    }
  ]

  const todayStr = getTodayDateStr(0)
  const tomorrowStr = getTodayDateStr(1)

  const initialTasks: Task[] = [
    {
      id: 'task-1',
      todoId: 'todo-1',
      title: '探索 Antigravity 设计规范',
      date: todayStr,
      startTime: '08:30',
      endTime: '10:00',
      color: 'blue'
    },
    {
      id: 'task-2',
      todoId: 'todo-2',
      title: '日程系统测试',
      date: todayStr,
      startTime: '11:00',
      endTime: '12:15',
      color: 'rose'
    },
    {
      id: 'task-3',
      todoId: 'todo-3',
      title: '傍晚去健身房锻炼',
      date: tomorrowStr,
      startTime: '18:00',
      endTime: '19:30',
      color: 'emerald'
    }
  ]

  localStorage.setItem(LOCAL_STORAGE_TODOS, JSON.stringify(initialTodos))
  localStorage.setItem(LOCAL_STORAGE_TASKS, JSON.stringify(initialTasks))

  todos.value = initialTodos
  tasks.value = initialTasks
}

// --- Load Data ---
const loadFromStorage = () => {
  if (typeof window === 'undefined') return

  const storedTodos = localStorage.getItem(LOCAL_STORAGE_TODOS)
  const storedTasks = localStorage.getItem(LOCAL_STORAGE_TASKS)

  if (!storedTodos && !storedTasks) {
    seedInitialData()
  } else {
    todos.value = storedTodos ? JSON.parse(storedTodos) : []
    const parsedTasks = storedTasks ? JSON.parse(storedTasks) : []
    // Filter out corrupted task data containing NaN or Infinity values
    tasks.value = parsedTasks.filter((t: any) => {
      if (!t.startTime || !t.endTime) return false
      const startStr = String(t.startTime)
      const endStr = String(t.endTime)
      if (startStr.includes('NaN') || startStr.includes('Infinity')) return false
      if (endStr.includes('NaN') || endStr.includes('Infinity')) return false
      return true
    })
  }
}

// Load data immediately on boot
loadFromStorage()

// --- Save Watchers ---
watch(todos, (newTodos) => {
  localStorage.setItem(LOCAL_STORAGE_TODOS, JSON.stringify(newTodos))
}, { deep: true })

watch(tasks, (newTasks) => {
  localStorage.setItem(LOCAL_STORAGE_TASKS, JSON.stringify(newTasks))
}, { deep: true })

// --- State Composable ---
export function useTodos() {
  // --- Todo Actions ---
  const addTodo = (todoData: Omit<Todo, 'id' | 'completed'>) => {
    const newTodo: Todo = {
      ...todoData,
      id: generateId(),
      completed: false
    }
    todos.value.push(newTodo)
    return newTodo
  }

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      todos.value[idx] = { ...todos.value[idx], ...updates }
    }
  }

  const deleteTodo = (id: string) => {
    todos.value = todos.value.filter(t => t.id !== id)
    // Optional: Delete all associated tasks
    tasks.value = tasks.value.filter(t => t.todoId !== id)
  }

  // --- Task Actions ---
  const addTask = (taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...taskData,
      id: generateId()
    }
    tasks.value.push(newTask)
    return newTask
  }

  const updateTask = (id: string, updates: Partial<Task>) => {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...updates }
    }
  }

  const deleteTask = (id: string) => {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  // Create a timed task from a todo template directly
  const addTaskFromTodo = (todoId: string, date: string, startTime: string, endTime: string, color = 'blue') => {
    const todo = todos.value.find(t => t.id === todoId)
    if (!todo) return null

    return addTask({
      todoId,
      title: todo.title,
      date,
      startTime,
      endTime,
      color
    })
  }

  return {
    todos,
    tasks,
    addTodo,
    updateTodo,
    deleteTodo,
    addTask,
    updateTask,
    deleteTask,
    addTaskFromTodo
  }
}
