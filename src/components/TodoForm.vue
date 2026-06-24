<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodos } from '../composables/useTodos'
import type { Category, Priority } from '../composables/useTodos'
import { 
  Plus, 
  Briefcase, 
  User, 
  Heart, 
  Lightbulb, 
  ShoppingCart, 
  Tag, 
  Calendar
} from 'lucide-vue-next'

const props = defineProps<{
  currentView: 'home' | 'backlog' | 'schedule' | 'dashboard'
}>()

const { todos, addTodo, addTask, addTaskFromTodo } = useTodos()

// --- View Mode computation ---
const viewMode = computed(() => {
  if (props.currentView === 'dashboard') return 'backlog'
  return props.currentView
})

// --- Floating Draggable FAB Console Logic ---
const posX = ref(0)
const posY = ref(0)
const isDragging = ref(false)
const isFormVisible = ref(false)

let startX = 0
let startY = 0
let initialX = 0
let initialY = 0
let hoverTimer: any = null

const startDrag = (event: MouseEvent) => {
  if (event.button !== 0) return
  
  isDragging.value = true
  startX = event.clientX
  startY = event.clientY
  initialX = posX.value
  initialY = posY.value

  document.addEventListener('mousemove', doDrag)
  document.addEventListener('mouseup', stopDrag)

  event.preventDefault()
}

const doDrag = (event: MouseEvent) => {
  if (!isDragging.value) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  posX.value = initialX + dx
  posY.value = initialY + dy
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', doDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const showForm = () => {
  if (hoverTimer) clearTimeout(hoverTimer)
  isFormVisible.value = true
}

const hideForm = () => {
  hoverTimer = setTimeout(() => {
    isFormVisible.value = false
  }, 250)
}

// --- Form fields ---
const title = ref('')
const description = ref('')
const priority = ref<Priority>('medium')
const category = ref<Category>('work')
const dueDate = ref('')

// Direct task fields
const taskDate = ref(new Date().toISOString().split('T')[0])
const taskStartTime = ref('09:00')
const taskEndTime = ref('10:00')

// Home view fields
const selectedTodoId = ref('')

const taskColor = ref('violet')

const colorsList = [
  { value: 'violet', label: '紫色', class: 'color-violet' },
  { value: 'blue', label: '蓝色', class: 'color-blue' },
  { value: 'emerald', label: '绿色', class: 'color-emerald' },
  { value: 'amber', label: '黄色', class: 'color-amber' },
  { value: 'rose', label: '红色', class: 'color-rose' },
  { value: 'cyan', label: '青色', class: 'color-cyan' }
]

const categories: { value: Category; label: string; icon: any; class: string }[] = [
  { value: 'work', label: '工作', icon: Briefcase, class: 'cat-work' },
  { value: 'personal', label: '生活', icon: User, class: 'cat-personal' },
  { value: 'fitness', label: '健康', icon: Heart, class: 'cat-fitness' },
  { value: 'ideas', label: '想法', icon: Lightbulb, class: 'cat-ideas' },
  { value: 'shopping', label: '购物', icon: ShoppingCart, class: 'cat-shopping' },
  { value: 'other', label: '其他', icon: Tag, class: 'cat-other' }
]

const priorities: { value: Priority; label: string; colorClass: string }[] = [
  { value: 'low', label: '低', colorClass: 'prio-low' },
  { value: 'medium', label: '中', colorClass: 'prio-med' },
  { value: 'high', label: '高', colorClass: 'prio-high' }
]

const backlogTodos = computed(() => {
  return todos.value.filter(t => !t.completed)
})

const popoverTitle = computed(() => {
  const mode = viewMode.value
  if (mode === 'backlog') return '新建待办事项'
  if (mode === 'schedule') return '直接创建日程任务'
  if (mode === 'home') return '从待办库安排日程'
  return '新建待办'
})

const isSubmitDisabled = computed(() => {
  const mode = viewMode.value
  if (mode === 'backlog') {
    return !title.value.trim()
  } else if (mode === 'schedule') {
    return !title.value.trim() || !taskDate.value || !taskStartTime.value || !taskEndTime.value
  } else if (mode === 'home') {
    return !selectedTodoId.value || !taskDate.value || !taskStartTime.value || !taskEndTime.value
  }
  return true
})

const handleSubmit = async () => {
  const mode = viewMode.value
  if (mode === 'backlog') {
    if (!title.value.trim()) return
    await addTodo({
      title: title.value.trim(),
      description: description.value.trim(),
      priority: priority.value,
      category: category.value,
      dueDate: dueDate.value || undefined
    })
    title.value = ''
    description.value = ''
    priority.value = 'medium'
    category.value = 'work'
    dueDate.value = ''
  } else if (mode === 'schedule') {
    if (!title.value.trim() || !taskDate.value || !taskStartTime.value || !taskEndTime.value) return
    await addTask({
      title: title.value.trim(),
      description: description.value.trim(),
      priority: 'medium',
      category: 'other',
      date: taskDate.value,
      startTime: taskStartTime.value,
      endTime: taskEndTime.value,
      color: taskColor.value
    })
    title.value = ''
    description.value = ''
    taskDate.value = new Date().toISOString().split('T')[0]
    taskStartTime.value = '09:00'
    taskEndTime.value = '10:00'
    taskColor.value = 'violet'
  } else if (mode === 'home') {
    if (!selectedTodoId.value || !taskDate.value || !taskStartTime.value || !taskEndTime.value) return
    await addTaskFromTodo(selectedTodoId.value, taskDate.value, taskStartTime.value, taskEndTime.value, taskColor.value)
    selectedTodoId.value = ''
    taskDate.value = new Date().toISOString().split('T')[0]
    taskStartTime.value = '09:00'
    taskEndTime.value = '10:00'
    taskColor.value = 'violet'
  }
  isFormVisible.value = false
}
</script>

<template>
  <div 
    class="floating-widget-wrapper"
    :style="{ transform: `translate3d(${posX}px, ${posY}px, 0)` }"
    :class="{ 'is-dragging': isDragging }"
  >
    <!-- 1. Draggable FAB Circle Button -->
    <button 
      type="button"
      class="fab-btn pulse-hover"
      @mousedown="startDrag"
      @mouseenter="showForm"
      @mouseleave="hideForm"
      title="按住拖动 / 悬浮新建规划"
    >
      <Plus class="fab-icon" />
    </button>

    <!-- 2. Square Popover Form Card -->
    <Transition name="popover-fade">
      <div 
        v-show="isFormVisible"
        class="floating-form-card glass-panel"
        @mouseenter="showForm"
        @mouseleave="hideForm"
      >
        <div class="popover-header">
          <span class="popover-title">{{ popoverTitle }}</span>
        </div>

        <form @submit.prevent="handleSubmit" class="todo-form">
          <!-- A. BACKLOG MODE -->
          <template v-if="viewMode === 'backlog'">
            <div class="field-group">
              <input 
                type="text" 
                v-model="title" 
                placeholder="你想做些什么？" 
                class="title-input"
                required
              />
            </div>

            <div class="field-group">
              <textarea 
                v-model="description" 
                placeholder="添加描述（可选）..." 
                rows="2"
                class="desc-textarea"
              ></textarea>
            </div>

            <div class="field-group">
              <label class="field-label">分类</label>
              <div class="category-selectors">
                <button
                  v-for="cat in categories"
                  :key="cat.value"
                  type="button"
                  class="cat-select-btn"
                  :class="[cat.class, { 'selected': category === cat.value }]"
                  @click="category = cat.value"
                >
                  <component :is="cat.icon" class="cat-icon" />
                  <span>{{ cat.label }}</span>
                </button>
              </div>
            </div>

            <div class="dual-row">
              <div class="field-group flex-1">
                <label class="field-label">优先级</label>
                <div class="priority-selectors">
                  <button
                    v-for="prio in priorities"
                    :key="prio.value"
                    type="button"
                    class="prio-select-btn"
                    :class="[prio.colorClass, { 'selected': priority === prio.value }]"
                    @click="priority = prio.value"
                  >
                    {{ prio.label }}
                  </button>
                </div>
              </div>

              <div class="field-group flex-1">
                <label class="field-label">截止日期</label>
                <div class="date-input-wrapper">
                  <Calendar class="input-inner-icon" />
                  <input 
                    type="date" 
                    v-model="dueDate" 
                    class="date-input"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- B. SCHEDULE MODE -->
          <template v-else-if="viewMode === 'schedule'">
            <div class="field-group">
              <input 
                type="text" 
                v-model="title" 
                placeholder="日程任务名称..." 
                class="title-input"
                required
              />
            </div>

            <div class="field-group">
              <textarea 
                v-model="description" 
                placeholder="添加日程描述（可选）..." 
                rows="2"
                class="desc-textarea"
              ></textarea>
            </div>

            <div class="field-group">
              <label class="field-label">安排日期</label>
              <div class="date-input-wrapper">
                <Calendar class="input-inner-icon" />
                <input type="date" v-model="taskDate" class="date-input" required />
              </div>
            </div>

            <div class="dual-row">
              <div class="field-group flex-1">
                <label class="field-label">开始时间</label>
                <input type="time" v-model="taskStartTime" class="time-input" required />
              </div>
              <div class="field-group flex-1">
                <label class="field-label">结束时间</label>
                <input type="time" v-model="taskEndTime" class="time-input" required />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">卡片颜色</label>
              <div class="color-selectors">
                <button
                  v-for="c in colorsList"
                  :key="c.value"
                  type="button"
                  class="color-dot-btn"
                  :class="[c.class, { 'selected': taskColor === c.value }]"
                  @click="taskColor = c.value"
                  :title="c.label"
                ></button>
              </div>
            </div>
          </template>

          <!-- C. HOME MODE -->
          <template v-else-if="viewMode === 'home'">
            <div class="field-group">
              <label class="field-label">选择待办模板</label>
              <div v-if="backlogTodos.length === 0" class="empty-select-tip">
                待办任务池为空，请先在【待办】页面创建模板。
              </div>
              <select v-else v-model="selectedTodoId" class="todo-select-dropdown" required>
                <option value="" disabled selected>-- 请选择一个待办项 --</option>
                <option v-for="t in backlogTodos" :key="t.id" :value="t.id">
                  {{ t.title }}
                </option>
              </select>
            </div>

            <div class="field-group">
              <label class="field-label">安排日期</label>
              <div class="date-input-wrapper">
                <Calendar class="input-inner-icon" />
                <input type="date" v-model="taskDate" class="date-input" required />
              </div>
            </div>

            <div class="dual-row">
              <div class="field-group flex-1">
                <label class="field-label">开始时间</label>
                <input type="time" v-model="taskStartTime" class="time-input" required />
              </div>
              <div class="field-group flex-1">
                <label class="field-label">结束时间</label>
                <input type="time" v-model="taskEndTime" class="time-input" required />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">卡片颜色</label>
              <div class="color-selectors">
                <button
                  v-for="c in colorsList"
                  :key="c.value"
                  type="button"
                  class="color-dot-btn"
                  :class="[c.class, { 'selected': taskColor === c.value }]"
                  @click="taskColor = c.value"
                  :title="c.label"
                ></button>
              </div>
            </div>
          </template>

          <!-- Actions Footer -->
          <div class="form-actions-footer">
            <button 
              type="submit" 
              class="submit-btn" 
              :disabled="isSubmitDisabled"
              :class="{ 'active': !isSubmitDisabled }"
            >
              <Plus class="btn-icon" />
              <span>
                {{ 
                  viewMode === 'backlog' ? '保存待办' : 
                  viewMode === 'schedule' ? '直接创建日程' : '确认为日程' 
                }}
              </span>
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.floating-widget-wrapper {
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 100;
  transition: opacity 0.2s ease;
}

.floating-widget-wrapper.is-dragging {
  opacity: 0.95;
}

.fab-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 8px 32px rgba(124, 58, 237, 0.35), 
              inset 0 2px 4px rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 12px 40px rgba(124, 58, 237, 0.45), 
              inset 0 2px 4px rgba(255, 255, 255, 0.4);
}

.fab-btn:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.fab-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.3s ease;
}

.fab-btn:hover .fab-icon {
  transform: rotate(90deg);
}

/* Floating Form Card popover */
.floating-form-card {
  position: absolute;
  right: 72px; /* Place left of the fab button */
  bottom: -15px; /* Organic side hover placement */
  width: 350px;
  padding: 20px;
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(124, 58, 237, 0.25);
  background: var(--bg-glass-solid);
  backdrop-filter: blur(20px);
  z-index: 99;
}

.popover-header {
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border-glass-subtle);
}

.popover-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.todo-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title-input {
  width: 100%;
  border-radius: 10px;
  font-weight: 500;
  font-size: 0.95rem;
  border-color: var(--border-glass);
}

.desc-textarea {
  resize: vertical;
  width: 100%;
  min-height: 50px;
  font-size: 0.85rem;
  line-height: 1.4;
  border-radius: 10px;
}

.field-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.category-selectors {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cat-select-btn {
  padding: 6px 10px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--input-bg);
  border: 1px solid var(--border-glass-subtle);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cat-select-btn:hover {
  background: var(--card-hover-bg);
}

.cat-select-btn.selected {
  background: var(--cat-bg);
  color: var(--cat-color);
  border-color: var(--cat-color);
}

.cat-icon {
  width: 12px;
  height: 12px;
}

.dual-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.flex-1 {
  flex: 1;
}

.priority-selectors {
  display: flex;
  gap: 4px;
  background: var(--input-bg);
  padding: 2px;
  border-radius: 10px;
  border: 1px solid var(--border-glass);
}

.prio-select-btn {
  flex: 1;
  padding: 6px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
}

.prio-select-btn:hover {
  background: var(--card-hover-bg);
}

.prio-select-btn.selected.prio-low {
  background: var(--color-info-alpha);
  color: var(--color-info);
}

.prio-select-btn.selected.prio-med {
  background: var(--color-warning-alpha);
  color: var(--color-warning);
}

.prio-select-btn.selected.prio-high {
  background: var(--color-danger-alpha);
  color: var(--color-danger);
}

.date-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-inner-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.date-input {
  width: 100%;
  padding-left: 32px;
  font-size: 0.78rem !important;
  height: 34px !important;
}

.time-input {
  padding: 8px 12px;
  font-size: 0.85rem;
  border-radius: 10px;
  background: var(--input-bg);
  border: 1px solid var(--border-glass);
  color: var(--text-primary);
  outline: none;
  height: 38px;
  width: 100%;
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

.form-actions-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--border-glass-subtle);
  padding-top: 10px;
  margin-top: 4px;
}

.submit-btn {
  background: var(--border-glass);
  color: var(--text-secondary);
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.submit-btn.active {
  background: var(--color-primary);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
}

.submit-btn.active:hover {
  background: var(--color-primary-light);
  transform: translateY(-1px);
}

.btn-icon {
  width: 14px;
  height: 14px;
}

/* Easing Elastic popover animation */
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: all 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: scale(0.85) translate3d(24px, 15px, 0);
}
</style>
