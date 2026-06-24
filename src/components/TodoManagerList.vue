<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodos, Todo } from '../composables/useTodos'
import { Plus, Search, Tag, Edit3, Trash2, Check, X, AlertCircle } from 'lucide-vue-next'


const { todos, addTodo, updateTodo, deleteTodo } = useTodos()

// --- Filter State ---
const searchQuery = ref('')
const selectedCategory = ref<string>('all')
const selectedPriority = ref<string>('all')

// --- Modal State ---
const showModal = ref(false)
const isEditMode = ref(false)
const editingTodoId = ref<string | null>(null)

// --- Modal Form Fields ---
const modalTitle = ref('')
const modalDesc = ref('')
const modalCategory = ref('work')
const modalPriority = ref('medium')

const categoriesList = [
  { value: 'work', label: '工作', class: 'cat-work' },
  { value: 'personal', label: '个人', class: 'cat-personal' },
  { value: 'fitness', label: '健康', class: 'cat-fitness' },
  { value: 'ideas', label: '灵感', class: 'cat-ideas' },
  { value: 'shopping', label: '购物', class: 'cat-shopping' },
  { value: 'other', label: '其他', class: 'cat-other' }
]

const prioritiesList = [
  { value: 'high', label: '高优先级', color: '#f43f5e' },
  { value: 'medium', label: '中优先级', color: '#f59e0b' },
  { value: 'low', label: '低优先级', color: '#10b981' }
]

// --- Computed Filtered list ---
const filteredTodos = computed(() => {
  return todos.value.filter(t => {
    // Search query filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const titleMatch = t.title.toLowerCase().includes(q)
      const descMatch = (t.description || '').toLowerCase().includes(q)
      if (!titleMatch && !descMatch) return false
    }

    // Category filter
    if (selectedCategory.value !== 'all') {
      if (t.category !== selectedCategory.value) return false
    }

    // Priority filter
    if (selectedPriority.value !== 'all') {
      if (t.priority !== selectedPriority.value) return false
    }

    return true
  }).sort((a, b) => {
    // Sort uncompleted first, then by priority
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }
    return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
  })
})

// --- Modal Handlers ---
const openAddModal = () => {
  isEditMode.value = false
  editingTodoId.value = null
  modalTitle.value = ''
  modalDesc.value = ''
  modalCategory.value = 'work'
  modalPriority.value = 'medium'
  showModal.value = true
}

const openEditModal = (todo: Todo) => {
  isEditMode.value = true
  editingTodoId.value = todo.id
  modalTitle.value = todo.title
  modalDesc.value = todo.description || ''
  modalCategory.value = todo.category
  modalPriority.value = todo.priority
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleSubmit = () => {
  if (!modalTitle.value.trim()) return

  if (isEditMode.value && editingTodoId.value) {
    // Update
    updateTodo(editingTodoId.value, {
      title: modalTitle.value,
      description: modalDesc.value,
      category: modalCategory.value,
      priority: modalPriority.value
    })
  } else {
    // Create
    addTodo({
      title: modalTitle.value,
      description: modalDesc.value,
      category: modalCategory.value,
      priority: modalPriority.value
    })
  }

  showModal.value = false
}

// --- Toggle Completed ---
const toggleCompletedStatus = (todo: Todo) => {
  updateTodo(todo.id, { completed: !todo.completed })
}
</script>

<template>
  <div class="todo-manager-layout">
    <div class="main-panel glass-panel">
      <!-- Top Filters & Add Button Toolbar -->
      <div class="toolbar-filters">
        <div class="left-filters">
          <div class="search-box">
            <Search class="search-icon" />
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="搜索待办标题或描述..." 
            />
          </div>

          <div class="filter-dropdowns">
            <div class="dropdown-group">
              <label>分类</label>
              <select v-model="selectedCategory">
                <option value="all">所有分类</option>
                <option v-for="cat in categoriesList" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </option>
              </select>
            </div>

            <div class="dropdown-group">
              <label>优先级</label>
              <select v-model="selectedPriority">
                <option value="all">所有优先级</option>
                <option v-for="p in prioritiesList" :key="p.value" :value="p.value">
                  {{ p.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <button @click="openAddModal" class="btn-add-new">
          <Plus class="btn-icon" />
          <span>新建待办</span>
        </button>
      </div>

      <!-- Todo scrollable list (Full Width Rows) -->
      <div class="todos-list-wrapper">
        <div v-if="filteredTodos.length === 0" class="empty-state">
          <AlertCircle class="empty-icon" />
          <p>没有匹配的待办模板</p>
          <span>试着调整右上角的筛选条件，或者点击“新建待办”创建一个新的模板。</span>
        </div>

        <div v-else class="todos-grid">
          <div 
            v-for="todo in filteredTodos" 
            :key="todo.id" 
            class="todo-list-card glass-card"
            :class="{ 'is-completed': todo.completed }"
          >
            <div class="card-read-mode">
              <div class="card-left-section">
                <!-- Checkbox to toggle completed -->
                <div class="checkbox-container" @click="toggleCompletedStatus(todo)" style="cursor: pointer;">
                  <div class="custom-checkbox" :class="{ checked: todo.completed }">
                    <Check v-if="todo.completed" class="check-mark" />
                  </div>
                </div>

                <div class="todo-info">
                  <h3 class="todo-title" :title="todo.title">{{ todo.title }}</h3>
                  <p class="todo-description" v-if="todo.description">{{ todo.description }}</p>
                </div>
              </div>

              <!-- Tags in Middle -->
              <div class="card-middle-tags">
                <span class="tag-badge" :class="'cat-' + todo.category">
                  <Tag class="tag-icon" />
                  {{ categoriesList.find(c => c.value === todo.category)?.label || '其他' }}
                </span>
                <span 
                  class="priority-dot-badge" 
                  :style="{ color: prioritiesList.find(p => p.value === todo.priority)?.color }"
                >
                  ● {{ prioritiesList.find(p => p.value === todo.priority)?.label || '中' }}
                </span>
              </div>

              <!-- Action buttons on Far Right -->
              <div class="card-actions">
                <button 
                  @click="openEditModal(todo)" 
                  class="btn-icon-action btn-edit" 
                  title="编辑待办"
                >
                  <Edit3 class="action-icon" />
                </button>
                <button 
                  @click="deleteTodo(todo.id)" 
                  class="btn-icon-action btn-delete" 
                  title="删除待办"
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
          <h3>{{ isEditMode ? '编辑待办模板' : '创建待办模板' }}</h3>
          <button @click="closeModal" class="btn-close-modal">
            <X class="icon-small" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-group">
            <label>标题 *</label>
            <input 
              type="text" 
              v-model="modalTitle" 
              placeholder="例如: 探索设计规范..." 
              required 
            />
          </div>

          <div class="form-group">
            <label>描述</label>
            <textarea 
              v-model="modalDesc" 
              rows="3" 
              placeholder="输入模板描述信息..."
            ></textarea>
          </div>

          <div class="form-group">
            <label>分类</label>
            <select v-model="modalCategory">
              <option v-for="cat in categoriesList" :key="cat.value" :value="cat.value">
                {{ cat.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>优先级</label>
            <div class="priority-selector">
              <label 
                v-for="p in prioritiesList" 
                :key="p.value"
                class="priority-label"
                :style="{ 
                  borderColor: modalPriority === p.value ? p.color : 'transparent',
                  background: modalPriority === p.value ? p.color + '18' : 'var(--input-bg)'
                }"
              >
                <input type="radio" v-model="modalPriority" :value="p.value" class="radio-hidden" />
                <span :style="{ color: p.color }">{{ p.label }}</span>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button type="submit" class="btn-save-modal">
              {{ isEditMode ? '保存修改' : '确认创建' }}
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
.todo-manager-layout {
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

.dropdown-group select {
  padding: 6px 12px;
  font-size: 0.78rem;
  border-radius: 8px;
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
}

.btn-add-new:hover {
  background: var(--color-primary-light);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
}

.btn-icon {
  width: 14px;
  height: 14px;
}

/* Scrollable list wrapper */
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

.todo-list-card.is-completed {
  opacity: 0.7;
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
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.checkbox-container {
  cursor: pointer;
  flex-shrink: 0;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 2px solid var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.custom-checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.custom-checkbox.is-disabled {
  opacity: 0.55;
}

.check-mark {
  width: 14px;
  height: 14px;
  color: #fff;
}

.todo-info {
  flex: 1;
  min-width: 0;
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

.is-completed .todo-title {
  text-decoration: line-through;
  color: var(--text-muted);
}

.todo-description {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.tag-icon {
  width: 10px;
  height: 10px;
}

.priority-dot-badge {
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
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

.priority-selector {
  display: flex;
  gap: 8px;
}

.priority-label {
  flex: 1;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 0;
  text-align: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.priority-label span {
  font-size: 0.72rem;
  font-weight: 700;
}

.radio-hidden {
  display: none;
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
