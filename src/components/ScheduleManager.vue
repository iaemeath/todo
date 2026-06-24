<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodos } from '../composables/useTodos'
import type { Task } from '../composables/useTodos'
import TodoItem from './TodoItem.vue'
import { CalendarDays, Calendar, Inbox, Search } from 'lucide-vue-next'

const { tasks, loading } = useTodos()

// Filters state
const searchQuery = ref('')
const selectedDate = ref('')

// Filtered tasks based on search and date
const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    // 1. Search Query filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const titleMatch = task.title.toLowerCase().includes(q)
      const descMatch = task.description?.toLowerCase().includes(q) || false
      if (!titleMatch && !descMatch) return false
    }

    // 2. Date filter
    if (selectedDate.value && task.date !== selectedDate.value) return false

    return true
  })
})

// Group tasks by date, sorted chronologically
const groupedTasks = computed(() => {
  const groups: Record<string, Task[]> = {}
  
  // Sort tasks by date and start time first
  const sortedTasks = [...filteredTasks.value].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date)
    if (dateComp !== 0) return dateComp
    return a.startTime.localeCompare(b.startTime)
  })

  for (const task of sortedTasks) {
    if (!groups[task.date]) {
      groups[task.date] = []
    }
    groups[task.date].push(task)
  }

  // Convert to sorted array
  return Object.keys(groups)
    .sort()
    .map(date => {
      const dateObj = new Date(date)
      const todayStr = new Date().toISOString().split('T')[0]
      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      
      let dateLabel = date
      if (date === todayStr) dateLabel = '今天'
      else if (date === tomorrowStr) dateLabel = '明天'
      
      return {
        date,
        label: dateLabel,
        formattedDate: `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`,
        items: groups[date]
      }
    })
})
</script>

<template>
  <div class="schedule-manager">
    
    <!-- Controls Panel (Filters, Search, Date) -->
    <div class="controls-panel glass-panel">
      <!-- Search Row -->
      <div class="search-status-row">
        <!-- Search bar -->
        <div class="search-box">
          <Search class="search-icon" />
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜索日程任务..." 
            class="search-input"
          />
        </div>
      </div>

      <!-- Advanced Toolbar (Date Filter) -->
      <div class="advanced-toolbar">
        <div class="toolbar-item">
          <CalendarDays class="toolbar-icon" />
          <span class="toolbar-label">按日期筛选:</span>
          <input 
            type="date" 
            v-model="selectedDate" 
            class="date-filter-input"
          />
        </div>
        
        <button 
          v-if="selectedDate"
          @click="selectedDate = ''"
          class="clear-date-btn"
          title="清除日期筛选"
        >
          清除筛选
        </button>
      </div>
    </div>

    <!-- Grouped Agenda List -->
    <div class="agenda-area">
      <div v-if="loading" class="loading-state">
        <span>同步数据中...</span>
      </div>

      <template v-else-if="groupedTasks.length > 0">
        <div 
          v-for="group in groupedTasks" 
          :key="group.date"
          class="agenda-group glass-panel"
        >
          <!-- Date group header -->
          <div class="group-header">
            <Calendar class="group-header-icon" />
            <span class="group-day-lbl">{{ group.label }}</span>
            <span class="group-date-lbl">{{ group.formattedDate }}</span>
            <span class="group-count">{{ group.items.length }} 个日程</span>
          </div>

          <!-- Tasks list in this day -->
          <div class="group-items">
            <TodoItem 
              v-for="task in group.items" 
              :key="task.id" 
              :todo="task" 
              :compact="true"
              :is-task="true"
              class="agenda-todo-card"
            />
          </div>
        </div>
      </template>

      <!-- Empty scheduled state -->
      <div v-else class="empty-state glass-panel">
        <Inbox class="empty-icon" />
        <h3>当前暂无日程规划</h3>
        <p v-if="tasks.length === 0">可以使用屏幕右侧的悬浮【+】按钮，直接创建一个独立日程，或者前往【日程】页面安排待办。</p>
        <p v-else>没有找到符合当前筛选条件的日程任务，请尝试调整搜索词或重置日期筛选。</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.schedule-manager {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}

.toolbar-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.date-filter-input {
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--border-glass);
  outline: none;
}

.clear-date-btn {
  font-size: 0.8rem;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--border-glass);
  color: var(--text-secondary);
}

.clear-date-btn:hover {
  background: var(--color-danger-alpha);
  color: var(--color-danger);
}

/* Agenda list */
.agenda-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loading-state {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-weight: 500;
}

.agenda-group {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-glass);
  padding-bottom: 10px;
}

.group-header-icon {
  width: 16px;
  height: 16px;
  color: var(--color-primary-light);
}

.group-day-lbl {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.group-date-lbl {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.group-count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--border-glass);
  padding: 2px 8px;
  border-radius: 9999px;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Override compact card inside agenda to fill width without grid row span */
.agenda-todo-card {
  width: 100% !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  gap: 12px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
}

.empty-state h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.empty-state p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  max-width: 380px;
  line-height: 1.5;
}
</style>
