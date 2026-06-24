import { ref, computed } from 'vue'

export interface Todo {
  id: string
  title: string
  description: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  category: 'work' | 'personal' | 'fitness' | 'ideas' | 'shopping' | 'other'
  dueDate?: string // YYYY-MM-DD
  createdAt: string
}

export interface Task {
  id: string
  todoId?: string
  title: string
  description: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  category: 'work' | 'personal' | 'fitness' | 'ideas' | 'shopping' | 'other'
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  createdAt: string
  color?: string
}

export type Category = Todo['category']
export type Priority = Todo['priority']

// Reactive States
const todos = ref<Todo[]>([])
const tasks = ref<Task[]>([])
const loading = ref(false)

// Shared Filters
const searchQuery = ref('')
const selectedCategory = ref<Category | 'all'>('all')
const selectedPriority = ref<Priority | 'all'>('all')
const selectedStatus = ref<'all' | 'active' | 'completed'>('all')
const sortBy = ref<'createdAt' | 'dueDate' | 'priority'>('createdAt')

const saveToLocalStorage = () => {
  localStorage.setItem('antigravity_todos', JSON.stringify(todos.value))
  localStorage.setItem('antigravity_tasks', JSON.stringify(tasks.value))
}

const resetDemoTodos = () => {
  todos.value = [
    {
      id: 'todo-1',
      title: '探索 Antigravity 设计规范',
      description: '探索 Glassmorphism 边框毛玻璃、暗色模式、定制过渡动画',
      completed: false,
      priority: 'high',
      category: 'work',
      createdAt: new Date().toISOString()
    },
    {
      id: 'todo-2',
      title: '每天喝两升水',
      description: '写代码时也要保持水分！',
      completed: false,
      priority: 'low',
      category: 'fitness',
      createdAt: new Date().toISOString()
    },
    {
      id: 'todo-3',
      title: '规划日程与待办分离概念',
      description: '理顺待办池（模板）和日程时间轴（精确到分钟的任务实例）的概念',
      completed: false,
      priority: 'medium',
      category: 'ideas',
      createdAt: new Date().toISOString()
    }
  ]
  localStorage.setItem('antigravity_todos', JSON.stringify(todos.value))
}

const resetDemoTasks = () => {
  tasks.value = [
    {
      id: 'task-1',
      todoId: 'todo-1',
      title: '探索 Antigravity 设计规范',
      description: '探索 Glassmorphism 边框毛玻璃、暗色模式、定制过渡动画',
      completed: false,
      priority: 'high',
      category: 'work',
      date: new Date().toISOString().split('T')[0],
      startTime: '08:30',
      endTime: '10:00',
      color: 'blue',
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-2',
      title: '傍晚去健身房锻炼',
      description: '跑步与拉伸',
      completed: false,
      priority: 'medium',
      category: 'fitness',
      date: new Date().toISOString().split('T')[0],
      startTime: '18:00',
      endTime: '19:30',
      color: 'emerald',
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-3',
      title: 'test',
      description: '测试任务',
      completed: false,
      priority: 'medium',
      category: 'other',
      date: new Date().toISOString().split('T')[0],
      startTime: '11:00',
      endTime: '12:00',
      color: 'rose',
      createdAt: new Date().toISOString()
    }
  ]
  localStorage.setItem('antigravity_tasks', JSON.stringify(tasks.value))
}

// Initial data load from localStorage with fallback demo data
const loadInitialData = () => {
  const savedTodos = localStorage.getItem('antigravity_todos')
  const savedTasks = localStorage.getItem('antigravity_tasks')
  
  if (savedTodos) {
    try {
      const parsed = JSON.parse(savedTodos)
      if (Array.isArray(parsed)) {
        // filter out potentially corrupt elements
        todos.value = parsed.filter(item => item && typeof item === 'object' && 'id' in item && 'title' in item)
      } else {
        throw new Error('Todos is not an array')
      }
    } catch (e) {
      console.error('Failed to parse todos, resetting to fallback data:', e)
      resetDemoTodos()
    }
  } else {
    resetDemoTodos()
  }

  if (savedTasks) {
    try {
      const parsed = JSON.parse(savedTasks)
      if (Array.isArray(parsed)) {
        // filter out potentially corrupt tasks
        tasks.value = parsed.filter(item => item && typeof item === 'object' && 'id' in item && 'title' in item)
        // Ensure specific colors and task-3 exist
        const t1 = tasks.value.find(t => t.id === 'task-1')
        if (t1 && !t1.color) t1.color = 'blue'
        
        const t2 = tasks.value.find(t => t.id === 'task-2')
        if (t2 && !t2.color) t2.color = 'emerald'
        
        if (!tasks.value.some(t => t.id === 'task-3')) {
          tasks.value.push({
            id: 'task-3',
            title: 'test',
            description: '测试任务',
            completed: false,
            priority: 'medium',
            category: 'other',
            date: new Date().toISOString().split('T')[0],
            startTime: '11:00',
            endTime: '12:00',
            color: 'rose',
            createdAt: new Date().toISOString()
          })
        }
        saveToLocalStorage()
      } else {
        throw new Error('Tasks is not an array')
      }
    } catch (e) {
      console.error('Failed to parse tasks, resetting to fallback data:', e)
      resetDemoTasks()
    }
  } else {
    resetDemoTasks()
  }
}

// Initial load
loading.value = true
try {
  loadInitialData()
} catch (e) {
  console.error('Failed to load initial local storage data:', e)
} finally {
  loading.value = false
}

export function useTodos() {
  
  // --- Backlog (Todo) Actions ---
  const addTodo = (todoData: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => {
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title: todoData.title.trim(),
      description: todoData.description || '',
      completed: false,
      priority: todoData.priority || 'medium',
      category: todoData.category || 'other',
      createdAt: new Date().toISOString()
    }
    todos.value.unshift(newTodo)
    saveToLocalStorage()
  }

  const toggleTodo = (id: string) => {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.completed = !todo.completed
      saveToLocalStorage()
    }
  }

  const deleteTodo = (id: string) => {
    todos.value = todos.value.filter(t => t.id !== id)
    // unlink tasks associated with this todo template
    tasks.value = tasks.value.map(t => {
      if (t.todoId === id) {
        return { ...t, todoId: undefined }
      }
      return t
    })
    saveToLocalStorage()
  }

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    const todoIndex = todos.value.findIndex(t => t.id === id)
    if (todoIndex !== -1) {
      todos.value[todoIndex] = { ...todos.value[todoIndex], ...updates }
      saveToLocalStorage()
    }
  }

  // --- Calendar Task Actions ---
  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'completed'>) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: taskData.title.trim(),
      description: taskData.description || '',
      completed: false,
      priority: taskData.priority || 'medium',
      category: taskData.category || 'other',
      date: taskData.date,
      startTime: taskData.startTime,
      endTime: taskData.endTime,
      color: taskData.color || 'violet',
      createdAt: new Date().toISOString()
    }
    tasks.value.unshift(newTask)
    saveToLocalStorage()
  }

  const addTaskFromTodo = (todoId: string, date: string, startTime: string, endTime: string, color?: string) => {
    const originalTodo = todos.value.find(t => t.id === todoId)
    if (!originalTodo) return
    const newTask: Task = {
      id: crypto.randomUUID(),
      todoId,
      title: originalTodo.title,
      description: originalTodo.description,
      completed: false,
      priority: originalTodo.priority,
      category: originalTodo.category,
      date,
      startTime,
      endTime,
      color: color || 'violet',
      createdAt: new Date().toISOString()
    }
    tasks.value.push(newTask)
    saveToLocalStorage()
  }

  const toggleTask = (id: string) => {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      task.completed = !task.completed
      saveToLocalStorage()
    }
  }

  const deleteTask = (id: string) => {
    tasks.value = tasks.value.filter(t => t.id !== id)
    saveToLocalStorage()
  }

  const updateTask = (id: string, updates: Partial<Task>) => {
    const taskIndex = tasks.value.findIndex(t => t.id === id)
    if (taskIndex !== -1) {
      tasks.value[taskIndex] = { ...tasks.value[taskIndex], ...updates }
      saveToLocalStorage()
    }
  }

  // --- Filters ---
  const priorityWeight = { high: 3, medium: 2, low: 1 }

  // Computed: Filtered Todos (for backlog management view)
  const filteredTodos = computed(() => {
    return todos.value
      .filter(todo => {
        const matchesSearch = 
          todo.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          todo.description.toLowerCase().includes(searchQuery.value.toLowerCase())
        
        const matchesCategory = 
          selectedCategory.value === 'all' || 
          todo.category === selectedCategory.value

        const matchesPriority = 
          selectedPriority.value === 'all' || 
          todo.priority === selectedPriority.value

        const matchesStatus = 
          selectedStatus.value === 'all' ||
          (selectedStatus.value === 'completed' && todo.completed) ||
          (selectedStatus.value === 'active' && !todo.completed)

        return matchesSearch && matchesCategory && matchesPriority && matchesStatus
      })
      .sort((a, b) => {
        if (sortBy.value === 'priority') {
          return priorityWeight[b.priority] - priorityWeight[a.priority]
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  })

  // Computed: Stats calculations based on current tasks & todos
  const stats = computed(() => {
    const totalTodos = todos.value.length
    const completedTodos = todos.value.filter(t => t.completed).length
    const activeTodos = totalTodos - completedTodos
    
    const totalTasks = tasks.value.length
    const completedTasks = tasks.value.filter(t => t.completed).length
    const activeTasks = totalTasks - completedTasks
    
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Priority counts for scheduled tasks
    const high = tasks.value.filter(t => t.priority === 'high').length
    const medium = tasks.value.filter(t => t.priority === 'medium').length
    const low = tasks.value.filter(t => t.priority === 'low').length

    // Category counts for scheduled tasks
    const categoriesCount = {
      work: tasks.value.filter(t => t.category === 'work').length,
      personal: tasks.value.filter(t => t.category === 'personal').length,
      fitness: tasks.value.filter(t => t.category === 'fitness').length,
      ideas: tasks.value.filter(t => t.category === 'ideas').length,
      shopping: tasks.value.filter(t => t.category === 'shopping').length,
      other: tasks.value.filter(t => t.category === 'other').length,
    }

    return {
      total: totalTasks,
      completed: completedTasks,
      active: activeTasks,
      completionRate,
      priorities: { high, medium, low },
      categories: categoriesCount,
      backlog: {
        total: totalTodos,
        completed: completedTodos,
        active: activeTodos
      }
    }
  })

  const clearCompleted = () => {
    todos.value = todos.value.filter(t => !t.completed)
    saveToLocalStorage()
  }

  return {
    todos,
    tasks,
    loading,
    searchQuery,
    selectedCategory,
    selectedPriority,
    selectedStatus,
    sortBy,
    filteredTodos,
    stats,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    addTask,
    addTaskFromTodo,
    toggleTask,
    deleteTask,
    updateTask,
    clearCompleted,
    syncData: loadInitialData
  }
}
