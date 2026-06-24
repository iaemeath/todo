<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodos } from '../../../composables/useTodos'
import { Inbox, Plus, X, Tag, AlertCircle, Search, RotateCcw, ChevronDown, ChevronUp } from 'lucide-vue-next'

const { todos, addTodo, deleteTodo } = useTodos()

const showCreateForm = ref(false)
const newTitle = ref('')
const newDesc = ref('')
const newCategory = ref('work')
const newPriority = ref('medium')

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

const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const selectedPriority = ref<string | null>(null)
const showFilter = ref(false)

const resetFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = null
  selectedPriority.value = null
}

const activeBacklogs = computed(() => {
  return todos.value.filter(t => {
    if (t.completed) return false

    // Search query filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const titleMatch = t.title.toLowerCase().includes(q)
      const descMatch = (t.description || '').toLowerCase().includes(q)
      if (!titleMatch && !descMatch) return false
    }

    // Category filter
    if (selectedCategory.value) {
      if (t.category !== selectedCategory.value) return false
    }

    // Priority filter
    if (selectedPriority.value) {
      if (t.priority !== selectedPriority.value) return false
    }

    return true
  })
})

const handleCreateTodo = () => {
  if (!newTitle.value.trim()) return
  addTodo({
    title: newTitle.value,
    description: newDesc.value,
    category: newCategory.value,
    priority: newPriority.value
  })
  // Reset form
  newTitle.value = ''
  newDesc.value = ''
  newCategory.value = 'work'
  newPriority.value = 'medium'
  showCreateForm.value = false
}

// HTML5 Drag API
const handleDragStart = (event: DragEvent, todo: any) => {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  
  const payload = {
    type: 'todo',
    todoId: todo.id,
    title: todo.title
  }
  
  event.dataTransfer.setData('application/json', JSON.stringify(payload))
  
  const target = event.target as HTMLElement
  if (target) {
    target.classList.add('is-dragging')
  }
}

const handleDragEnd = (event: DragEvent) => {
  const target = event.target as HTMLElement
  if (target) {
    target.classList.remove('is-dragging')
  }
}
</script>

<template>
  <div class="backlog-sidebar glass-panel">
    <div class="sidebar-header">
      <div class="title-row">
        <Inbox class="header-icon" />
        <h2>待办清单</h2>
        <span class="count-badge">{{ activeBacklogs.length }}</span>
      </div>
      <button class="btn-add-trigger" @click="showCreateForm = !showCreateForm" title="新建待办">
        <Plus class="add-icon" />
      </button>
    </div>

    <!-- Create Form Overlay / Drawer -->
    <div v-if="showCreateForm" class="create-form-panel glass-card">
      <div class="form-header">
        <h3>创建待办模板</h3>
        <button class="btn-close" @click="showCreateForm = false">
          <X class="close-icon" />
        </button>
      </div>
      
      <form @submit.prevent="handleCreateTodo" class="sidebar-form">
        <div class="form-field">
          <label>标题</label>
          <input type="text" v-model="newTitle" placeholder="输入待办标题..." required />
        </div>

        <div class="form-field">
          <label>描述</label>
          <textarea v-model="newDesc" rows="2" placeholder="输入待办详情..."></textarea>
        </div>

        <div class="form-field">
          <label>分类</label>
          <select v-model="newCategory">
            <option v-for="cat in categoriesList" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
        </div>

        <div class="form-field">
          <label>优先级</label>
          <div class="priority-row">
            <label 
              v-for="p in prioritiesList" 
              :key="p.value"
              class="priority-choice"
              :style="{ borderColor: newPriority === p.value ? p.color : 'transparent', background: newPriority === p.value ? p.color + '18' : 'var(--input-bg)' }"
            >
              <input type="radio" v-model="newPriority" :value="p.value" class="hidden-radio" />
              <span :style="{ color: p.color }">{{ p.label }}</span>
            </label>
          </div>
        </div>

        <button type="submit" class="btn-submit">确认创建</button>
      </form>
    </div>

    <!-- Scrollable Todo List -->
    <div class="sidebar-list-area">
      <div v-if="activeBacklogs.length === 0" class="empty-state">
        <AlertCircle class="empty-icon" />
        <p>暂无待办事项</p>
        <span>点击右上角加号快速创建模板，然后拖拽到日程表中进行规划。</span>
      </div>
      
      <div v-else class="todo-cards-list">
        <div 
          v-for="todo in activeBacklogs" 
          :key="todo.id" 
          class="todo-template-card glass-card"
          draggable="true"
          @dragstart="handleDragStart($event, todo)"
          @dragend="handleDragEnd"
        >
          <div class="card-top">
            <span class="card-title" :title="todo.title">{{ todo.title }}</span>
            <button class="btn-delete" @click="deleteTodo(todo.id)" title="删除模板">
              <X class="delete-icon" />
            </button>
          </div>
          
          <p class="card-desc" v-if="todo.description">{{ todo.description }}</p>
          
          <div class="card-bottom">
            <span class="category-badge" :class="'cat-' + todo.category">
              <Tag class="badge-icon" />
              {{ categoriesList.find(c => c.value === todo.category)?.label }}
            </span>
            <span 
              class="priority-indicator" 
              :style="{ backgroundColor: prioritiesList.find(p => p.value === todo.priority)?.color }"
              :title="prioritiesList.find(p => p.value === todo.priority)?.label"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter Panel at Bottom -->
    <div class="sidebar-filter-panel" :class="{ 'collapsed': !showFilter }">
      <div class="filter-header" @click="showFilter = !showFilter" style="cursor: pointer; user-select: none;">
        <div class="filter-title-group">
          <span class="filter-title">筛选待办</span>
          <ChevronUp v-if="showFilter" class="toggle-icon" />
          <ChevronDown v-else class="toggle-icon" />
        </div>
        <button 
          v-if="searchQuery || selectedCategory || selectedPriority" 
          class="btn-reset" 
          @click.stop="resetFilters"
          title="清空筛选"
        >
          <RotateCcw class="reset-icon" />
          <span>重置</span>
        </button>
      </div>

      <div class="filter-body" v-show="showFilter">
        <!-- Search Input -->
        <div class="filter-search-wrapper">
          <Search class="search-input-icon" />
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜索标题或描述..." 
            class="filter-search-input" 
          />
        </div>

        <!-- Categories tags -->
        <div class="filter-section">
          <span class="section-label">按分类</span>
          <div class="filter-categories-grid">
            <button
              v-for="cat in categoriesList"
              :key="cat.value"
              class="filter-cat-badge"
              :class="['cat-' + cat.value, { active: selectedCategory === cat.value }]"
              @click="selectedCategory = selectedCategory === cat.value ? null : cat.value"
            >
              {{ cat.label }}
            </button>
          </div>
        </div>

        <!-- Priority tags -->
        <div class="filter-section">
          <span class="section-label">优先级</span>
          <div class="filter-priorities-row">
            <button
              v-for="p in prioritiesList"
              :key="p.value"
              class="filter-pri-btn"
              :class="{ active: selectedPriority === p.value }"
              :style="{ 
                borderColor: p.color,
                color: selectedPriority === p.value ? '#fff' : p.color,
                background: selectedPriority === p.value ? p.color : 'transparent'
              }"
              @click="selectedPriority = selectedPriority === p.value ? null : p.value"
            >
              {{ p.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backlog-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 280px;
  overflow: hidden;
  position: relative;
  background: var(--bg-glass-solid);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-glass-subtle);
  flex-shrink: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  width: 18px;
  height: 18px;
  color: var(--color-primary-light);
}

.sidebar-header h2 {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.count-badge {
  font-size: 0.7rem;
  font-weight: 700;
  background: var(--color-primary-alpha);
  color: var(--color-primary-light);
  padding: 2px 6px;
  border-radius: 10px;
}

.btn-add-trigger {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--border-glass);
  color: var(--text-secondary);
}

.btn-add-trigger:hover {
  background: var(--color-primary-alpha);
  color: var(--color-primary-light);
}

.add-icon {
  width: 16px;
  height: 16px;
}

/* Create Form drawer */
.create-form-panel {
  position: absolute;
  top: 60px;
  left: 8px;
  right: 8px;
  z-index: 50;
  padding: 14px;
  border: 1px solid var(--color-primary-alpha);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.form-header h3 {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-close {
  background: transparent;
  color: var(--text-muted);
  padding: 2px;
}

.btn-close:hover {
  color: var(--text-primary);
}

.close-icon {
  width: 14px;
  height: 14px;
}

.sidebar-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.form-field input, .form-field select, .form-field textarea {
  padding: 8px 10px;
  font-size: 0.8rem;
  border-radius: 8px;
}

.priority-row {
  display: flex;
  gap: 6px;
}

.priority-choice {
  flex: 1;
  text-align: center;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 6px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.priority-choice span {
  font-size: 0.7rem;
  font-weight: 700;
}

.hidden-radio {
  display: none;
}

.btn-submit {
  background: var(--color-primary);
  color: #fff;
  font-size: 0.8rem;
  padding: 8px 0;
  border-radius: 8px;
  margin-top: 4px;
}

.btn-submit:hover {
  background: var(--color-primary-light);
}

/* Sidebar list */
.sidebar-list-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 10px;
  color: var(--text-muted);
  gap: 8px;
}

.empty-icon {
  width: 24px;
  height: 24px;
  color: var(--border-glass);
}

.empty-state p {
  font-size: 0.8rem;
  font-weight: 700;
}

.empty-state span {
  font-size: 0.68rem;
  line-height: 1.4;
}

.todo-cards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.todo-template-card {
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
  background: var(--bg-glass);
}

.todo-template-card:hover {
  transform: translateY(-1px);
  border-color: var(--color-primary-alpha);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.todo-template-card.is-dragging {
  opacity: 0.4;
  cursor: grabbing;
  border-style: dashed;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.btn-delete {
  background: transparent;
  color: var(--text-muted);
  padding: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.todo-template-card:hover .btn-delete {
  opacity: 1;
}

.btn-delete:hover {
  color: var(--color-danger);
}

.delete-icon {
  width: 12px;
  height: 12px;
}

.card-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.badge-icon {
  width: 10px;
  height: 10px;
}

.priority-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* Filter Panel Styles */
.sidebar-filter-panel {
  padding: 14px;
  border-top: 1px solid var(--border-glass-subtle);
  background: var(--bg-glass-solid);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-filter-panel:not(.collapsed) {
  gap: 12px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-icon {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.filter-header:hover .toggle-icon {
  color: var(--text-secondary);
}

.filter-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-reset {
  background: transparent;
  color: var(--color-primary-light);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
}

.btn-reset:hover {
  background: var(--color-primary-alpha);
}

.reset-icon {
  width: 10px;
  height: 10px;
}

.filter-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input-icon {
  position: absolute;
  left: 10px;
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.filter-search-input {
  width: 100%;
  padding: 6px 10px 6px 28px;
  font-size: 0.75rem;
  background: var(--input-bg);
  border: 1px solid var(--border-glass-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  outline: none;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
}

.filter-categories-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-cat-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--input-bg);
  border: 1px solid var(--border-glass-subtle);
  color: var(--text-secondary);
  transition: all 0.2s ease;
  cursor: pointer;
}

.filter-cat-badge:hover {
  border-color: var(--color-primary-alpha);
  color: var(--text-primary);
}

.filter-cat-badge.active {
  background: var(--cat-color) !important;
  color: #fff !important;
  border-color: transparent !important;
}

.filter-priorities-row {
  display: flex;
  gap: 6px;
}

.filter-pri-btn {
  flex: 1;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 6px 0;
  border-radius: 6px;
  border: 1px solid;
  transition: all 0.2s ease;
  background: transparent;
  cursor: pointer;
  text-align: center;
}

.filter-pri-btn:hover {
  opacity: 0.8;
}

.filter-pri-btn.active {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
