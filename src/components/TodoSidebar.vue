<template>
  <aside class="todo-sidebar glass-panel">

      <div class="sidebar-header">
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
          <h2>待办</h2>
        </div>
        <button class="btn-collapse" @click="closeSidebar" title="收起待办栏">
          <PanelRightClose class="icon-sm" />
        </button>
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
            @pointerdown="onTodoPointerDown"
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

          <button class="btn-delete" @click="handleDelete(todo)" title="删除待办">
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
import { Plus, GripVertical, Trash2, PanelRightClose } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { useTaskStore, useUIStore, type Task } from '../stores'
import { Draggable } from '@fullcalendar/interaction'
import draggable from 'vuedraggable'

const taskStore = useTaskStore()
const { leafTasks } = storeToRefs(taskStore) // getter → storeToRefs
const { addTask, deleteTask } = taskStore // action 直接解构
const uiStore = useUIStore()
const { isMobile, mobileTodoDragging } = storeToRefs(uiStore) // state
const { setTodoVisible, setMobileTodoDragging } = uiStore // action

const newTodoTitle = ref('')
const draggableContainer = ref<any>(null)
let fcDraggableInstance: Draggable | null = null

const activeTodos = computed({
  get: () => leafTasks.value.filter(t => !t.completed),
  set: (val) => {
    // 重排只作用于可见（未完成）叶子；已完成的沉底保持相对顺序。
    // 若只给可见子集编号 0..n-1，完成→取消完成后 order 会与未重编号的混叠穿插
    const hidden = leafTasks.value.filter(t => t.completed)
    ;[...val, ...hidden].forEach((t, i) => { t.order = i })
  }
})

// 删除待办：与管理页一致，先确认（避免移动端误触，级联删关联日程）
const handleDelete = async (todo: Task) => {
  try {
    await ElMessageBox.confirm(
      `确定删除待办「${todo.title}」吗？其子任务和关联日程也会一并删除。`,
      '删除待办',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    deleteTask(todo.id)
  } catch {
    // cancelled
  }
}

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

// 移动端：位移超过阈值才视为拖拽（隐藏浮层供 FC 继续拖）。
// 若按下即置位，轻触/滚动列表也会闪透明并在松手时关掉浮层
const POINTER_SLOP = 5
let todoPointerStart: { x: number; y: number } | null = null
const onTodoPointerDown = (e: PointerEvent) => {
  if (!isMobile.value) return
  todoPointerStart = { x: e.clientX, y: e.clientY }
}
const onTodoPointerMove = (e: PointerEvent) => {
  if (!todoPointerStart || mobileTodoDragging.value) return
  if (
    Math.abs(e.clientX - todoPointerStart.x) > POINTER_SLOP ||
    Math.abs(e.clientY - todoPointerStart.y) > POINTER_SLOP
  ) {
    setMobileTodoDragging(true)
  }
}
// 拖拽结束（document pointerup/pointercancel/dragend）：无论成功失败都关闭待办，
// 避免失败后浮层卡在透明态、FAB 无法重现（成功落点由 eventReceive 也会关）。
// 未发生位移（轻触）不算拖拽，浮层保持
const onDragEnd = () => {
  todoPointerStart = null
  if (mobileTodoDragging.value) {
    setMobileTodoDragging(false)
    setTodoVisible(false)
  }
}
// 关闭待办（web 收起侧栏 = 移动关浮层，同一状态）
const closeSidebar = () => setTodoVisible(false)

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
  // 兜底：拖拽结束（含取消 pointercancel）关闭浮层，避免失败后卡死
  document.addEventListener('pointermove', onTodoPointerMove)
  document.addEventListener('pointerup', onDragEnd)
  document.addEventListener('pointercancel', onDragEnd)
  document.addEventListener('dragend', onDragEnd)
})

onUnmounted(() => {
  if (fcDraggableInstance) {
    fcDraggableInstance.destroy()
  }
  document.removeEventListener('pointermove', onTodoPointerMove)
  document.removeEventListener('pointerup', onDragEnd)
  document.removeEventListener('pointercancel', onDragEnd)
  document.removeEventListener('dragend', onDragEnd)
})
</script>

<style scoped>
/* 移动优先：基础样式 = 移动浮层场景（占满浮层宽，高度由父容器约束）；
   桌面专属的固定宽侧栏在 min-width 断点增强。
   间距/字号/圆角/触控目标全部走 theme.css 令牌——移动端紧凑值由
   html.platform-mobile 自动生效，本组件不再写平台媒体查询的数值覆盖。 */
.todo-sidebar {
  width: 100%;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--el-box-shadow-light);
  transition: width var(--duration-base) var(--ease-spring), opacity var(--duration-base) ease;
  flex: 1;
  min-height: 0;
}

/* 桌面：固定宽侧栏与主页日历并排（App.vue 的 :last-child 规则兜底 flex-shrink） */
@media (width >= 769px) {
  .todo-sidebar {
    width: 340px;
    flex: none;
    flex-shrink: 0;
  }
}

.sidebar-header {
  padding: var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.sidebar-header h2 {
  font-size: var(--font-md);
  font-weight: var(--weight-bold);
  margin: 0;
  color: var(--text-primary);
}

.add-todo-form {
  padding: var(--space-lg);
  display: flex;
  gap: var(--space-sm);
  border-bottom: 1px solid var(--border-glass-subtle);
}

.glass-input {
  width: 70%;
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  font-size: var(--font-base);
  outline: none;
  transition: all var(--duration-fast);
}

.glass-input:focus {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.btn-add {
  width: var(--touch-target);
  height: var(--touch-target);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-add:hover {
  background: var(--color-primary-light);
  transform: translateY(-1px);
}

.todo-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
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
  border-radius: 4px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 滚动条微调特例 */
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-base);
  margin-top: var(--space-xl);
}

.todo-item {
  display: flex;
  align-items: center;
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-glass);
  gap: var(--space-md);
  cursor: grab;
  transition: all var(--duration-fast) ease;
}

.todo-item:hover {
  border-color: var(--color-primary-alpha);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
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

  /* 移动端：让 FullCalendar 接管触摸拖拽，阻止浏览器滚动抢占 touch 事件 */
  touch-action: none;
}

.todo-title {
  font-size: var(--font-base);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 行内图标按钮：视觉紧凑但热区满足触控目标令牌（web 36 / 移动 44） */
.btn-delete,
.btn-collapse {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-xs);
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.btn-delete:hover {
  background: rgb(244 63 94 / 10%);
  color: var(--color-danger);
}

.btn-collapse:hover {
  background: var(--color-primary-alpha);
  color: var(--color-primary);
}
</style>
