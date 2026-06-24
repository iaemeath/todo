import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { readData, writeData, Todo, Task } from './utils/markdownStorage'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// 1. Get all Todos and Tasks
app.get('/api/data', (req, res) => {
  try {
    const data = readData()
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 2. Add a Todo (Backlog item)
app.post('/api/todos', (req, res) => {
  try {
    const { title, description, priority, category } = req.body
    if (!title) {
      return res.status(400).json({ error: 'Title is required' })
    }

    const { todos, tasks } = readData()
    const newTodo: Todo = {
      id: randomUUID(),
      title: title.trim(),
      description: description || '',
      completed: false,
      priority: priority || 'medium',
      category: category || 'other',
      createdAt: new Date().toISOString()
    }

    todos.unshift(newTodo)
    writeData(todos, tasks)
    res.status(201).json(newTodo)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 3. Update a Todo
app.put('/api/todos/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const { todos, tasks } = readData()
    const todoIndex = todos.findIndex(t => t.id === id)
    if (todoIndex === -1) {
      return res.status(404).json({ error: 'Todo not found' })
    }

    const updatedTodo = {
      ...todos[todoIndex],
      ...updates
    }
    todos[todoIndex] = updatedTodo

    writeData(todos, tasks)
    res.json(updatedTodo)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 4. Delete a Todo
app.delete('/api/todos/:id', (req, res) => {
  try {
    const { id } = req.params
    const { todos, tasks } = readData()
    
    const filteredTodos = todos.filter(t => t.id !== id)
    // Optional: We can also keep or delete tasks linked to this todo, let's keep them but remove todoId link
    const updatedTasks = tasks.map(t => {
      if (t.todoId === id) {
        return { ...t, todoId: undefined }
      }
      return t
    })

    writeData(filteredTodos, updatedTasks)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 5. Add a Task directly to calendar
app.post('/api/tasks', (req, res) => {
  try {
    const { title, description, priority, category, date, startTime, endTime } = req.body
    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, date, startTime, and endTime are required' })
    }

    const { todos, tasks } = readData()
    const newTask: Task = {
      id: randomUUID(),
      title: title.trim(),
      description: description || '',
      completed: false,
      priority: priority || 'medium',
      category: category || 'other',
      date,
      startTime,
      endTime,
      createdAt: new Date().toISOString()
    }

    tasks.unshift(newTask)
    writeData(todos, tasks)
    res.status(201).json(newTask)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 6. Spawn a Task from an existing Todo backlog item
app.post('/api/tasks/from-todo', (req, res) => {
  try {
    const { todoId, date, startTime, endTime } = req.body
    if (!todoId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'todoId, date, startTime, and endTime are required' })
    }

    const { todos, tasks } = readData()
    const originalTodo = todos.find(t => t.id === todoId)
    if (!originalTodo) {
      return res.status(404).json({ error: 'Original Todo template not found' })
    }

    const newTask: Task = {
      id: randomUUID(),
      todoId,
      title: originalTodo.title,
      description: originalTodo.description,
      completed: false,
      priority: originalTodo.priority,
      category: originalTodo.category,
      date,
      startTime,
      endTime,
      createdAt: new Date().toISOString()
    }

    tasks.push(newTask)
    writeData(todos, tasks)
    res.status(201).json(newTask)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 7. Update a Task
app.put('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const { todos, tasks } = readData()
    const taskIndex = tasks.findIndex(t => t.id === id)
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const updatedTask = {
      ...tasks[taskIndex],
      ...updates
    }
    tasks[taskIndex] = updatedTask

    writeData(todos, tasks)
    res.json(updatedTask)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 8. Delete a Task
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params
    const { todos, tasks } = readData()
    
    const filteredTasks = tasks.filter(t => t.id !== id)
    writeData(todos, filteredTasks)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
