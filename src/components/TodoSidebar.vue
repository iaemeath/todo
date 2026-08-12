<template>
  <aside class="todo-sidebar glass-panel">

      <div class="sidebar-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h2>待办</h2>
          <span class="count-badge">{{ activeTodos.length }}</span>
        </div>
      </div>

      <!-- Add Todo Input -->
    <form @submit.prevent="handleCreateTodo" class="add-todo-form">
      <input
        v-model="newTodoTitle"
        type="text"
        placeholder="添加新待办..."
        class="glass-input"
      />
      <button type="submit" class="btn-add">
        <Plus class="icon-sm" />
      </button>
    </form>

    <!-- Draggable Todo List -->
    <draggable 
      v-model="activeTodos" 
      item-key="id" 
      class="todo-list" 
      ref="draggableContainer"
      handle=".drag-handle"
      ghost-class="ghost-todo"
      :animation="200"
    >
      <template #item="{ element: todo }">
        <div class="todo-item glass-card">
          <!-- SortableJS Handle -->
          <div class="drag-handle" title="上下拖拽排序">
            <GripVertical class="icon-sm" />
          </div>
          
          <!-- FullCalendar Draggable Target -->
          <div 
            class="todo-content draggable-event" 
            title="往左侧拖拽进行排期"
            :data-event="JSON.stringify({
              title: todo.title,
              id: todo.id,
              taskId: todo.id,
              color: 'blue'
            })"
          >
            <span class="todo-title">{{ todo.title }}</span>
          </div>

          <button class="btn-delete" @click="deleteTask(todo.id)" title="删除待办">
            <Trash2 class="icon-sm" />
          </button>
        </div>
      </template>
      
      <template #header v-if="activeTodos.length === 0">
        <p class="empty-state">目前没有待办事项</p>
      </template>
    </draggable>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Plus, GripVertical, Trash2 } from 'lucide-vue-next'
import { useTasks } from '../composables/useTasks'
import { Draggable } from '@fullcalendar/interaction'
import draggable from 'vuedraggable'

const { leafTasks, addTask, deleteTask } = useTasks()

const newTodoTitle = ref('')
const draggableContainer = ref<any>(null)
let fcDraggableInstance: Draggable | null = null

const activeTodos = computed({
  get: () => leafTasks.value.filter(t => !t.completed),
  set: (val) => {
    // 仅重排这些可见的叶子任务的 order
    val.forEach((t, i) => { t.order = i })
  }
})

const handleCreateTodo = () => {
  if (!newTodoTitle.value.trim()) return
  addTask({
    title: newTodoTitle.value.trim(),
    description: '',
    category: 'other',
    priority: 'medium'
  })
  newTodoTitle.value = ''
}

onMounted(() => {
  // Use $el to get the DOM element from the vuedraggable component
  const containerEl = draggableContainer.value?.$el
  if (containerEl) {
    fcDraggableInstance = new Draggable(containerEl, {
      itemSelector: '.draggable-event',
      eventData: function(eventEl) {
        return JSON.parse(eventEl.getAttribute('data-event') || '{}')
      }
    })
  }
})

onUnmounted(() => {
  if (fcDraggableInstance) {
    fcDraggableInstance.destroy()
  }
})
</script>

<style scoped>
.todo-sidebar {
  width: 340px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--el-box-shadow-light);
  transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.sidebar-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.count-badge {
  background: var(--color-primary-alpha);
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
}

.add-todo-form {
  padding: 16px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border-glass-subtle);
}

.glass-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s;
}

.glass-input:focus {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.btn-add {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--color-primary);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover {
  background: var(--color-primary-light);
  transform: translateY(-1px);
}

.todo-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Custom scrollbar for todo list */
.todo-list::-webkit-scrollbar {
  width: 6px;
}
.todo-list::-webkit-scrollbar-track {
  background: transparent;
}
.todo-list::-webkit-scrollbar-thumb {
  background: var(--border-glass-subtle);
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 32px;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-glass);
  gap: 12px;
  cursor: grab;
  transition: all 0.2s ease;
}

.todo-item:hover {
  border-color: var(--color-primary-alpha);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.todo-item:active {
  cursor: grabbing;
}

.drag-handle {
  color: var(--text-muted);
  display: flex;
  align-items: center;
}

.todo-content {
  flex: 1;
  overflow: hidden;
}

.todo-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-delete {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: rgba(244, 63, 94, 0.1);
  color: var(--color-danger);
}
</style>
