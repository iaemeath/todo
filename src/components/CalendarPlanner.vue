<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodos } from '../composables/useTodos'
import type { Todo } from '../composables/useTodos'
import TodoItem from './TodoItem.vue'
import { Inbox, Plus, Clock, X } from 'lucide-vue-next'

const { todos, tasks, addTaskFromTodo } = useTodos()

// --- State for Planning Modal & Popover (spawning task from backlog) ---
const showPlanModal = ref(false)
const planningTodo = ref<Todo | null>(null)
const planDate = ref(new Date().toISOString().split('T')[0])
const planStartTime = ref('09:00')
const planEndTime = ref('10:00')
const selectedTodoId = ref('')
const planColor = ref('violet')

const colorsList = [
  { value: 'violet', label: '紫色', class: 'color-violet' },
  { value: 'blue', label: '蓝色', class: 'color-blue' },
  { value: 'emerald', label: '绿色', class: 'color-emerald' },
  { value: 'amber', label: '黄色', class: 'color-amber' },
  { value: 'rose', label: '红色', class: 'color-rose' },
  { value: 'cyan', label: '青色', class: 'color-cyan' }
]

const planPopoverTop = ref(0)
const planPopoverLeft = ref(0)

// --- Drag and Drop State ---
const draggingTaskId = ref<string | null>(null)
const dragTempDate = ref('')
const dragTempStart = ref('')
const dragTempEnd = ref('')

let dragStartX = 0
let dragStartY = 0
let dragInitialLeft = 0
let dragInitialTop = 0
let dragDurationMins = 0
let dragClickOffsetY = 0
let columnsBounds: { date: string; scrollLeft: number; width: number; top: number; height: number }[] = []

let dragCardEl: HTMLElement | null = null
let originalCardEl: HTMLElement | null = null
let dragScrollContainer: HTMLElement | null = null
let rafId: number | null = null
let lastMouseEvt: MouseEvent | null = null

const timeStrToMins = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

const minsToTimeStr = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const openPlanModal = (todo: Todo, event: MouseEvent) => {
  planningTodo.value = todo
  planDate.value = new Date().toISOString().split('T')[0]
  planStartTime.value = '09:00'
  planEndTime.value = '10:00'
  planColor.value = 'violet'
  
  // Calculate element screen position for popover
  const btn = event.currentTarget as HTMLElement
  if (btn) {
    const rect = btn.getBoundingClientRect()
    planPopoverTop.value = rect.top - 10
    planPopoverLeft.value = rect.left - 340 // Width of form (320px) + 20px offset
  }
  showPlanModal.value = true
}

const openGridAddModal = (date: string, time: string) => {
  planningTodo.value = null // Means we use dropdown select template
  selectedTodoId.value = ''
  planDate.value = date
  planStartTime.value = time
  planColor.value = 'violet'
  // Default end time to 1 hour later
  const hour = parseInt(time.split(':')[0])
  const nextHour = Math.min(hour + 1, 24)
  planEndTime.value = `${String(nextHour).padStart(2, '0')}:00`
  showPlanModal.value = true
}

const submitPlanModal = async () => {
  let todoId = ''
  if (planningTodo.value) {
    todoId = planningTodo.value.id
  } else {
    todoId = selectedTodoId.value
  }

  if (!todoId || !planDate.value || !planStartTime.value || !planEndTime.value) return
  await addTaskFromTodo(todoId, planDate.value, planStartTime.value, planEndTime.value, planColor.value)
  
  showPlanModal.value = false
  planningTodo.value = null
  selectedTodoId.value = ''
}

const handleAutoScroll = (event: MouseEvent) => {
  if (!dragScrollContainer) return
  
  const scrollRect = dragScrollContainer.getBoundingClientRect()
  const mouseX = event.clientX
  const mouseY = event.clientY
  
  const edgeSize = 50
  const maxScrollSpeed = 15 // pixels per frame
  
  let scrollSpeedX = 0
  let scrollSpeedY = 0
  
  if (mouseX < scrollRect.left + edgeSize) {
    const intensity = (scrollRect.left + edgeSize - mouseX) / edgeSize
    scrollSpeedX = -maxScrollSpeed * Math.min(1, intensity)
  } else if (mouseX > scrollRect.right - edgeSize) {
    const intensity = (mouseX - (scrollRect.right - edgeSize)) / edgeSize
    scrollSpeedX = maxScrollSpeed * Math.min(1, intensity)
  }
  
  if (mouseY < scrollRect.top + edgeSize) {
    const intensity = (scrollRect.top + edgeSize - mouseY) / edgeSize
    scrollSpeedY = -maxScrollSpeed * Math.min(1, intensity)
  } else if (mouseY > scrollRect.bottom - edgeSize) {
    const intensity = (mouseY - (scrollRect.bottom - edgeSize)) / edgeSize
    scrollSpeedY = maxScrollSpeed * Math.min(1, intensity)
  }
  
  if (scrollSpeedX !== 0 || scrollSpeedY !== 0) {
    dragScrollContainer.scrollLeft += scrollSpeedX
    dragScrollContainer.scrollTop += scrollSpeedY
  }
}

const updateDragPosition = (event: MouseEvent) => {
  if (!dragCardEl || !dragScrollContainer) return
  
  const dx = event.clientX - dragStartX
  const dy = event.clientY - dragStartY
  
  // Set position directly on cloned DOM element
  dragCardEl.style.left = `${dragInitialLeft + dx}px`
  dragCardEl.style.top = `${dragInitialTop + dy}px`
  
  const currentScrollLeft = dragScrollContainer.scrollLeft
  const currentScrollTop = dragScrollContainer.scrollTop
  
  // Find active column based on current mouse position and columns bounds adjusted by current scroll offsets
  let activeCol = columnsBounds.find(c => {
    const left = c.scrollLeft - currentScrollLeft
    const right = left + c.width
    return event.clientX >= left && event.clientX <= right
  })
  
  if (!activeCol && columnsBounds.length > 0) {
    activeCol = columnsBounds.reduce((prev, curr) => {
      const prevLeft = prev.scrollLeft - currentScrollLeft
      const prevRight = prevLeft + prev.width
      const prevDist = Math.min(Math.abs(event.clientX - prevLeft), Math.abs(event.clientX - prevRight))
      
      const currLeft = curr.scrollLeft - currentScrollLeft
      const currRight = currLeft + curr.width
      const currDist = Math.min(Math.abs(event.clientX - currLeft), Math.abs(event.clientX - currRight))
      
      return prevDist < currDist ? prev : curr
    })
  }
  
  if (activeCol) {
    // Only update Vue reactive state when it actually shifts, to prevent rendering cycles
    if (dragTempDate.value !== activeCol.date) {
      dragTempDate.value = activeCol.date
    }
    
    const colViewportTop = activeCol.top - currentScrollTop
    const cardTopInCol = event.clientY - colViewportTop - dragClickOffsetY
    
    const pixelsPerMinute = 50 / 60
    
    // Snapping to 5 minutes
    let newStartMins = Math.round((cardTopInCol / pixelsPerMinute) / 5) * 5 + 360
    newStartMins = Math.max(360, Math.min(1440 - dragDurationMins, newStartMins))
    const newEndMins = newStartMins + dragDurationMins
    
    const startStr = minsToTimeStr(newStartMins)
    const endStr = minsToTimeStr(newEndMins)
    
    if (dragTempStart.value !== startStr) {
      dragTempStart.value = startStr
    }
    if (dragTempEnd.value !== endStr) {
      dragTempEnd.value = endStr
    }
  }
}

const dragLoop = () => {
  if (!draggingTaskId.value || !lastMouseEvt) return
  
  handleAutoScroll(lastMouseEvt)
  updateDragPosition(lastMouseEvt)
  
  rafId = requestAnimationFrame(dragLoop)
}

const onMouseMove = (event: MouseEvent) => {
  lastMouseEvt = event
}

const startDrag = (task: any, event: MouseEvent) => {
  if (event.button !== 0) return
  
  const target = event.target as HTMLElement
  if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('textarea') || target.closest('.resize-handle')) {
    return
  }
  
  event.stopPropagation()
  event.preventDefault()
  
  originalCardEl = target.closest('.todo-item') as HTMLElement
  if (!originalCardEl) return
  
  dragScrollContainer = document.querySelector('.days-columns-scroll') as HTMLElement
  if (!dragScrollContainer) return
  
  draggingTaskId.value = task.id
  dragStartX = event.clientX
  dragStartY = event.clientY
  
  dragTempDate.value = task.date
  dragTempStart.value = task.startTime
  dragTempEnd.value = task.endTime
  
  const dragInitialStartMins = timeStrToMins(task.startTime)
  const dragInitialEndMins = timeStrToMins(task.endTime)
  dragDurationMins = dragInitialEndMins - dragInitialStartMins
  
  const rect = originalCardEl.getBoundingClientRect()
  dragInitialLeft = rect.left
  dragInitialTop = rect.top
  dragClickOffsetY = event.clientY - rect.top
  
  // Clone the card for floating dragging
  dragCardEl = originalCardEl.cloneNode(true) as HTMLElement
  dragCardEl.style.position = 'fixed'
  dragCardEl.style.width = `${rect.width}px`
  dragCardEl.style.height = `${rect.height}px`
  dragCardEl.style.left = `${rect.left}px`
  dragCardEl.style.top = `${rect.top}px`
  dragCardEl.style.zIndex = '1000'
  dragCardEl.style.pointerEvents = 'none'
  dragCardEl.style.opacity = '0.9'
  dragCardEl.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.3)'
  dragCardEl.style.margin = '0'
  dragCardEl.style.transform = 'none'
  dragCardEl.classList.add('is-dragging-clone')
  
  document.body.appendChild(dragCardEl)
  document.body.style.cursor = 'grabbing'
  
  // Cache columns bounds relative to scroll container scroll offset
  const colElements = Array.from(document.querySelectorAll('.column-scheduler-body'))
  const currentScrollLeft = dragScrollContainer.scrollLeft
  const currentScrollTop = dragScrollContainer.scrollTop
  
  columnsBounds = colElements.map(el => {
    const r = el.getBoundingClientRect()
    return {
      date: el.getAttribute('data-date') || '',
      scrollLeft: r.left + currentScrollLeft,
      width: r.width,
      top: r.top + currentScrollTop,
      height: r.height
    }
  })
  
  lastMouseEvt = event
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopDrag)
  
  // Start high performance RAF loop
  rafId = requestAnimationFrame(dragLoop)
}

const stopDrag = async () => {
  if (!draggingTaskId.value) return
  
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
  
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  const { updateTask } = useTodos()
  
  let targetLeft = dragInitialLeft
  let targetTop = dragInitialTop
  
  if (dragScrollContainer && dragTempDate.value && dragTempStart.value) {
    const currentScrollLeft = dragScrollContainer.scrollLeft
    const currentScrollTop = dragScrollContainer.scrollTop
    
    const targetCol = columnsBounds.find(c => c.date === dragTempDate.value)
    if (targetCol) {
      const colViewportLeft = targetCol.scrollLeft - currentScrollLeft
      const colViewportTop = targetCol.top - currentScrollTop
      
      const startMins = timeStrToMins(dragTempStart.value)
      const pixelsPerMinute = 50 / 60
      const topPx = (startMins - 360) * pixelsPerMinute
      
      targetLeft = colViewportLeft + 6
      targetTop = colViewportTop + topPx
    }
  }
  
  if (dragCardEl) {
    // Smooth snap sliding animation
    dragCardEl.style.transition = 'left 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease'
    dragCardEl.style.left = `${targetLeft}px`
    dragCardEl.style.top = `${targetTop}px`
    dragCardEl.style.opacity = '0'
  }
  
  const taskId = draggingTaskId.value
  const targetDate = dragTempDate.value
  const targetStart = dragTempStart.value
  const targetEnd = dragTempEnd.value
  const cardElToClean = dragCardEl
  const originalElToClean = originalCardEl
  
  setTimeout(async () => {
    if (cardElToClean && cardElToClean.parentNode) {
      cardElToClean.parentNode.removeChild(cardElToClean)
    }
    
    if (originalElToClean) {
      originalElToClean.style.opacity = ''
    }
    
    if (targetDate && targetStart && targetEnd) {
      await updateTask(taskId, {
        date: targetDate,
        startTime: targetStart,
        endTime: targetEnd
      })
    }
  }, 200)
  
  draggingTaskId.value = null
  dragTempDate.value = ''
  dragTempStart.value = ''
  dragTempEnd.value = ''
  dragCardEl = null
  originalCardEl = null
  lastMouseEvt = null
}

const getDraggingTaskTitle = () => {
  if (!draggingTaskId.value) return ''
  const t = tasks.value.find(task => task.id === draggingTaskId.value)
  return t ? t.title : ''
}

const getGhostCardStyle = () => {
  if (!draggingTaskId.value || !dragTempStart.value || !dragTempEnd.value) return {}
  
  const startMins = timeStrToMins(dragTempStart.value)
  const endMins = timeStrToMins(dragTempEnd.value)
  
  const timelineStartMins = 6 * 60
  const topOffsetMins = Math.max(0, startMins - timelineStartMins)
  const durationMins = Math.max(15, endMins - startMins)
  
  const pixelsPerMinute = 50 / 60
  const topPx = topOffsetMins * pixelsPerMinute
  const heightPx = durationMins * pixelsPerMinute
  
  return {
    position: 'absolute',
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: '6px',
    right: '6px',
    zIndex: 9
  } as any
}

// --- Grid Logic (06:00 to 24:00) ---
const calendarDays = computed(() => {
  const days = []
  const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    
    const dateString = d.toISOString().split('T')[0]
    let dayLabel = weekLabels[d.getDay()]
    if (i === 0) dayLabel = '今天'
    if (i === 1) dayLabel = '明天'
    
    days.push({
      dateString,
      dayLabel,
      formattedDate: `${d.getMonth() + 1}/${d.getDate()}`,
      dayOfWeek: weekLabels[d.getDay()]
    })
  }
  return days
})

// Displayed hourly time list
const timeSlots = computed(() => {
  const slots = []
  for (let h = 6; h <= 23; h++) {
    slots.push({
      value: `${String(h).padStart(2, '0')}:00`,
      label: `${String(h).padStart(2, '0')}:00`
    })
  }
  return slots
})

// Unpinned backlog todos
const backlogTodos = computed(() => {
  return todos.value.filter(t => !t.completed) // Active backlog items
})



const getTimedTodosForDate = (dateString: string) => {
  return tasks.value.filter(t => t.date === dateString && t.startTime)
}

// Calculate top & height positioning based on minutes offset & overlap lanes
const getTodoGridStyle = (task: any, dayDate: string) => {
  if (!task.startTime || !task.endTime) {
    return { 'grid-row': '1 / 2' }
  }

  // Get all timed tasks for this date
  const dayTasks = getTimedTodosForDate(dayDate)

  // Sort tasks by start time, then by end time
  const sorted = [...dayTasks].sort((a, b) => {
    const aStart = timeStrToMins(a.startTime)
    const bStart = timeStrToMins(b.startTime)
    if (aStart !== bStart) return aStart - bStart
    return timeStrToMins(a.endTime) - timeStrToMins(b.endTime)
  })

  // Group into clusters
  const clusters: typeof dayTasks[] = []
  let currentCluster: typeof dayTasks = []
  let currentClusterEnd = 0

  for (const t of sorted) {
    const start = timeStrToMins(t.startTime)
    const end = timeStrToMins(t.endTime)

    if (currentCluster.length === 0) {
      currentCluster.push(t)
      currentClusterEnd = end
    } else if (start < currentClusterEnd) {
      currentCluster.push(t)
      currentClusterEnd = Math.max(currentClusterEnd, end)
    } else {
      clusters.push(currentCluster)
      currentCluster = [t]
      currentClusterEnd = end
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  // Determine lanes for the cluster containing our task
  let numCols = 1
  let colIdx = 0

  for (const cluster of clusters) {
    if (cluster.some(t => t.id === task.id)) {
      // Build columns for this cluster
      const columns: typeof dayTasks[] = []
      for (const t of cluster) {
        let placed = false
        for (let idx = 0; idx < columns.length; idx++) {
          const col = columns[idx]
          const lastTask = col[col.length - 1]
          if (timeStrToMins(t.startTime) >= timeStrToMins(lastTask.endTime)) {
            col.push(t)
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([t])
        }
      }

      numCols = columns.length
      colIdx = columns.findIndex(col => col.some(t => t.id === task.id))
      break
    }
  }

  // Standard vertical sizing
  const startMins = timeStrToMins(task.startTime)
  const endMins = timeStrToMins(task.endTime)
  const timelineStartMins = 6 * 60
  const topOffsetMins = Math.max(0, startMins - timelineStartMins)
  const durationMins = Math.max(15, endMins - startMins)

  const pixelsPerMinute = 50 / 60
  const topPx = topOffsetMins * pixelsPerMinute
  const heightPx = durationMins * pixelsPerMinute

  // Lane calculations
  const widthPercent = 100 / numCols
  const leftPercent = widthPercent * colIdx

  const baseStyle: any = {
    position: 'absolute',
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: `calc(${leftPercent}% + 4px)`,
    width: `calc(${widthPercent}% - 8px)`,
    zIndex: 10
  }

  // If this card is currently dragging, hide the original card since a floating clone is used
  if (draggingTaskId.value === task.id) {
    baseStyle.opacity = 0
    baseStyle.pointerEvents = 'none'
  }

  return baseStyle
}
</script>

<template>
  <div class="calendar-planner">
    
    <!-- Planner Grid -->
    <div class="planner-grid">
      
      <!-- Left Area: 7 Columns Grid -->
      <section class="days-columns-wrapper">
        <div class="days-columns-scroll">
          <div class="days-columns">
            
            <!-- Left Side Independent Time Axis Column -->
            <div class="time-axis-column">
              <div class="time-axis-header-placeholder"></div>
              <div class="time-axis-slots">
                <div 
                  v-for="slot in timeSlots" 
                  :key="slot.value"
                  class="time-axis-slot"
                >
                  <span>{{ slot.label }}</span>
                  <span class="label-dot"></span>
                </div>
              </div>
            </div>

            <!-- 7 Day Columns -->
            <div 
              v-for="day in calendarDays" 
              :key="day.dateString"
              class="day-column glass-panel"
              :class="{ 'is-today': day.dayLabel === '今天' }"
            >
              <!-- Column Header -->
              <div class="column-header">
                <div class="day-info">
                  <span class="day-lbl">{{ day.dayLabel }}</span>
                  <span class="day-dt">{{ day.formattedDate }}</span>
                </div>
                <div class="day-meta">
                  <span class="day-wk" v-if="day.dayLabel !== '今天' && day.dayLabel !== '明天'">
                    {{ day.dayOfWeek }}
                  </span>
                </div>
              </div>

              <!-- Hourly scheduler grid body -->
              <div class="column-scheduler-body" :data-date="day.dateString">
                
                <!-- Background Layer: Grid lines & Add triggers -->
                <div class="scheduler-grid-bg">
                  <div 
                    v-for="(slot, idx) in timeSlots" 
                    :key="slot.value"
                    class="grid-row-slot"
                    :style="{ 'grid-row': (idx + 1) }"
                  >
                    <!-- Divider line + Quick Add Button (no label column) -->
                    <div class="grid-row-divider-container">
                      <div class="grid-row-divider"></div>
                      <button 
                        @click="openGridAddModal(day.dateString, slot.value)"
                        class="slot-add-btn"
                        title="在此时间安排待办"
                      >
                        <Plus class="slot-add-icon" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Foreground Layer: Pinned task cards positioned using minutes math -->
                <div class="scheduler-grid-fg">
                  
                  <!-- Timed Pinned Tasks (Absolute overlaid positioning) -->
                  <div class="timed-cards-container">
                    <TodoItem 
                      v-for="todo in getTimedTodosForDate(day.dateString)" 
                      :key="todo.id" 
                      :todo="todo" 
                      :compact="true"
                      :is-task="true"
                      :hide-actions="true"
                      :custom-style="getTodoGridStyle(todo, day.dateString)"
                      @mousedown="startDrag(todo, $event)"
                      class="compact-todo-card timed-todo-card"
                    />

                    <!-- Drag Ghost Preview Card -->
                    <div 
                      v-if="draggingTaskId && dragTempDate === day.dateString"
                      class="ghost-preview-card"
                      :style="getGhostCardStyle()"
                    >
                      <div class="ghost-title">{{ getDraggingTaskTitle() }}</div>
                      <div class="ghost-time-row">
                        <Clock class="ghost-time-icon" />
                        <span class="ghost-time-text">{{ dragTempStart }} - {{ dragTempEnd }}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      <!-- Right Column: Backlog Pool -->
      <aside class="backlog-aside glass-panel">
        <div class="aside-title">
          <Inbox class="aside-title-icon" />
          <h3>待办清单</h3>
          <span class="aside-count">{{ backlogTodos.length }}</span>
        </div>

        <div class="backlog-scroll-area">
          <div class="backlog-list">
            <div 
              v-for="todo in backlogTodos" 
              :key="todo.id" 
              class="backlog-item-card-wrapper"
            >
              <!-- Card item rendering -->
              <TodoItem 
                :todo="todo" 
                :compact="true" 
                :show-plan-action="true" 
                @plan="openPlanModal(todo, $event)"
                class="backlog-todo-card" 
              />
            </div>
          </div>

          <div v-if="backlogTodos.length === 0" class="backlog-empty">
            <p>待办清单已清空</p>
            <span>可以点击右上角【待办】去添加更多规划事项</span>
          </div>
        </div>
      </aside>

    </div>

    <!-- 1. Popover Planning Form Card (Arranging todo templates next to the clicked card) -->
    <div v-if="showPlanModal && planningTodo" class="popover-backdrop" @click="showPlanModal = false">
      <div 
        class="popover-content glass-panel" 
        :style="{ top: `${planPopoverTop}px`, left: `${planPopoverLeft}px` }"
        @click.stop
      >
        <div class="popover-header">
          <Clock class="popover-header-icon" />
          <h3 class="popover-title-text" :title="planningTodo.title">安排: {{ planningTodo.title }}</h3>
          <button @click="showPlanModal = false" class="btn-close-modal">
            <X class="close-icon" />
          </button>
        </div>
        
        <form @submit.prevent="submitPlanModal" class="modal-form">
          <div class="modal-field">
            <label>安排日期</label>
            <input type="date" v-model="planDate" required />
          </div>

          <div class="modal-dual-row">
            <div class="modal-field">
              <label>开始时间</label>
              <input type="time" v-model="planStartTime" required />
            </div>
            <div class="modal-field">
              <label>结束时间</label>
              <input type="time" v-model="planEndTime" required />
            </div>
          </div>

          <div class="modal-field">
            <label>卡片颜色</label>
            <div class="color-selectors">
              <button
                v-for="c in colorsList"
                :key="c.value"
                type="button"
                class="color-dot-btn"
                :class="[c.class, { 'selected': planColor === c.value }]"
                @click="planColor = c.value"
                :title="c.label"
              ></button>
            </div>
          </div>

          <div class="modal-footer-actions">
            <button type="submit" class="btn-submit-add">确认为日程</button>
            <button type="button" @click="showPlanModal = false" class="btn-cancel-modal">取消</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 2. Centered Modal Planning Dialog (When clicked '+' in grid, spawns center modal) -->
    <Transition name="fade">
      <div v-if="showPlanModal && !planningTodo" class="modal-backdrop">
        <div class="modal-content glass-panel">
          <div class="modal-header">
            <Clock class="modal-header-icon" />
            <h3>从待办清单安排日程</h3>
            <button @click="showPlanModal = false" class="btn-close-modal">
              <X class="close-icon" />
            </button>
          </div>
          
          <form @submit.prevent="submitPlanModal" class="modal-form">
            <div class="modal-field">
              <label>选择待办模板</label>
              <div v-if="backlogTodos.length === 0" class="empty-select-tip">
                待办清单为空，请先在【待办】页面创建模板。
              </div>
              <select v-else v-model="selectedTodoId" class="todo-select-dropdown" required>
                <option value="" disabled selected>-- 请选择一个待办项 --</option>
                <option v-for="t in backlogTodos" :key="t.id" :value="t.id">
                  {{ t.title }}
                </option>
              </select>
            </div>

            <div class="modal-field">
              <label>安排日期</label>
              <input type="date" v-model="planDate" required />
            </div>

            <div class="modal-dual-row">
              <div class="modal-field">
                <label>开始时间</label>
                <input type="time" v-model="planStartTime" required />
              </div>
              <div class="modal-field">
                <label>结束时间</label>
                <input type="time" v-model="planEndTime" required />
              </div>
            </div>

            <div class="modal-field">
              <label>卡片颜色</label>
              <div class="color-selectors">
                <button
                  v-for="c in colorsList"
                  :key="c.value"
                  type="button"
                  class="color-dot-btn"
                  :class="[c.class, { 'selected': planColor === c.value }]"
                  @click="planColor = c.value"
                  :title="c.label"
                ></button>
              </div>
            </div>

            <div class="modal-footer-actions">
              <button type="submit" class="btn-submit-add" :disabled="backlogTodos.length === 0">确认为日程</button>
              <button type="button" @click="showPlanModal = false" class="btn-cancel-modal">取消</button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.calendar-planner {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: calc(100vh - 160px);
}

/* Grid Layout */
.planner-grid {
  display: grid;
  grid-template-columns: 1fr 310px;
  gap: 20px;
  align-items: stretch;
  height: 75vh;
  min-height: 600px;
}

/* Right Backlog Pool Aside */
.backlog-aside {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 20px;
  height: 100%;
}

.aside-title {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-glass);
  padding-bottom: 14px;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.aside-title-icon {
  width: 18px;
  height: 18px;
  color: var(--color-primary);
}

.aside-title h3 {
  font-size: 0.95rem;
  font-weight: 700;
  flex: 1;
}

.aside-count {
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--border-glass);
  padding: 2px 8px;
  border-radius: 9999px;
  color: var(--text-secondary);
}

.backlog-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;
  display: flex;
  flex-direction: column;
}

.backlog-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.backlog-item-card-wrapper {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-glass-subtle);
  border-radius: 12px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.backlog-todo-card {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  padding: 4px 6px !important;
}

.plan-trigger-row {
  display: flex;
  flex-direction: column;
}

.btn-plan-action {
  background: var(--color-primary-alpha);
  color: var(--color-primary-light);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgba(124, 58, 237, 0.1);
}

.btn-plan-action:hover {
  background: var(--color-primary);
  color: #ffffff;
  transform: translateY(-1px);
}

.plan-btn-icon {
  width: 12px;
  height: 12px;
}

/* Inline Scheduler Form */
.inline-scheduler-form {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-glass-solid);
  border: 1px solid var(--border-glass);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.inline-form-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-glass-subtle);
  padding-bottom: 4px;
  margin-bottom: 2px;
}

.inline-form-icon {
  width: 12px;
  height: 12px;
}

.inline-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inline-field label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
}

.inline-field input {
  padding: 4px 8px !important;
  font-size: 0.75rem !important;
  border-radius: 6px !important;
}

.inline-dual-fields {
  display: flex;
  gap: 8px;
}

.inline-dual-fields .inline-field {
  flex: 1;
}

.inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.btn-confirm {
  background: var(--color-success);
  color: #ffffff;
  padding: 4px 10px;
  font-size: 0.7rem;
  border-radius: 6px;
}

.btn-confirm:hover {
  background: hsl(142, 70%, 40%);
}

.inline-actions .btn-cancel {
  background: var(--border-glass);
  color: var(--text-secondary);
  padding: 4px 8px;
  font-size: 0.7rem;
  border-radius: 6px;
}

.inline-actions .btn-cancel:hover {
  background: var(--border-glass-subtle);
  color: var(--text-primary);
}

.btn-action-icon {
  width: 10px;
  height: 10px;
}

.backlog-empty {
  margin: auto;
  text-align: center;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.backlog-empty p {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
}

.backlog-empty span {
  font-size: 0.72rem;
  color: var(--text-muted);
  max-width: 200px;
  line-height: 1.4;
}

/* Left Scrollable Day Columns Wrapper */
.days-columns-wrapper {
  overflow: hidden;
  height: 100%;
}

.days-columns-scroll {
  overflow: auto;
  height: 100%;
  padding-bottom: 8px;
  scrollbar-width: none; /* Hide scrollbar for Firefox */
  -ms-overflow-style: none;  /* Hide scrollbar for IE and Edge */
}

.days-columns-scroll::-webkit-scrollbar {
  display: none; /* Hide scrollbar for Chrome, Safari, and Opera */
}

.days-columns {
  display: flex;
  gap: 14px;
  height: fit-content;
  min-height: 100%;
  width: max-content;
  min-width: 100%;
}

/* Single Day Column */
.day-column {
  width: 280px;
  display: flex;
  flex-direction: column;
  padding: 14px;
  border-radius: 16px;
  background: var(--bg-glass);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  height: fit-content;
  min-height: 100%;
}

.day-column.is-today {
  border-color: rgba(124, 58, 237, 0.25);
  box-shadow: inset 0 0 10px rgba(124, 58, 237, 0.03);
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-glass);
  padding-bottom: 10px;
  margin-bottom: 10px;
  flex-shrink: 0;
  height: 38px;
  box-sizing: content-box;
}

.day-info {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.day-lbl {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.day-column.is-today .day-lbl {
  color: var(--color-primary-light);
}

.day-dt {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

.day-wk {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
}

/* Column Scheduler grid body */
.column-scheduler-body {
  position: relative;
  padding-right: 4px;
  height: 900px;
  flex-shrink: 0;
}

/* Independent Left Time Axis Column */
.time-axis-column {
  position: sticky;
  left: 0;
  z-index: 20;
  background: transparent;
  width: 36px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.time-axis-header-placeholder {
  height: 59px; /* Matches .column-header height 38px + margins + borders */
  border-bottom: 1px solid transparent;
  margin-bottom: 10px;
  flex-shrink: 0;
  background: transparent;
}

.time-axis-slots {
  display: grid;
  grid-template-rows: repeat(18, 50px);
  width: 100%;
}

.time-axis-slot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  padding-right: 4px;
  height: 50px;
  border-right: 1px solid var(--border-glass);
  box-sizing: border-box;
}

.time-axis-slot .label-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-muted);
  margin-right: -6px; /* Position directly on the vertical line with padding-right 4px */
  z-index: 10;
}

/* Timeline Layout parent container */
.scheduler-grid-bg {
  display: grid;
  /* 18 rows for 06:00 to 24:00 (50px each) */
  grid-template-rows: repeat(18, 50px);
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}

.scheduler-grid-fg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  pointer-events: none;
  height: 100%;
}

/* Time slots background row (no label block, just divider line) */
.grid-row-slot {
  display: block;
  position: relative;
  height: 50px;
}

/* Timeline grid dividers & quick add slot */
.grid-row-divider-container {
  height: 100%;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
}

.grid-row-divider {
  width: 100%;
  border-bottom: 1px dashed var(--border-glass-subtle);
}

.slot-add-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--border-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease, background-color 0.2s ease;
  padding: 0;
  z-index: 2;
  pointer-events: auto; /* Allow buttons to be clicked */
}

.grid-row-slot:hover .slot-add-btn {
  opacity: 1;
}

.slot-add-btn:hover {
  background: var(--color-primary-alpha);
  color: var(--color-primary-light);
}

.slot-add-icon {
  width: 14px;
  height: 14px;
}

/* Foreground Cards Containers */
.timed-cards-container {
  position: relative;
  height: 100%;
  width: 100%;
}

/* Pinned timed cards - positioned inside container grid */
.compact-todo-card {
  pointer-events: auto;
  cursor: grab !important;
}

.timed-todo-card {
  /* Absolute positioning properties computed inline */
}

/* Popover Positioned Planning Form Styles */
.popover-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent; /* Click elsewhere to close */
  z-index: 998;
}

.popover-content {
  position: fixed;
  width: 320px;
  padding: 20px;
  border-radius: 20px;
  z-index: 999;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(124, 58, 237, 0.25);
  background: var(--bg-glass-solid);
  backdrop-filter: blur(20px);
}

.popover-header {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-glass-subtle);
  padding-bottom: 8px;
  margin-bottom: 14px;
}

.popover-title-text {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.todo-select-dropdown {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.85rem;
  border-radius: 10px;
  background: var(--input-bg);
  border: 1px solid var(--border-glass);
  color: var(--text-primary);
  outline: none;
  height: 38px;
}

.empty-select-tip {
  font-size: 0.75rem;
  color: var(--color-danger);
  background: var(--color-danger-alpha);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.1);
  line-height: 1.4;
}

/* Modal Dialog Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: 90%;
  max-width: 460px;
  padding: 24px;
  border-color: rgba(124, 58, 237, 0.25);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border-glass);
  padding-bottom: 14px;
  margin-bottom: 20px;
}

.modal-header-icon {
  width: 20px;
  height: 20px;
  color: var(--color-primary-light);
}

.modal-header h3 {
  font-size: 1.05rem;
  font-weight: 700;
  flex: 1;
}

.btn-close-modal {
  background: transparent;
  color: var(--text-muted);
  padding: 4px;
}

.btn-close-modal:hover {
  color: var(--text-primary);
}

.close-icon {
  width: 18px;
  height: 18px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-field label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.modal-dual-row {
  display: flex;
  gap: 16px;
}

.modal-dual-row .modal-field {
  flex: 1;
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  border-top: 1px solid var(--border-glass-subtle);
  padding-top: 16px;
}

.btn-submit-add {
  background: var(--color-primary);
  color: #ffffff;
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.btn-submit-add:hover {
  background: var(--color-primary-light);
}

.btn-cancel-modal {
  background: var(--border-glass);
  color: var(--text-secondary);
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.btn-cancel-modal:hover {
  background: var(--border-glass-subtle);
  color: var(--text-primary);
}

/* Transitions helper */
.list-leave-active {
  position: absolute;
  width: calc(100% - 12px);
}

/* Responsive adjust */
@media (max-width: 968px) {
  .planner-grid {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }
  
  .backlog-aside {
    height: 380px;
    order: -1; /* Backlog pool on top in mobile */
  }
  
  .days-columns-wrapper {
    height: 600px;
  }
}

/* Drag Ghost Preview Card */
.ghost-preview-card {
  border: 2px dashed rgba(124, 58, 237, 0.4);
  background: rgba(124, 58, 237, 0.05);
  border-radius: 12px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  pointer-events: none;
  box-sizing: border-box;
}

.ghost-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ghost-time-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ghost-time-icon {
  width: 11px;
  height: 11px;
  color: var(--text-muted);
}

.ghost-time-text {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
}
</style>
