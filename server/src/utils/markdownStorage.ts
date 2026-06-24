import * as fs from 'fs'
import * as path from 'path'

export interface Todo {
  id: string
  title: string
  description: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  category: 'work' | 'personal' | 'fitness' | 'ideas' | 'shopping' | 'other'
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
}

const FILE_PATH = path.join(__dirname, '../../../todo.md')

// Regex to parse a markdown list item with optional metadata comment
// Examples:
// - [ ] Task Title <!-- {"id":"123","priority":"high"} -->
// - [x] Done Task
const TASK_LINE_REGEXP = /^\s*-\s*\[([ xX])\]\s*(.*?)\s*(?:<!--\s*(\{.*?\})\s*-->)?$/

/**
 * Ensures the todo.md file exists and has default structures.
 */
export function ensureFileExists() {
  if (!fs.existsSync(FILE_PATH)) {
    const defaultContent = `# 待办池 (Backlog Pool)

- [ ] 探索 Antigravity 设计规范 <!-- {"id":"todo-1","priority":"high","category":"work","description":"探索 Glassmorphism 边框毛玻璃、暗色模式、定制过渡动画","createdAt":"2026-06-04T00:00:00.000Z"} -->
- [ ] 每天喝两升水 <!-- {"id":"todo-2","priority":"low","category":"fitness","description":"写代码时也要保持水分！","createdAt":"2026-06-04T00:00:00.000Z"} -->
- [ ] 规划日程与待办分离概念 <!-- {"id":"todo-3","priority":"medium","category":"ideas","description":"理顺待办池（模板）和日程时间轴（精确到分钟的实例）的概念","createdAt":"2026-06-04T00:00:00.000Z"} -->

# 日程任务 (Calendar Tasks)

- [ ] 探索 Antigravity 设计规范 <!-- {"id":"task-1","todoId":"todo-1","title":"探索 Antigravity 设计规范","priority":"high","category":"work","description":"探索 Glassmorphism 边框毛玻璃、暗色模式、定制过渡动画","date":"2026-06-04","startTime":"08:30","endTime":"10:00","createdAt":"2026-06-04T00:00:00.000Z"} -->
- [ ] 傍晚去健身房锻炼 <!-- {"id":"task-2","title":"傍晚去健身房锻炼","priority":"medium","category":"fitness","description":"跑步与拉伸","date":"2026-06-04","startTime":"18:00","endTime":"19:30","createdAt":"2026-06-04T00:00:00.000Z"} -->
`
    fs.writeFileSync(FILE_PATH, defaultContent, 'utf-8')
  }
}

/**
 * Reads and parses todo.md into JSON lists of Todos and Tasks.
 */
export function readData(): { todos: Todo[]; tasks: Task[] } {
  ensureFileExists()
  const content = fs.readFileSync(FILE_PATH, 'utf-8')
  const lines = content.split(/\r?\n/)

  const todos: Todo[] = []
  const tasks: Task[] = []
  
  let currentSection: 'todos' | 'tasks' | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    
    // Detect section headers
    if (trimmed.startsWith('#')) {
      const header = trimmed.replace(/^#+\s*/, '')
      if (header.includes('待办池') || header.includes('Backlog')) {
        currentSection = 'todos'
      } else if (header.includes('日程任务') || header.includes('Calendar')) {
        currentSection = 'tasks'
      } else {
        currentSection = null
      }
      continue
    }

    if (!line.startsWith('-') || !currentSection) {
      continue
    }

    const match = line.match(TASK_LINE_REGEXP)
    if (match) {
      const isCompleted = match[1].toLowerCase() === 'x'
      const title = match[2].trim()
      const metadataStr = match[3]

      let metadata: any = {}
      if (metadataStr) {
        try {
          metadata = JSON.parse(metadataStr)
        } catch (e) {
          console.error(`Failed to parse JSON metadata for line: ${line}`, e)
        }
      }

      if (currentSection === 'todos') {
        todos.push({
          id: metadata.id || crypto.randomUUID(),
          title: title || metadata.title || '未命名待办',
          description: metadata.description || '',
          completed: isCompleted,
          priority: metadata.priority || 'medium',
          category: metadata.category || 'other',
          createdAt: metadata.createdAt || new Date().toISOString()
        })
      } else if (currentSection === 'tasks') {
        tasks.push({
          id: metadata.id || crypto.randomUUID(),
          todoId: metadata.todoId,
          title: title || metadata.title || '未命名任务',
          description: metadata.description || '',
          completed: isCompleted,
          priority: metadata.priority || 'medium',
          category: metadata.category || 'other',
          date: metadata.date || new Date().toISOString().split('T')[0],
          startTime: metadata.startTime || '08:00',
          endTime: metadata.endTime || '09:00',
          createdAt: metadata.createdAt || new Date().toISOString()
        })
      }
    }
  }

  return { todos, tasks }
}

/**
 * Serializes and overwrites todo.md with the latest Todos and Tasks.
 */
export function writeData(todos: Todo[], tasks: Task[]) {
  let output = `# 待办池 (Backlog Pool)\n\n`
  
  for (const todo of todos) {
    const meta = {
      id: todo.id,
      priority: todo.priority,
      category: todo.category,
      description: todo.description,
      createdAt: todo.createdAt
    }
    const check = todo.completed ? 'x' : ' '
    output += `- [${check}] ${todo.title} <!-- ${JSON.stringify(meta)} -->\n`
  }

  output += `\n# 日程任务 (Calendar Tasks)\n\n`

  for (const task of tasks) {
    const meta = {
      id: task.id,
      todoId: task.todoId,
      priority: task.priority,
      category: task.category,
      description: task.description,
      date: task.date,
      startTime: task.startTime,
      endTime: task.endTime,
      createdAt: task.createdAt
    }
    const check = task.completed ? 'x' : ' '
    output += `- [${check}] ${task.title} <!-- ${JSON.stringify(meta)} -->\n`
  }

  fs.writeFileSync(FILE_PATH, output, 'utf-8')
}
