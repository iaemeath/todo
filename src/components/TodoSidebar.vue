<template>
  <aside class="todo-sidebar glass-panel">

      <div class="sidebar-header">
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
          <h2>待办</h2>
        </div>
        <!-- 关闭（与 FC 工具条右端 todo-toggle 同效：web 收侧栏 / 移动关浮层） -->
        <button class="btn-close" @click="closeSidebar" title="关闭待办">
          <X class="icon-sm" />
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
import { Plus, GripVertical, Trash2, X } from 'lucide-vue-next'
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
    const now = Date.now()
    ;[...val, ...hidden].forEach((t, i) => {
      if (t.order === i) return
      t.order = i
      // order 是记录内容的一部分：必须重打修订时间，否则对端按 revTime 裁决会忽略重排
      t.revTime = now
    })
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

// 头部关闭按钮（与 FC 工具条右端 todo-toggle 同效）
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

/* 移动端浮层贴屏幕右缘（App.vue 主页出血后）：右缘圆角/边框拉平为通栏，左缘保留圆角 */
html.platform-mobile .todo-sidebar {
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  border-right: none;
}

/* 头部带与 FC 工具条同构（CalendarArea .calendar-toolbar 同一 calc 定高）：
   border-top（同灰色）从面板顶延伸不露白。padding-bottom 与工具条同步——
   抵消 12px 顶边 / 1px 底边不对称造成的整体偏下，使内容对齐整条灰带视觉中心 */
.sidebar-header {
  border-top: var(--space-md) solid var(--el-fill-color-light);
  height: calc(44px + var(--space-md) + 1px); /* 桌面 57 / 移动 53，与工具条严格相等 */
  padding: 0 var(--space-lg) calc(var(--space-md) - 1px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.sidebar-header h2 {
  font-size: var(--font-md);
  font-weight: var(--weight-semibold);
  margin: 0;
  color: var(--text-primary);
}

.add-todo-form {
  padding: var(--space-sm);
  display: flex;
  gap: var(--space-sm);
  border-bottom: 1px solid var(--border-glass-subtle);
}

.glass-input {
  width: 70%;
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  font-size: var(--font-sm);
  outline: none;
  transition: all var(--duration-fast);
}

.glass-input:focus {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

/* 面板内图标（lucide 未传 size 默认 24）：统一 20px，与 FC 工具条按钮图标等重 */
.icon-sm {
  width: 20px;
  height: 20px;
}

/* 面板按钮统一形态（与 FC 工具条按钮同族）：透明底、无边框、
   radius-md、hover 语义色底。触控热区两套：移动端紧凑 32px（WCAG 2.5.8 AA ≥24），
   桌面 var(--touch-target)（36） */
.btn-add,
.btn-delete,
.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  min-width: 32px;
  min-height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

@media (width >= 769px) {
  .btn-add,
  .btn-delete,
  .btn-close {
    min-width: var(--touch-target);
    min-height: var(--touch-target);
  }
}

/* 新增是表单主操作：表单区非灰带背景，ghost 对比不足，恢复实色主按钮 */
.btn-add {
  background: var(--color-primary);
  color: white;
}

.btn-add:hover {
  background: var(--color-primary-light);
}

.todo-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
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
  font-size: var(--font-sm);
  margin-top: var(--space-xl);
}

/* 卡片行高两套：移动端紧凑（4px 纵向内边距 + 4px 间距，配合 32px 按钮热区压低行高；
   左右内边距为 0——把手/删除按钮自身已居中留白，省下的宽度全给标题），
   桌面舒展（8px 内边距 + 36px 热区） */
.todo-item {
  display: flex;
  align-items: center;
  padding: var(--space-xs) 0;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--border-glass);
  gap: var(--space-xs);
  cursor: grab;
  transition: all var(--duration-fast) ease;
}

@media (width >= 769px) {
  .todo-item {
    padding: var(--space-sm);
    gap: var(--space-sm);
  }
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
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
  color: var(--text-secondary);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 行内图标按钮（删除/关闭）已并入上方统一形态组，仅保留各自的语义色 hover */
.btn-delete:hover {
  background: rgb(244 63 94 / 10%);
  color: var(--color-danger);
}

.btn-close:hover {
  background: var(--color-primary-alpha);
  color: var(--color-primary);
}

</style>
