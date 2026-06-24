<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodos, Task } from '../composables/useTodos'
import { Plus, Search, Calendar, Clock, Edit3, Trash2, Check, X, AlertCircle } from 'lucide-vue-next'


const { todos, tasks, addTask, updateTask, deleteTask } = useTodos()

// --- Filter State ---
const searchQuery = ref('')
const filterDate = ref('')
const filterColor = ref('all')

// --- Modal State ---
const showModal = ref(false)
const isEditMode = ref(false)
const editingTaskId = ref<string | null>(null)

// --- Modal Form Fields ---
const modalTodoId = ref('')
const modalDate = ref(new Date().toISOString().split('T')[0])
const modalStartTime = ref('08:00')
const modalEndTime = ref('09:00')
const modalColor = ref('blue')

const colorsList = [
  { value: 'violet', label: '紫罗兰', color: '#8b5cf6' },
  { value: 'blue', label: '天蓝色', color: '#3b82f6' },
  { value: 'emerald', label: '翡翠绿', color: '#10b981' },
  { value: 'amber', label: '琥珀黄', color: '#f59e0b' },
  { value: 'rose', label: '玫瑰红', color: '#f43f5e' },
  { value: 'cyan', label: '青色', color: '#06b6d4' }
]

const categoriesList = [
  { value: 'work', label: '工作', class: 'cat-work' },
  { value: 'personal', label: '个人', class: 'cat-personal' },
  { value: 'fitness', label: '健康', class: 'cat-fitness' },
  { value: 'ideas', label: '灵感', class: 'cat-ideas' },
  { value: 'shopping', label: '购物', class: 'cat-shopping' },
  { value: 'other', label: '其他', class: 'cat-other' }
]

// --- Helper to get parent Todo info ---
const getParentTodo = (todoId?: string) => {
  if (!todoId) return null
  return todos.value.find(t => t.id === todoId) || null
}

// --- Computed Filtered list ---
const filteredTasks = computed(() => {
  return tasks.value.filter(t => {
    const parent = getParentTodo(t.todoId)
    const title = t.title || parent?.title || ''
    
    // Search query filter (matches task title or associated todo title)
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const titleMatch = title.toLowerCase().includes(q)
      const descMatch = (parent?.description || '').toLowerCase().includes(q)
      if (!titleMatch && !descMatch) return false
    }

    // Date filter
    if (filterDate.value) {
      if (t.date !== filterDate.value) return false
    }

    // Color filter
    if (filterColor.value !== 'all') {
      if (t.color !== filterColor.value) return false
    }

    return true
  }).sort((a, b) => {
    // Sort by Date, then by StartTime
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date)
    }
    return a.startTime.localeCompare(b.startTime)
  })
})

// --- Modal Handlers ---
const openAddModal = () => {
  isEditMode.value = false
  editingTaskId.value = null
  modalTodoId.value = todos.value.length > 0 ? todos.value[0].id : ''
  modalDate.value = new Date().toISOString().split('T')[0]
  modalStartTime.value = '08:00'
  modalEndTime.value = '09:00'
  modalColor.value = 'blue'
  showModal.value = true
}

const openEditModal = (task: Task) => {
  isEditMode.value = true
  editingTaskId.value = task.id
  modalTodoId.value = task.todoId || ''
  modalDate.value = task.date
  modalStartTime.value = task.startTime
  modalEndTime.value = task.endTime
  modalColor.value = task.color
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleSubmit = () => {
  if (!modalTodoId.value) return
  const todo = getParentTodo(modalTodoId.value)
  if (!todo) return

  if (isEditMode.value && editingTaskId.value) {
    // Update Task
    updateTask(editingTaskId.value, {
      todoId: modalTodoId.value,
      title: todo.title,
      date: modalDate.value,
      startTime: modalStartTime.value,
      endTime: modalEndTime.value,
      color: modalColor.value
    })
  } else {
    // Add Task
    addTask({
      todoId: modalTodoId.value,
      title: todo.title,
      date: modalDate.value,
      startTime: modalStartTime.value,
      endTime: modalEndTime.value,
      color: modalColor.value
    })
  }

  showModal.value = false
}
</script>

<template>
  <div class="task-manager-layout">
    <div class="main-panel glass-panel">
      <!-- Top Filters & Add Button Toolbar -->
      <div class="toolbar-filters">
        <div class="left-filters">
          <div class="search-box">
            <Search class="search-icon" />
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="搜索日程标题或描述..." 
            />
          </div>

          <div class="filter-dropdowns">
            <div class="dropdown-group">
              <label>按日期</label>
              <input type="date" v-model="filterDate" class="filter-date-input" />
              <button v-if="filterDate" @click="filterDate = ''" class="btn-clear-date" title="清除日期">✕</button>
            </div>

            <div class="dropdown-group">
              <label>标记颜色</label>
              <select v-model="filterColor">
                <option value="all">所有颜色</option>
                <option v-for="c in colorsList" :key="c.value" :value="c.value">
                  {{ c.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <button @click="openAddModal" class="btn-add-new">
          <Plus class="btn-icon" />
          <span>新增日程</span>
        </button>
      </div>

      <!-- Task scrollable list (Full Width Rows) -->
      <div class="todos-list-wrapper">
        <div v-if="filteredTasks.length === 0" class="empty-state">
          <Calendar class="empty-icon" />
          <p>没有找到调度日程任务</p>
          <span>尝试调整搜索词、时间过滤器，或者点击“新增日程”为待办模板调度执行时间。</span>
        </div>

        <div v-else class="todos-grid">
          <div 
            v-for="task in filteredTasks" 
            :key="task.id" 
            class="todo-list-card glass-card"
            :style="{ borderLeft: `4px solid ${colorsList.find(c => c.value === task.color)?.color || '#3b82f6'}` }"
          >
            <div class="card-read-mode">
              <div class="card-left-section">
                <div class="todo-info">
                  <div class="title-row-with-parent">
                    <h3 class="todo-title">{{ task.title || getParentTodo(task.todoId)?.title || '未命名任务' }}</h3>
                    <span 
                      v-if="getParentTodo(task.todoId)" 
                      class="parent-ref-badge"
                    >
                      关联待办
                    </span>
                  </div>

                  <!-- Date & Time Info -->
                  <div class="task-schedule-details">
                    <span class="schedule-item">
                      <Calendar class="schedule-icon" />
                      {{ task.date }}
                    </span>
                    <span class="schedule-item">
                      <Clock class="schedule-icon" />
                      {{ task.startTime }} - {{ task.endTime }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Tags / Color Badge in Middle -->
              <div class="card-middle-tags" v-if="getParentTodo(task.todoId)">
                <span 
                  class="tag-badge" 
                  :class="'cat-' + (getParentTodo(task.todoId)?.category || 'other')"
                >
                  {{ categoriesList.find(c => c.value === (getParentTodo(task.todoId)?.category || 'other'))?.label }}
                </span>
                <span 
                  class="priority-dot-badge"
                  :style="{ color: colorsList.find(c => c.value === task.color)?.color }"
                >
                  ● 优先级: {{ getParentTodo(task.todoId)?.priority === 'high' ? '高' : getParentTodo(task.todoId)?.priority === 'medium' ? '中' : '低' }}
                </span>
              </div>

              <!-- Action buttons on Far Right -->
              <div class="card-actions">
                <button 
                  @click="openEditModal(task)" 
                  class="btn-icon-action btn-edit" 
                  title="编辑日程"
                >
                  <Edit3 class="action-icon" />
                </button>
                <button 
                  @click="deleteTask(task.id)" 
                  class="btn-icon-action btn-delete" 
                  title="删除日程"
                >
                  <Trash2 class="action-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Dialog Popup for Add/Edit -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content glass-panel">
        <div class="modal-header">
          <h3>{{ isEditMode ? '编辑日程任务' : '调度日程任务' }}</h3>
          <button @click="closeModal" class="btn-close-modal">
            <X class="icon-small" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-group">
            <label>选择关联待办模板 *</label>
            <select v-model="modalTodoId" required>
              <option value="" disabled>-- 请选择待办模板 --</option>
              <option v-for="todo in todos" :key="todo.id" :value="todo.id">
                {{ todo.title }} {{ todo.completed ? '(已完成)' : '' }}
              </option>
            </select>
            <span v-if="todos.length === 0" class="warning-text">
              <AlertCircle class="warn-icon" /> 没有可用的待办，请先在“待办管理”中创建。
            </span>
          </div>

          <div class="form-group">
            <label>执行日期 *</label>
            <input type="date" v-model="modalDate" required />
          </div>

          <div class="form-row">
            <div class="form-group half-width">
              <label>开始时间 *</label>
              <input type="time" v-model="modalStartTime" required />
            </div>
            <div class="form-group half-width">
              <label>结束时间 *</label>
              <input type="time" v-model="modalEndTime" required />
            </div>
          </div>

          <div class="form-group">
            <label>标记颜色</label>
            <div class="color-picker-row">
              <button 
                v-for="c in colorsList" 
                :key="c.value"
                type="button"
                class="color-dot-btn"
                :style="{ backgroundColor: c.color }"
                :class="{ active: modalColor === c.value }"
                @click="modalColor = c.value"
                :title="c.label"
              ></button>
            </div>
          </div>

          <div class="modal-footer">
            <button 
              type="submit" 
              class="btn-save-modal"
              :disabled="!modalTodoId"
            >
              {{ isEditMode ? '保存日程' : '确认调度' }}
            </button>
            <button type="button" @click="closeModal" class="btn-cancel-modal">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-manager-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-glass);
}

/* Toolbar Filters */
.toolbar-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-glass-subtle);
  flex-shrink: 0;
}

.left-filters {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 320px;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-box input {
  width: 100%;
  padding: 9px 12px 9px 34px;
  font-size: 0.8rem;
  background: var(--input-bg);
  border: 1px solid var(--border-glass-subtle);
  border-radius: 10px;
  color: var(--text-primary);
  outline: none;
}

.filter-dropdowns {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dropdown-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dropdown-group label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
}

.dropdown-group select, .filter-date-input {
  padding: 6px 12px;
  font-size: 0.78rem;
  border-radius: 8px;
}

.filter-date-input {
  color-scheme: dark;
}

.btn-clear-date {
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 4px;
  margin-left: -24px;
  z-index: 5;
}

.btn-clear-date:hover {
  color: var(--color-danger);
}

.btn-add-new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--color-primary);
  color: #fff;
  padding: 9px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.82rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-add-new:hover {
  background: var(--color-primary-light);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
}

.btn-icon {
  width: 14px;
  height: 14px;
}

/* Scrollable Task List */
.todos-list-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 20px;
  color: var(--text-muted);
  gap: 8px;
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: var(--border-glass);
  margin-bottom: 4px;
}

.empty-state p {
  font-size: 0.9rem;
  font-weight: 700;
}

.empty-state span {
  font-size: 0.75rem;
  max-width: 380px;
  line-height: 1.4;
}

.todos-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.todo-list-card {
  padding: 14px 20px;
  transition: all 0.25s ease;
  background: var(--bg-glass);
  width: 100%;
  box-sizing: border-box;
}

.todo-list-card:hover {
  border-color: var(--color-primary-alpha);
  transform: translateY(-1px);
}

/* Read mode card layout */
.card-read-mode {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.card-left-section {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.todo-info {
  flex: 1;
  min-width: 0;
}

.title-row-with-parent {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.todo-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.parent-ref-badge {
  font-size: 0.62rem;
  font-weight: 700;
  background: var(--color-primary-alpha);
  color: var(--color-primary-light);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.task-schedule-details {
  display: flex;
  gap: 16px;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.schedule-icon {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
}

.card-middle-tags {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.tag-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.priority-dot-badge {
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  color: var(--text-muted);
}

.card-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  opacity: 0.3;
  transition: opacity 0.2s ease;
}

.todo-list-card:hover .card-actions {
  opacity: 1;
}

.btn-icon-action {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--border-glass);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--border-glass-subtle);
}

.btn-icon-action:hover {
  background: var(--card-hover-bg);
}

.btn-edit:hover {
  color: var(--color-primary-light);
}

.btn-delete:hover {
  color: var(--color-danger);
}

.action-icon {
  width: 14px;
  height: 14px;
}

/* Modal Dialog Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  width: 480px;
  max-width: 90vw;
  padding: 24px;
  background: var(--bg-glass-solid) !important;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35) !important;
  border: 1px solid var(--border-glass-subtle);
  border-radius: 20px;
  animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-glass-subtle);
  padding-bottom: 12px;
}

.modal-header h3 {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.btn-close-modal {
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
}

.btn-close-modal:hover {
  color: var(--text-primary);
}

.icon-small {
  width: 14px;
  height: 14px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.form-group input, .form-group textarea, .form-group select {
  padding: 10px 12px;
  font-size: 0.8rem;
  border-radius: 10px;
}

.form-row {
  display: flex;
  gap: 10px;
}

.half-width {
  flex: 1;
}

.warning-text {
  font-size: 0.68rem;
  color: var(--color-warning);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.warn-icon {
  width: 12px;
  height: 12px;
}

.color-picker-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0;
}

.color-dot-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.25s ease;
}

.color-dot-btn:hover {
  transform: scale(1.15);
}

.color-dot-btn.active {
  border-color: #fff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
  transform: scale(1.15);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  border-top: 1px solid var(--border-glass-subtle);
  padding-top: 16px;
}

.btn-save-modal, .btn-cancel-modal {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-save-modal {
  background: var(--color-primary);
  color: #fff;
}

.btn-save-modal:hover {
  background: var(--color-primary-light);
}

.btn-save-modal:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel-modal {
  background: var(--border-glass);
  color: var(--text-secondary);
  border: 1px solid var(--border-glass-subtle);
}

.btn-cancel-modal:hover {
  background: var(--card-hover-bg);
  color: var(--text-primary);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
