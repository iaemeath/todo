<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodos } from '../composables/useTodos'
import type { Todo, Task, Category } from '../composables/useTodos'
import { 
  Trash2, 
  Calendar, 
  Check, 
  Edit3, 
  X,
  Briefcase, 
  User, 
  Heart, 
  Lightbulb, 
  ShoppingCart, 
  Tag,
  AlertCircle,
  Clock
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    todo: Todo | Task
    compact?: boolean
    isTask?: boolean
    showPlanAction?: boolean
    hideActions?: boolean
    customStyle?: any
  }>(),
  {
    compact: false,
    isTask: false,
    showPlanAction: false,
    hideActions: false,
    customStyle: () => ({})
  }
)

const emit = defineEmits<{
  (e: 'plan', event: MouseEvent): void
}>()

const { 
  toggleTodo, deleteTodo, updateTodo,
  toggleTask, deleteTask, updateTask 
} = useTodos()

const isEditing = ref(false)
const editTitle = ref(props.todo.title)
const editDesc = ref(props.todo.description)
const editStartTime = ref(('startTime' in props.todo ? props.todo.startTime : '') || '')
const editEndTime = ref(('endTime' in props.todo ? props.todo.endTime : '') || '')
const editColor = ref(('color' in props.todo ? props.todo.color : '') || 'violet')

const colorsList = [
  { value: 'violet', label: '紫色', class: 'color-violet' },
  { value: 'blue', label: '蓝色', class: 'color-blue' },
  { value: 'emerald', label: '绿色', class: 'color-emerald' },
  { value: 'amber', label: '黄色', class: 'color-amber' },
  { value: 'rose', label: '红色', class: 'color-rose' },
  { value: 'cyan', label: '青色', class: 'color-cyan' }
]

// Available hours (06:00 to 24:00)
const availableHours = computed(() => {
  const hours = []
  for (let h = 6; h <= 24; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`)
  }
  return hours
})

// Category mapping helper
const categoriesMap: Record<Category, { label: string; icon: any; class: string }> = {
  work: { label: '工作', icon: Briefcase, class: 'cat-work' },
  personal: { label: '生活', icon: User, class: 'cat-personal' },
  fitness: { label: '健康', icon: Heart, class: 'cat-fitness' },
  ideas: { label: '想法', icon: Lightbulb, class: 'cat-ideas' },
  shopping: { label: '购物', icon: ShoppingCart, class: 'cat-shopping' },
  other: { label: '其他', icon: Tag, class: 'cat-other' }
}

const currentCategory = computed(() => {
  const cat = props.todo?.category
  return (cat && categoriesMap[cat]) ? categoriesMap[cat] : categoriesMap['other']
})

// Priority label mapping
const priorityLabels: Record<string, string> = {
  high: '紧急',
  medium: '常规',
  low: '低'
}

const safePriorityLabel = computed(() => {
  const prio = props.todo?.priority
  return (prio && priorityLabels[prio]) ? priorityLabels[prio] : '常规'
})

// Due Date computations
const dueDateStatus = computed(() => {
  // Backlog Todos might have dueDates (if we support it in schema), Tasks don't have direct dueDate fields (they have date)
  const dueDate = 'dueDate' in props.todo ? props.todo.dueDate : null
  if (!dueDate) return null
  
  const todayStr = new Date().toISOString().split('T')[0]
  const dueStr = dueDate

  if (props.todo.completed) return 'completed'

  if (dueStr < todayStr) {
    return 'overdue'
  } else if (dueStr === todayStr) {
    return 'today'
  }
  
  return 'future'
})

const hasDueDate = computed(() => {
  return 'dueDate' in props.todo && !!props.todo.dueDate
})

const formattedDueDate = computed(() => {
  const dueDate = ('dueDate' in props.todo ? props.todo.dueDate : null) as string | null
  if (!dueDate) return ''
  const [, month, day] = dueDate.split('-')
  return `${month}/${day}`
})

// Overrides during dragging/resizing
const customTopOverride = ref<number | null>(null)
const customHeightOverride = ref<number | null>(null)
const tempTimeRange = ref<string | null>(null)

const localStyle = computed(() => {
  const style = { ...(props.customStyle || {}) }
  if (customTopOverride.value !== null) {
    style.top = `${customTopOverride.value}px`
  }
  if (customHeightOverride.value !== null) {
    style.height = `${customHeightOverride.value}px`
  }
  return style
})

// taskTimeRange computed helper to safely render times in template without TS strict issues
const taskTimeRange = computed(() => {
  if (tempTimeRange.value) return tempTimeRange.value
  
  if (props.isTask && 'startTime' in props.todo) {
    return `${props.todo.startTime} - ${props.todo.endTime || '结束'}`
  }
  return null
})

// --- Resize Drag Handle Logic (5-min intervals) ---
const minsToTimeStr = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const timeStrToMins = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

let isResizing = false
let resizeDir: 'top' | 'bottom' = 'bottom'
let initialStartY = 0
let initialStartMins = 0
let initialEndMins = 0
let initialTopPx = 0
let initialHeightPx = 0

const startResize = (dir: 'top' | 'bottom', event: MouseEvent) => {
  event.stopPropagation()
  event.preventDefault()

  isResizing = true
  resizeDir = dir
  initialStartY = event.clientY

  const startTimeStr = ('startTime' in props.todo ? props.todo.startTime : '') || '09:00'
  const endTimeStr = ('endTime' in props.todo ? props.todo.endTime : '') || '10:00'

  initialStartMins = timeStrToMins(startTimeStr)
  initialEndMins = timeStrToMins(endTimeStr)

  const pixelsPerMinute = 50 / 60
  initialTopPx = (initialStartMins - 360) * pixelsPerMinute
  initialHeightPx = (initialEndMins - initialStartMins) * pixelsPerMinute

  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
}

const doResize = (event: MouseEvent) => {
  if (!isResizing) return

  const dy = event.clientY - initialStartY
  const pixelsPerMinute = 50 / 60

  if (resizeDir === 'bottom') {
    // Modify end time
    const deltaMins = Math.round((dy / pixelsPerMinute) / 5) * 5
    let newEndMins = initialEndMins + deltaMins
    newEndMins = Math.max(initialStartMins + 15, Math.min(1440, newEndMins))
    
    customHeightOverride.value = (newEndMins - initialStartMins) * pixelsPerMinute
    tempTimeRange.value = `${minsToTimeStr(initialStartMins)} - ${minsToTimeStr(newEndMins)}`
  } else {
    // Modify start time
    const deltaMins = Math.round((dy / pixelsPerMinute) / 5) * 5
    let newStartMins = initialStartMins + deltaMins
    newStartMins = Math.max(360, Math.min(initialEndMins - 15, newStartMins))
    
    customTopOverride.value = (newStartMins - 360) * pixelsPerMinute
    customHeightOverride.value = (initialEndMins - newStartMins) * pixelsPerMinute
    tempTimeRange.value = `${minsToTimeStr(newStartMins)} - ${minsToTimeStr(initialEndMins)}`
  }
}

const stopResize = async () => {
  if (!isResizing) return
  isResizing = false

  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)

  const pixelsPerMinute = 50 / 60
  let finalStartMins = initialStartMins
  let finalEndMins = initialEndMins

  if (resizeDir === 'bottom' && customHeightOverride.value !== null) {
    const deltaMins = Math.round(((customHeightOverride.value - initialHeightPx) / pixelsPerMinute) / 5) * 5
    finalEndMins = Math.max(initialStartMins + 15, Math.min(1440, initialEndMins + deltaMins))
  } else if (resizeDir === 'top' && customTopOverride.value !== null) {
    const currentTop = customTopOverride.value
    const deltaMins = Math.round(((currentTop - initialTopPx) / pixelsPerMinute) / 5) * 5
    finalStartMins = Math.max(360, Math.min(initialEndMins - 15, initialStartMins + deltaMins))
  }

  const startTime = minsToTimeStr(finalStartMins)
  const endTime = minsToTimeStr(finalEndMins)

  if (props.isTask) {
    await updateTask(props.todo.id, {
      startTime,
      endTime
    })
  }

  customTopOverride.value = null
  customHeightOverride.value = null
  tempTimeRange.value = null
}

// Actions
const handleToggle = () => {
  if (props.isTask) {
    toggleTask(props.todo.id)
  } else {
    toggleTodo(props.todo.id)
  }
}

const handleDelete = () => {
  if (props.isTask) {
    deleteTask(props.todo.id)
  } else {
    deleteTodo(props.todo.id)
  }
}

const handleStartEdit = () => {
  editTitle.value = props.todo.title
  editDesc.value = props.todo.description
  editStartTime.value = ('startTime' in props.todo ? props.todo.startTime : '') || ''
  editEndTime.value = ('endTime' in props.todo ? props.todo.endTime : '') || ''
  editColor.value = ('color' in props.todo ? props.todo.color : '') || 'violet'
  isEditing.value = true
}

const handleCancelEdit = () => {
  isEditing.value = false
}

const handleSave = () => {
  if (!editTitle.value.trim()) return
  
  const updates: any = {
    title: editTitle.value.trim(),
    description: editDesc.value.trim()
  }

  if (props.compact) {
    if (editStartTime.value) {
      updates.startTime = editStartTime.value
      // Check end time sanity
      if (editEndTime.value && editEndTime.value > editStartTime.value) {
        updates.endTime = editEndTime.value
      } else {
        const hour = parseInt(editStartTime.value.split(':')[0])
        const nextHour = Math.min(hour + 1, 24)
        updates.endTime = `${String(nextHour).padStart(2, '0')}:00`
      }
    } else {
      updates.startTime = undefined
      updates.endTime = undefined
    }
  }

  if (props.isTask) {
    updates.color = editColor.value
    updateTask(props.todo.id, updates)
  } else {
    updateTodo(props.todo.id, updates)
  }
  isEditing.value = false
}

</script>

<template>
  <div 
    class="todo-item glass-card" 
    :class="[
      isTask ? ('task-color-' + (('color' in todo ? todo.color : '') || 'violet')) : `prio-${todo.priority}`, 
      { 'completed': todo.completed },
      { 'editing': isEditing },
      { 'compact-card': compact }
    ]"
    :style="localStyle"
  >
    <!-- Priority visual accent strip -->
    <div v-if="!isTask" class="priority-strip" :class="todo.priority"></div>

    <!-- Main Item Content -->
    <div class="item-inner" :class="{ 'compact-inner': compact }">
      <!-- Checkbox circle wrapper -->
      <div class="checkbox-container">
        <button 
          type="button" 
          class="custom-checkbox" 
          :class="[isTask ? '' : todo.priority, { 'checked': todo.completed }]"
          @click="handleToggle"
        >
          <Check v-if="todo.completed" class="check-icon" />
        </button>
      </div>

      <!-- Center Text Info -->
      <div class="item-details" v-if="!isEditing">
        <div class="title-row" :class="{ 'compact-title-row': compact }">
          <h4 class="todo-title" :class="{ 'compact-title': compact }" :title="todo.title">
            {{ todo.title }}
          </h4>
        </div>
        
        <!-- Pinned time interval for compact calendar slots on a new row -->
        <div v-if="compact && taskTimeRange" class="compact-time-row">
          <Clock class="time-badge-icon" />
          <span class="compact-time-text">{{ taskTimeRange }}</span>
        </div>

        <p v-if="!compact && todo.description" class="todo-desc">{{ todo.description }}</p>

        <!-- Meta tags footer (only for standard dashboard list) -->
        <div class="meta-tags" v-if="!compact">
          <!-- Category -->
          <span class="category-badge" :class="currentCategory.class">
            <component :is="currentCategory.icon" class="badge-icon" />
            <span>{{ currentCategory.label }}</span>
          </span>

          <!-- Priority tag -->
          <span class="prio-tag" :class="todo.priority">
            {{ safePriorityLabel }}
          </span>

          <!-- Due Date tag -->
          <span 
            v-if="hasDueDate" 
            class="due-tag" 
            :class="dueDateStatus"
          >
            <AlertCircle v-if="dueDateStatus === 'overdue'" class="due-icon animate-pulse" />
            <Calendar v-else class="due-icon" />
            <span>
              {{ dueDateStatus === 'overdue' ? '已逾期 ' : '' }}{{ formattedDueDate }}
            </span>
          </span>
        </div>
      </div>

      <!-- Inline edit fields -->
      <div class="item-details editing-details" v-else>
        <input 
          type="text" 
          v-model="editTitle" 
          class="edit-title-input" 
          placeholder="任务名称..."
          required
        />
        
        <textarea 
          v-if="!compact"
          v-model="editDesc" 
          class="edit-desc-input" 
          placeholder="详细描述..."
          rows="1"
        ></textarea>

        <!-- Time Selectors in Compact mode edit -->
        <div v-if="compact" class="compact-time-selectors-row">
          <div class="time-select-item">
            <span class="select-label-mini">开始:</span>
            <select v-model="editStartTime" class="time-select-mini">
              <option value="">全天</option>
              <option v-for="h in availableHours" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
          
          <div class="time-select-item" v-if="editStartTime">
            <span class="select-label-mini">结束:</span>
            <select v-model="editEndTime" class="time-select-mini">
              <option 
                v-for="h in availableHours.filter(hr => hr > editStartTime)" 
                :key="h" 
                :value="h"
              >
                {{ h }}
              </option>
            </select>
          </div>
        </div>

        <!-- Color Selector for Tasks in Edit Mode -->
        <div v-if="isTask" class="compact-color-selector-row">
          <span class="select-label-mini">颜色:</span>
          <div class="color-selectors-mini">
            <button
              v-for="c in colorsList"
              :key="c.value"
              type="button"
              class="color-dot-btn-mini"
              :class="[c.class, { 'selected': editColor === c.value }]"
              @click="editColor = c.value"
              :title="c.label"
            ></button>
          </div>
        </div>
        
        <div class="edit-actions-row">
          <button @click="handleSave" class="btn-save" :disabled="!editTitle.trim()">
            <Check class="action-btn-icon" /> 保存
          </button>
          <button @click="handleCancelEdit" class="btn-cancel">
            <X class="action-btn-icon" /> 取消
          </button>
        </div>
      </div>

      <!-- Actions (Edit/Delete/Plan) on hover -->
      <div class="item-actions" v-if="!isEditing && !hideActions" :class="{ 'compact-actions': compact }">
        <button 
          v-if="showPlanAction"
          @click="emit('plan', $event)"
          class="action-btn plan-btn"
          title="排程"
        >
          <Calendar class="action-icon" />
        </button>
        <template v-else>
          <button 
            @click="handleStartEdit" 
            class="action-btn edit-btn" 
            title="编辑"
            :disabled="todo.completed"
          >
            <Edit3 class="action-icon" />
          </button>
          <button 
            @click="handleDelete" 
            class="action-btn delete-btn" 
            title="删除"
          >
            <Trash2 class="action-icon" />
          </button>
        </template>
      </div>
    </div>
    <!-- Resize Handles for Tasks in Grid -->
    <template v-if="isTask && compact && !isEditing">
      <div class="resize-handle resize-handle-top" @mousedown="startResize('top', $event)"></div>
      <div class="resize-handle resize-handle-bottom" @mousedown="startResize('bottom', $event)"></div>
    </template>
  </div>
</template>

<style scoped>
.todo-item {
  position: relative;
  overflow: hidden;
  padding: 16px 16px 16px 20px;
  border-radius: 16px;
  box-shadow: 0 4px 12px var(--shadow-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

/* Compact Card CSS overrides */
.todo-item.compact-card {
  padding: 8px 12px;
  border-radius: 12px;
  box-shadow: none;
  background: var(--bg-glass-solid);
  border: 1px solid var(--border-glass-subtle);
}

.compact-inner {
  gap: 10px !important;
  align-items: center !important;
  width: 100%;
}

.compact-title-row {
  width: 100%;
}

.compact-title {
  font-size: 0.82rem !important;
  font-weight: 700 !important;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  max-width: 100%;
}

.compact-time-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.time-badge-icon {
  width: 11px;
  height: 11px;
  color: var(--color-primary-light);
}

.compact-time-text {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-primary-light);
  white-space: nowrap;
}

.compact-actions {
  gap: 2px !important;
}

.compact-actions .action-btn {
  width: 24px !important;
  height: 24px !important;
  border-radius: 6px !important;
}

.compact-actions .action-icon {
  width: 12px !important;
  height: 12px !important;
}

.compact-time-selectors-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 4px;
}

.time-select-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.select-label-mini {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.time-select-mini {
  padding: 3px 6px !important;
  font-size: 0.72rem !important;
  border-radius: 6px !important;
  background: var(--input-bg) !important;
  border-color: var(--border-glass) !important;
}

/* Priority side marker */
.priority-strip {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 5px;
  border-radius: 5px 0 0 5px;
}

.priority-strip.high { background: var(--color-danger); }
.priority-strip.medium { background: var(--color-warning); }
.priority-strip.low { background: var(--color-info); }

.item-inner {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

/* Checkbox design */
.checkbox-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 2px;
}

.compact-inner .checkbox-container {
  padding-top: 0;
}

.custom-checkbox {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  border: 2px solid var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.compact-card .custom-checkbox {
  width: 18px;
  height: 18px;
}

.custom-checkbox:hover {
  transform: scale(1.1);
}

.custom-checkbox.high { border-color: var(--color-danger); }
.custom-checkbox.high:hover { background: var(--color-danger-alpha); }

.custom-checkbox.medium { border-color: var(--color-warning); }
.custom-checkbox.medium:hover { background: var(--color-warning-alpha); }

.custom-checkbox.low { border-color: var(--color-info); }
.custom-checkbox.low:hover { background: var(--color-info-alpha); }

.custom-checkbox.checked {
  border-color: var(--color-success) !important;
  background: var(--color-success) !important;
}

.check-icon {
  width: 14px;
  height: 14px;
  color: #ffffff;
  stroke-width: 3px;
  animation: scaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.compact-card .check-icon {
  width: 10px;
  height: 10px;
}

@keyframes scaleIn {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

/* Details Section */
.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0; /* for text truncate compatibility */
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.todo-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-all;
  transition: all 0.3s ease;
}

.todo-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
  word-break: break-all;
}

/* Completion Styling */
.todo-item.completed {
  opacity: 0.7;
}

.todo-item.completed .todo-title {
  text-decoration: line-through;
  color: var(--text-muted);
}

.todo-item.completed .todo-desc {
  color: var(--text-muted);
}

/* Meta Tags Container */
.meta-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
  align-items: center;
}

.badge-icon {
  width: 12px;
  height: 12px;
}

.prio-tag {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}

.prio-tag.high {
  background: var(--color-danger-alpha);
  color: var(--color-danger);
}

.prio-tag.medium {
  background: var(--color-warning-alpha);
  color: var(--color-warning);
}

.prio-tag.low {
  background: var(--color-info-alpha);
  color: var(--color-info);
}

/* Due Date tags */
.due-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--border-glass);
  color: var(--text-secondary);
}

.due-icon {
  width: 12px;
  height: 12px;
}

.due-tag.overdue {
  background: var(--color-danger-alpha);
  color: var(--color-danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.due-tag.today {
  background: var(--color-warning-alpha);
  color: var(--color-warning);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.due-tag.completed {
  background: var(--border-glass-subtle);
  color: var(--text-muted);
}

/* Actions Menu */
.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.todo-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  background: transparent;
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.action-btn:hover {
  background: var(--border-glass);
  color: var(--text-primary);
}

.delete-btn:hover {
  background: var(--color-danger-alpha);
  color: var(--color-danger);
}

.plan-btn:hover {
  background: var(--color-primary-alpha);
  color: var(--color-primary-light);
}

.action-icon {
  width: 16px;
  height: 16px;
}

/* Inline Editing elements */
.editing-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.edit-title-input {
  font-size: 0.95rem;
  font-weight: 600;
  padding: 8px 12px;
}

.edit-desc-input {
  font-size: 0.85rem;
  padding: 8px 12px;
  resize: vertical;
}

.edit-actions-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.btn-save {
  background: var(--color-primary);
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.8rem;
}

.btn-save:hover:not(:disabled) {
  background: var(--color-primary-light);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  background: var(--border-glass);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.8rem;
}

.btn-cancel:hover {
  background: var(--border-glass-subtle);
  color: var(--text-primary);
}

.action-btn-icon {
  width: 12px;
  height: 12px;
}

/* Animations helper */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Resize Handles */
.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  z-index: 15;
  cursor: ns-resize;
  transition: background-color 0.2s ease;
}
.resize-handle-top {
  top: 0;
  border-radius: 12px 12px 0 0;
}
.resize-handle-bottom {
  bottom: 0;
  border-radius: 0 0 12px 12px;
}
.resize-handle:hover {
  background: rgba(124, 58, 237, 0.25);
}

/* Custom Task Colors */
.todo-item.task-color-violet {
  background: var(--bg-glass-solid);
  border-color: rgba(139, 92, 246, 0.25) !important;
}
.todo-item.task-color-violet .compact-time-text,
.todo-item.task-color-violet .time-badge-icon {
  color: var(--color-primary);
}
.todo-item.task-color-violet .custom-checkbox {
  border-color: var(--color-primary);
}
.todo-item.task-color-violet .custom-checkbox.checked {
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}
[data-theme="dark"] .todo-item.task-color-violet .compact-time-text,
[data-theme="dark"] .todo-item.task-color-violet .time-badge-icon {
  color: var(--color-primary-light);
}
[data-theme="dark"] .todo-item.task-color-violet .custom-checkbox {
  border-color: var(--color-primary-light);
}
[data-theme="dark"] .todo-item.task-color-violet .custom-checkbox.checked {
  background: var(--color-primary-light) !important;
  border-color: var(--color-primary-light) !important;
}

.todo-item.task-color-blue {
  background: rgba(59, 130, 246, 0.05);
  border-color: rgba(59, 130, 246, 0.3) !important;
}
.todo-item.task-color-blue .compact-time-text,
.todo-item.task-color-blue .time-badge-icon {
  color: hsl(217, 85%, 45%);
}
.todo-item.task-color-blue .custom-checkbox {
  border-color: hsl(217, 85%, 45%);
}
.todo-item.task-color-blue .custom-checkbox.checked {
  background: hsl(217, 85%, 45%) !important;
  border-color: hsl(217, 85%, 45%) !important;
}
[data-theme="dark"] .todo-item.task-color-blue .compact-time-text,
[data-theme="dark"] .todo-item.task-color-blue .time-badge-icon {
  color: hsl(210, 90%, 65%);
}
[data-theme="dark"] .todo-item.task-color-blue .custom-checkbox {
  border-color: hsl(210, 90%, 65%);
}
[data-theme="dark"] .todo-item.task-color-blue .custom-checkbox.checked {
  background: hsl(210, 90%, 65%) !important;
  border-color: hsl(210, 90%, 65%) !important;
}

.todo-item.task-color-emerald {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.3) !important;
}
.todo-item.task-color-emerald .compact-time-text,
.todo-item.task-color-emerald .time-badge-icon {
  color: hsl(142, 70%, 35%);
}
.todo-item.task-color-emerald .custom-checkbox {
  border-color: hsl(142, 70%, 35%);
}
.todo-item.task-color-emerald .custom-checkbox.checked {
  background: hsl(142, 70%, 35%) !important;
  border-color: hsl(142, 70%, 35%) !important;
}
[data-theme="dark"] .todo-item.task-color-emerald .compact-time-text,
[data-theme="dark"] .todo-item.task-color-emerald .time-badge-icon {
  color: hsl(142, 70%, 60%);
}
[data-theme="dark"] .todo-item.task-color-emerald .custom-checkbox {
  border-color: hsl(142, 70%, 60%);
}
[data-theme="dark"] .todo-item.task-color-emerald .custom-checkbox.checked {
  background: hsl(142, 70%, 60%) !important;
  border-color: hsl(142, 70%, 60%) !important;
}

.todo-item.task-color-amber {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.3) !important;
}
.todo-item.task-color-amber .compact-time-text,
.todo-item.task-color-amber .time-badge-icon {
  color: hsl(38, 92%, 40%);
}
.todo-item.task-color-amber .custom-checkbox {
  border-color: hsl(38, 92%, 40%);
}
.todo-item.task-color-amber .custom-checkbox.checked {
  background: hsl(38, 92%, 40%) !important;
  border-color: hsl(38, 92%, 40%) !important;
}
[data-theme="dark"] .todo-item.task-color-amber .compact-time-text,
[data-theme="dark"] .todo-item.task-color-amber .time-badge-icon {
  color: hsl(38, 92%, 60%);
}
[data-theme="dark"] .todo-item.task-color-amber .custom-checkbox {
  border-color: hsl(38, 92%, 60%);
}
[data-theme="dark"] .todo-item.task-color-amber .custom-checkbox.checked {
  background: hsl(38, 92%, 60%) !important;
  border-color: hsl(38, 92%, 60%) !important;
}

.todo-item.task-color-rose {
  background: rgba(244, 63, 94, 0.05);
  border-color: rgba(244, 63, 94, 0.3) !important;
}
.todo-item.task-color-rose .compact-time-text,
.todo-item.task-color-rose .time-badge-icon {
  color: hsl(350, 89%, 45%);
}
.todo-item.task-color-rose .custom-checkbox {
  border-color: hsl(350, 89%, 45%);
}
.todo-item.task-color-rose .custom-checkbox.checked {
  background: hsl(350, 89%, 45%) !important;
  border-color: hsl(350, 89%, 45%) !important;
}
[data-theme="dark"] .todo-item.task-color-rose .compact-time-text,
[data-theme="dark"] .todo-item.task-color-rose .time-badge-icon {
  color: hsl(350, 89%, 70%);
}
[data-theme="dark"] .todo-item.task-color-rose .custom-checkbox {
  border-color: hsl(350, 89%, 70%);
}
[data-theme="dark"] .todo-item.task-color-rose .custom-checkbox.checked {
  background: hsl(350, 89%, 70%) !important;
  border-color: hsl(350, 89%, 70%) !important;
}

.todo-item.task-color-cyan {
  background: rgba(6, 182, 212, 0.05);
  border-color: rgba(6, 182, 212, 0.3) !important;
}
.todo-item.task-color-cyan .compact-time-text,
.todo-item.task-color-cyan .time-badge-icon {
  color: hsl(187, 85%, 35%);
}
.todo-item.task-color-cyan .custom-checkbox {
  border-color: hsl(187, 85%, 35%);
}
.todo-item.task-color-cyan .custom-checkbox.checked {
  background: hsl(187, 85%, 35%) !important;
  border-color: hsl(187, 85%, 35%) !important;
}
[data-theme="dark"] .todo-item.task-color-cyan .compact-time-text,
[data-theme="dark"] .todo-item.task-color-cyan .time-badge-icon {
  color: hsl(187, 85%, 60%);
}
[data-theme="dark"] .todo-item.task-color-cyan .custom-checkbox {
  border-color: hsl(187, 85%, 60%);
}
[data-theme="dark"] .todo-item.task-color-cyan .custom-checkbox.checked {
  background: hsl(187, 85%, 60%) !important;
  border-color: hsl(187, 85%, 60%) !important;
}

/* Edit Color picker in compact card */
.compact-color-selector-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  margin-top: 4px;
}

.color-selectors-mini {
  display: flex;
  gap: 4px;
  align-items: center;
}

.color-dot-btn-mini {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  display: inline-block;
  flex-shrink: 0;
}

.color-dot-btn-mini:hover {
  transform: scale(1.2);
}

.color-dot-btn-mini.selected {
  border-color: var(--text-primary) !important;
  transform: scale(1.1);
}
</style>
