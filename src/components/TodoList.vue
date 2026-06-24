<script setup lang="ts">
import { useTodos } from '../composables/useTodos'
import type { Category, Priority } from '../composables/useTodos'
import TodoItem from './TodoItem.vue'
import { 
  Search, 
  ArrowUpDown, 
  Trash2, 
  Inbox, 
  Filter, 
  Sparkles,
  Briefcase, 
  User, 
  Heart, 
  Lightbulb, 
  ShoppingCart, 
  Tag
} from 'lucide-vue-next'

const {
  todos,
  searchQuery,
  selectedCategory,
  selectedPriority,
  selectedStatus,
  sortBy,
  filteredTodos,
  clearCompleted
} = useTodos()

const categories: { value: Category | 'all'; label: string; icon?: any }[] = [
  { value: 'all', label: '全部' },
  { value: 'work', label: '工作', icon: Briefcase },
  { value: 'personal', label: '生活', icon: User },
  { value: 'fitness', label: '健康', icon: Heart },
  { value: 'ideas', label: '想法', icon: Lightbulb },
  { value: 'shopping', label: '购物', icon: ShoppingCart },
  { value: 'other', label: '其他', icon: Tag }
]

const priorities: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: '全部优先级' },
  { value: 'high', label: '紧急 (高)' },
  { value: 'medium', label: '常规 (中)' },
  { value: 'low', label: '低' }
]

const statuses: { value: 'all' | 'active' | 'completed'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' }
]

const hasCompletedTodos = () => {
  return todos.value.some(t => t.completed)
}
</script>

<template>
  <div class="todo-list-container">
    
    <!-- Controls Panel (Filters, Search, Sort) -->
    <div class="controls-panel glass-panel">
      <!-- Search & Status Selector Row -->
      <div class="search-status-row">
        <!-- Search bar -->
        <div class="search-box">
          <Search class="search-icon" />
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜索待办任务..." 
            class="search-input"
          />
        </div>

        <!-- Status selector buttons -->
        <div class="status-tabs">
          <button
            v-for="status in statuses"
            :key="status.value"
            type="button"
            class="status-tab"
            :class="{ 'active': selectedStatus === status.value }"
            @click="selectedStatus = status.value"
          >
            {{ status.label }}
          </button>
        </div>
      </div>

      <!-- Scrollable Category Tabs -->
      <div class="category-scroll-container">
        <div class="category-tabs">
          <button
            v-for="cat in categories"
            :key="cat.value"
            type="button"
            class="category-tab"
            :class="{ 'active': selectedCategory === cat.value }"
            @click="selectedCategory = cat.value"
          >
            <component 
              v-if="cat.icon" 
              :is="cat.icon" 
              class="tab-icon"
            />
            <span>{{ cat.label }}</span>
          </button>
        </div>
      </div>

      <!-- Advanced Sorting & Filtering Toolbar -->
      <div class="advanced-toolbar">
        <!-- Priority Filter -->
        <div class="toolbar-item">
          <Filter class="toolbar-icon" />
          <select v-model="selectedPriority" class="select-minimal">
            <option 
              v-for="prio in priorities" 
              :key="prio.value" 
              :value="prio.value"
            >
              {{ prio.label }}
            </option>
          </select>
        </div>

        <!-- Sort By -->
        <div class="toolbar-item">
          <ArrowUpDown class="toolbar-icon" />
          <select v-model="sortBy" class="select-minimal">
            <option value="createdAt">创建时间</option>
            <option value="dueDate">截止日期</option>
            <option value="priority">优先级</option>
          </select>
        </div>

        <!-- Clear Completed -->
        <button 
          v-if="hasCompletedTodos()" 
          @click="clearCompleted" 
          class="clear-btn text-danger"
          title="清除所有已完成任务"
        >
          <Trash2 class="clear-icon" />
          <span>清除已完成</span>
        </button>
      </div>
    </div>

    <!-- Active Tasks Count info -->
    <div class="list-meta-info" v-if="filteredTodos.length > 0">
      <span>已筛选出 {{ filteredTodos.length }} 项待办</span>
    </div>

    <!-- Todo Cards List Grid with smooth transitions -->
    <div class="todo-grid-wrapper">
      <TransitionGroup name="list" tag="div" class="todo-grid">
        <TodoItem 
          v-for="todo in filteredTodos" 
          :key="todo.id" 
          :todo="todo" 
        />
      </TransitionGroup>

      <!-- Empty State Displays -->
      <Transition name="fade">
        <div class="empty-state glass-panel" v-if="filteredTodos.length === 0">
          <div class="empty-graphic">
            <Inbox class="empty-icon" />
            <Sparkles class="sparkle-icon" />
          </div>
          <h3>没有找到待办事项</h3>
          <p v-if="todos.length === 0">创建一个新的待办事项，开始您高效的一天吧！</p>
          <p v-else>当前筛选条件或搜索结果为空，尝试调整上面的过滤器。</p>
        </div>
      </Transition>
    </div>

  </div>
</template>

<style scoped>
.todo-list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.controls-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Row 1: Search and Status tabs */
.search-status-row {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  width: 18px;
  height: 18px;
}

.search-input {
  width: 100%;
  padding-left: 42px;
}

.status-tabs {
  display: flex;
  background: var(--input-bg);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-glass);
}

.status-tab {
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border-radius: 8px;
}

.status-tab:hover {
  color: var(--text-primary);
}

.status-tab.active {
  background: var(--bg-glass-solid);
  color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

/* Category horizontal scrolls */
.category-scroll-container {
  overflow-x: auto;
  margin: 0 -4px;
  padding: 4px 4px 6px;
  scrollbar-width: thin;
}

.category-tabs {
  display: flex;
  gap: 8px;
  width: max-content;
}

.category-tab {
  padding: 8px 14px;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--input-bg);
  border: 1px solid var(--border-glass-subtle);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.category-tab:hover {
  background: var(--card-hover-bg);
  color: var(--text-primary);
}

.category-tab.active {
  background: var(--color-primary-alpha);
  color: var(--color-primary);
  border-color: var(--color-primary-light);
}

.tab-icon {
  width: 12px;
  height: 12px;
}

/* Advanced filter bar */
.advanced-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  border-top: 1px solid var(--border-glass-subtle);
  padding-top: 14px;
  flex-wrap: wrap;
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-icon {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
}

.select-minimal {
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.select-minimal:hover {
  background: var(--border-glass-subtle);
  color: var(--text-primary);
}

.clear-btn {
  margin-left: auto;
  font-size: 0.8rem;
  padding: 6px 12px;
  border-radius: 8px;
  background: transparent;
}

.clear-btn:hover {
  background: var(--color-danger-alpha);
  transform: translateY(-1px);
}

.clear-icon {
  width: 14px;
  height: 14px;
}

/* List counts metadata */
.list-meta-info {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-left: 4px;
}

/* Grids of Todos */
.todo-grid-wrapper {
  position: relative;
}

.todo-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Empty State visual */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 12px;
  margin-top: 10px;
}

.empty-graphic {
  position: relative;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
}

.sparkle-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  color: var(--color-warning);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.1); }
}

.empty-state h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.empty-state p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  max-width: 320px;
  line-height: 1.5;
}

/* Fades animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
