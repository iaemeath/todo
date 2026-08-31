<template>
  <div class="manage-page">
    <!-- Toolbar -->
    <div class="manage-toolbar">
      <el-input v-model="searchQuery" :prefix-icon="Search" placeholder="搜索标题..." clearable style="width: 240px;" />
      <el-select v-model="filterColor" placeholder="颜色" clearable style="width: 140px;">
        <el-option v-for="c in colorOptions" :key="c.value" :label="c.label" :value="c.value">
          <span class="color-dot" :style="{ background: c.hex }"></span>
          <span style="margin-left: 8px;">{{ c.label }}</span>
        </el-option>
      </el-select>
      <div class="view-tabs">
        <span class="view-tab-indicator" :class="{ right: viewMode === 'done' }"></span>
        <button
          v-for="opt in viewOptions"
          :key="opt.value"
          class="view-tab"
          :class="{ active: viewMode === opt.value }"
          @click="viewMode = opt.value"
        >
          <span class="view-tab-label">{{ opt.label }}</span>
        </button>
      </div>
      <el-button type="primary" :icon="Link" @click="openFromTodoDialog"><span v-if="!isMobile">从任务新增</span></el-button>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog"><span v-if="!isMobile">新增日程</span></el-button>
    </div>

    <!-- Table -->
    <el-table :data="filteredSchedules" stripe border style="width: 100%;" :empty-text="emptyText">
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="日期" width="130">
        <template #default="{ row }">
          {{ formatDate(row.date) }}
        </template>
      </el-table-column>
      <el-table-column label="时间" width="150">
        <template #default="{ row }">
          {{ row.startTime }} ~ {{ row.endTime }}
        </template>
      </el-table-column>
      <el-table-column label="颜色" width="100">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :style="{ background: colorHex(row.color) + '22', color: colorHex(row.color), 'border-color': colorHex(row.color) + '55' }">
            {{ colorLabel(row.color) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.taskId && taskTitle(row.taskId)" class="text-secondary">
            📌 {{ taskTitle(row.taskId) }}
          </span>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" :width="isMobile ? 80 : 190" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button text size="small" type="primary" :icon="Edit" @click="openEditDialog(row as Schedule)"><span v-if="!isMobile">编辑</span></el-button>
            <el-button text size="small" type="danger" :icon="Delete" @click="handleDelete(row as Schedule)"><span v-if="!isMobile">删除</span></el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create / Edit dialog：共用 ScheduleDialog（字段/校验/提醒单一数据源），本页不再手写表单 -->
    <ScheduleDialog
      v-model:visible="formDialogVisible"
      :header="editingId ? '编辑日程' : '新增日程'"
      :initial="form"
      :show-delete="!!editingId"
      :confirm-text="editingId ? '保存' : '创建'"
      @save="saveForm"
      @delete="handleDeleteFromDialog"
    />

    <!-- From-task create (从任务新增)：表单/校验复用 ScheduleDialog，本页只留任务选择器（hint 插槽）与落库 -->
    <ScheduleDialog
      v-model:visible="fromTodoDialogVisible"
      header="从任务新增日程"
      :initial="fromTodoInitial"
      :show-title="false"
      :pre-validate="validateFromTodo"
      confirm-text="创建日程"
      @save="confirmFromTodo"
    >
      <template #hint>
        <!-- hint 位于组件 el-form 之外，自持同款 label-position 的 form 承载选择器 -->
        <el-form label-position="top">
          <el-form-item label="选择任务">
            <!-- 选择器与预览卡合一：卡片本身即下拉触发器（未选=虚线占位，选中=预览卡本体） -->
            <el-popover
              ref="taskPopRef"
              trigger="click"
              placement="bottom-start"
              :width="isMobile ? 300 : 420"
              popper-class="from-todo-pop"
            >
              <template #reference>
                <button type="button" class="task-select-card" :class="{ 'is-empty': !fromTodoTaskId }">
                  <!-- 选中/未选两态快速淡切（out-in），遮住 v-if 硬交换的生硬感 -->
                  <Transition name="tpc-swap" mode="out-in">
                    <TaskPreviewCard v-if="fromTodoTaskId" :title="selectedTask?.title ?? ''" :description="selectedTask?.description ?? ''" />
                    <span v-else class="task-select-card__placeholder">搜索并选择任务...</span>
                  </Transition>
                </button>
              </template>
              <el-input v-model="taskQuery" :prefix-icon="Search" placeholder="搜索任务标题..." clearable />
              <div class="from-todo-pop__list">
                <button
                  v-for="t in filteredLeafTasks"
                  :key="t.id"
                  type="button"
                  class="from-todo-pop__item"
                  @click="selectTask(t.id)"
                >
                  {{ t.title }}
                </button>
                <div v-if="!filteredLeafTasks.length" class="from-todo-pop__empty">无匹配任务</div>
              </div>
            </el-popover>
          </el-form-item>
        </el-form>
      </template>
    </ScheduleDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import Fuse from 'fuse.js'
import { Plus, Search, Delete, Edit, Link } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { confirmAction } from '../utils/confirm'
import { colorOptions, colorHex, colorLabel } from '../constants/colors'
import { DEFAULT_SCHEDULE_COLOR, DEFAULT_SCHEDULE_END, DEFAULT_SCHEDULE_START } from '../constants/schedule'
import { todayLocal } from '../utils/dates'
import { storeToRefs } from 'pinia'
import { useTaskStore, useUIStore, type Schedule } from '../stores'
import ScheduleDialog, { type ScheduleFormValue } from './ScheduleDialog.vue'
import TaskPreviewCard from './TaskPreviewCard.vue'

const { isMobile } = storeToRefs(useUIStore())
// tasks + schedules 合并于同一 useTaskStore
const taskStore = useTaskStore()
const { activeSchedules, activeTasks, leafTasks } = storeToRefs(taskStore) // 活跃视图（墓碑已滤）/getter → storeToRefs
const { addSchedule, updateSchedule, deleteSchedule, addScheduleFromTask } = taskStore // action 直接解构

// ---- Options ----
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 来源任务标题：在活跃 tasks 中查（任务即使后续变为父级，仍能正确显示来源）
const taskTitle = (taskId: string) => activeTasks.value.find(t => t.id === taskId)?.title

// ---- Search & filter ----
const searchQuery = ref('')
const filterColor = ref('')
// 二段切换（对齐任务页 未完成|已完成 胶囊模式）：默认未进行，已结束日程不占默认视图
type ViewMode = 'upcoming' | 'done'
const viewMode = ref<ViewMode>('upcoming')
const viewOptions = [
  { value: 'upcoming' as const, label: '未进行' },
  { value: 'done' as const, label: '已进行' }
]

// 已进行是时间推导态（结束时刻早于现在），无持久字段：
// 分钟级心跳让页面常开时跨越结束时刻的日程自动归入"已进行"
const nowTs = ref(Date.now())
const nowTimer = window.setInterval(() => { nowTs.value = Date.now() }, 60_000)
onUnmounted(() => clearInterval(nowTimer))

/** 日程结束时刻（毫秒，本地时区）：date(YYYY-MM-DD) + endTime(HH:mm) */
const endMs = (s: Schedule) => new Date(`${s.date}T${s.endTime}:00`).getTime()

const fuse = computed(() => new Fuse(activeSchedules.value, { keys: ['title'], threshold: 0.4 }))

const emptyText = computed(() => (viewMode.value === 'done' ? '暂无已进行日程' : '暂无未进行日程'))

const filteredSchedules = computed(() => {
  let list = activeSchedules.value
  if (filterColor.value) list = list.filter(t => t.color === filterColor.value)
  // 状态恒过滤（无"全部"档）：已进行=结束时刻早于现在
  list = list.filter(s => (viewMode.value === 'done' ? endMs(s) < nowTs.value : endMs(s) >= nowTs.value))
  if (searchQuery.value.trim()) {
    // 相交而非替换：命中集与状态/颜色筛选取交集（对齐任务页 matchedIds 模式）
    const matchedIds = new Set(fuse.value.search(searchQuery.value.trim()).map(r => r.item.id))
    list = list.filter(s => matchedIds.has(s.id))
  }
  // Sort by date + startTime
  return list.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return a.startTime < b.startTime ? -1 : 1
  })
})

// ---- Create / Edit ----
const formDialogVisible = ref(false)
const editingId = ref<string | null>(null)
// 表单即 ScheduleDialog 的 initial（ScheduleFormValue 契约，含 remindMinutes）
const form = ref<ScheduleFormValue>({ title: '', description: '', date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue', remindMinutes: 0 })

const openCreateDialog = () => {
  editingId.value = null
  form.value = { title: '', description: '', date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue', remindMinutes: 0 }
  formDialogVisible.value = true
}

const openEditDialog = (row: Schedule) => {
  editingId.value = row.id
  form.value = { title: row.title, description: row.description ?? '', date: row.date, startTime: row.startTime, endTime: row.endTime, color: row.color, remindMinutes: row.remindMinutes }
  formDialogVisible.value = true
}

// 校验（标题/时段/提醒）已由 ScheduleDialog.confirm 完成，这里只落库
const saveForm = (value: ScheduleFormValue) => {
  if (editingId.value) {
    updateSchedule(editingId.value, { ...value })
    ElMessage.success('已更新')
  } else {
    addSchedule({ ...value })
    ElMessage.success('已新增')
  }
}

// 弹窗内删除（ScheduleDialog showDelete）：按当前编辑 id 走行删同一确认链路
const handleDeleteFromDialog = async () => {
  const row = activeSchedules.value.find((s) => s.id === editingId.value)
  if (!row) return
  await handleDelete(row)
  formDialogVisible.value = false
}

// ---- Delete ----
const handleDelete = async (row: Schedule) => {
  await confirmAction({
    message: `确定删除日程「${row.title}」吗？`,
    title: '删除日程',
    confirmText: '删除',
    action: () => deleteSchedule(row.id),
    success: '已删除'
  })
}

// ---- From-task create (从任务新增日程)——表单/校验在 ScheduleDialog，此处只留任务选择与落库 ----
const fromTodoDialogVisible = ref(false)
const fromTodoTaskId = ref('')
// 表单初值每次打开时重置（描述不在此流转：任务选择发生在弹窗内，save 时按 taskId 现查任务描述）
const fromTodoInitial = ref<ScheduleFormValue>({
  title: '',
  description: '',
  date: todayLocal(),
  startTime: DEFAULT_SCHEDULE_START,
  endTime: DEFAULT_SCHEDULE_END,
  color: DEFAULT_SCHEDULE_COLOR,
  remindMinutes: 0
})

const openFromTodoDialog = () => {
  fromTodoTaskId.value = ''
  taskQuery.value = ''
  fromTodoInitial.value = {
    title: '',
    description: '',
    date: todayLocal(),
    startTime: DEFAULT_SCHEDULE_START,
    endTime: DEFAULT_SCHEDULE_END,
    color: DEFAULT_SCHEDULE_COLOR,
    remindMinutes: 0
  }
  fromTodoDialogVisible.value = true
}

// 选择器与预览卡合一：卡片触发器 + 弹层搜索列表。选中即记 id 并收起弹层
const taskQuery = ref('')
const taskPopRef = ref<{ hide: () => void } | null>(null)
// 已完成任务不参与转日程（隐藏而非标注）：列表与搜索共用这一基础集
const undoneLeafTasks = computed(() => leafTasks.value.filter((t) => !t.completed))
const taskFuse = computed(() => new Fuse(undoneLeafTasks.value, { keys: ['title'], threshold: 0.4 }))
const filteredLeafTasks = computed(() => {
  const q = taskQuery.value.trim()
  if (!q) return undoneLeafTasks.value
  return taskFuse.value.search(q).map((r) => r.item)
})

// 选中任务的现查视图（预览卡展示与 save 取描述同一数据源，弹窗开着期间任务变动实时反映）
const selectedTask = computed(() => leafTasks.value.find((t) => t.id === fromTodoTaskId.value))

const selectTask = (taskId: string) => {
  fromTodoTaskId.value = taskId
  taskPopRef.value?.hide()
}

// 扩展校验（ScheduleDialog preValidate）：任务必选，日期/时段/提醒由组件统一校验
const validateFromTodo = () => (fromTodoTaskId.value ? null : '请选择一个任务')

const confirmFromTodo = (form: ScheduleFormValue) => {
  const task = selectedTask.value
  if (!task) {
    // 竞态兜底：任务在弹窗打开期间被删——报错并重开弹窗让用户重选
    ElMessage.error('创建失败，任务可能已被删除')
    fromTodoDialogVisible.value = true
    return
  }
  const { date, startTime, endTime, color, remindMinutes } = form
  const result = addScheduleFromTask(task.id, date, startTime, endTime, color, (task.description ?? '').trim(), remindMinutes)
  if (result) {
    ElMessage.success('已从任务创建日程')
  } else {
    ElMessage.error('创建失败，任务可能已被删除')
    fromTodoDialogVisible.value = true // 落库被拒（墓碑任务）：重开弹窗让用户重选
  }
}
</script>

<style scoped>
.manage-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  overflow-y: auto;
  box-sizing: border-box;
}

/* 移动端 content-area 零内边距（日历贴屏惯例），页面自补；
   web 端不补——由 content-area 的浮岛 padding 统一提供（避免双重） */
html.platform-mobile .manage-page {
  padding: var(--space-md) var(--space-lg);
}

/* 收紧表格行高（配合操作按钮 size="small"） */
.manage-page :deep(.el-table .el-table__cell) {
  padding-top: var(--space-sm);
  padding-bottom: var(--space-sm);
}

/* 操作列按钮：inline-flex 防换行 + 收紧间距（覆盖 EP 默认 12px margin） */
.row-actions {
  display: inline-flex;
  gap: 2px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 对抗 EP 默认间距的收紧特例 */
}

.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

/* 触控热区（P1 修复）：纵向 44/36、横向 28 保底 */
.row-actions :deep(.el-button) {
  min-width: 28px;
  min-height: var(--touch-target);
}

.manage-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex-shrink: 0;
}

/* 二段切换（照搬任务页 未完成|已完成 分段器样式） */
.view-tabs {
  position: relative;
  display: inline-flex;
  padding: 3px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 分段器指示器几何偏移特例 */
  background: var(--el-fill-color-light);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
}

.view-tab-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 8px var(--color-primary-alpha);
  transition: transform var(--duration-base) var(--ease-standard);
  z-index: 0;
  pointer-events: none;
}

.view-tab-indicator.right {
  transform: translateX(100%);
}

.view-tab {
  position: relative;
  z-index: 1;
  min-width: 56px;
  padding: 4px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  white-space: nowrap;
  transition: color var(--duration-base) ease;
}

.view-tab:hover {
  color: var(--text-primary);
}

.view-tab.active {
  color: #fff;
}

/* 覆盖全局 button:not(.el-button) 的 :active 缩放，反馈交给滑动指示块 */
.view-tab:active {
  transform: none;
}

/* 桌面：胶囊放宽 */
@media (width >= 769px) {
  .view-tab {
    min-width: 92px;
    padding: 5px 14px;
  }
}

.text-secondary {
  color: var(--el-text-color-secondary);
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  vertical-align: middle;
}

/* 选择器与预览卡合一的触发器：本身无外观，外观交给内部预览卡；未选时呈虚线占位 */
.task-select-card {
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  text-align: center;

  /* 压回全局 button:not(.el-button) 的 semibold：表单占位与预览描述应为常规字重（描述此前被连带加粗） */
  font-weight: var(--weight-regular);
}

.task-select-card.is-empty {
  padding: var(--space-md);
  border-style: dashed;
  border-color: var(--el-border-color);
  color: var(--el-text-color-placeholder);
  font-size: var(--font-base);
}

.task-select-card.is-empty:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.task-select-card:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

/* 选中态：悬浮点亮预览卡描边作为可点暗示 */
.task-select-card:not(.is-empty):hover :deep(.task-preview-card) {
  border-color: var(--el-color-primary);
}

/* 两态淡切：入场轻微上浮，出场更快淡出——0.1~0.15s 比全局 0.2s 更跟手 */
.tpc-swap-enter-active {
  transition: opacity 0.15s var(--ease-standard), transform 0.15s var(--ease-standard); /* stylelint-disable-line declaration-property-value-disallowed-list -- 两态微淡切特意快于 --duration-fast(0.2s) 的跟手特例 */
}

.tpc-swap-leave-active {
  transition: opacity 0.1s ease; /* stylelint-disable-line declaration-property-value-disallowed-list -- 出场更快淡出(0.1s)的跟手特例，理由同上 */
}

.tpc-swap-enter-from {
  opacity: 0;
  transform: translateY(3px);
}

.tpc-swap-leave-to {
  opacity: 0;
}
</style>

<style>
/* 从任务弹层的搜索列表：el-popover 挂 body，需全局样式（popper-class 圈定作用域） */

/* 弹层淡入淡出提速：EP fade-in-linear 默认 0.2s，0.12s 让"点选→回填"链路更跟手 */
.from-todo-pop {
  --el-transition-duration-fast: 0.12s;
}

.from-todo-pop__list {
  max-height: 260px;
  margin-top: var(--space-sm);
  overflow-y: auto;
}

/* 父级 .from-todo-pop 抬到 0-2-0：单类 0-1-0 压不过全局 button:not(.el-button) 的 0-1-1（本块非 scoped，无 data-v 可借） */
.from-todo-pop .from-todo-pop__item {
  display: block;
  width: 100%;
  padding: var(--space-sm) 10px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 列表项左右留白与 EP 输入框内边距对齐特例 */
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: var(--font-base);
  font-weight: var(--weight-regular); /* 压回全局 button:not(.el-button) 的 semibold，选项列表不加粗 */
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.from-todo-pop__item:hover {
  background: var(--el-fill-color-light);
}

.from-todo-pop__empty {
  padding: var(--space-md) 0;
  color: var(--el-text-color-placeholder);
  font-size: var(--font-sm);
  text-align: center;
}
</style>
