<template>
  <div class="manage-page">
    <!-- Toolbar -->
    <div class="manage-toolbar">
      <!-- 布局切换：象限（四象限看板，默认）/ 树（层级表格），与 未完成/已完成 正交 -->
      <div class="view-tabs">
        <span class="view-tab-indicator" :class="{ right: layoutMode === 'tree' }"></span>
        <button
          v-for="opt in layoutOptions"
          :key="opt.value"
          class="view-tab"
          :class="{ active: layoutMode === opt.value }"
          @click="layoutMode = opt.value"
        >
          <span class="view-tab-label">{{ opt.label }}</span>
        </button>
      </div>
      <el-input v-model="searchQuery" :prefix-icon="Search" placeholder="搜索标题或描述..." clearable style="width: 240px;" />
      <el-select v-model="filterCategory" placeholder="分类" clearable style="width: 140px;">
        <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
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
      <el-button type="primary" :icon="Plus" @click="openCreateDialog()"><span v-if="!isMobile">新增任务</span></el-button>
    </div>

    <!-- Table (tree) -->
    <el-table
      v-if="layoutMode === 'tree'"
      :data="displayData"
      row-key="id"
      :tree-props="{ children: 'children' }"
      default-expand-all
      stripe
      border
      style="width: 100%;"
      :empty-text="viewMode === 'active' ? '暂无未完成任务' : '暂无已完成任务'"
    >
      <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
      <el-table-column label="完成" width="70" align="center">
        <template #default="{ row }">
          <el-checkbox :model-value="row.completed" @change="toggleComplete(row as Task, $event)" />
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="text-secondary">{{ row.description || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="层级" width="72" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="levelTagType(getTaskLevel(row.id))" effect="plain">L{{ getTaskLevel(row.id) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="分类" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="categoryTagType(row.category)">{{ categoryLabel(row.category) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="象限" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="quadrantMeta(quadrantOf(row)).tagType" effect="plain">{{ quadrantMeta(quadrantOf(row)).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" :width="isMobile ? 124 : 240" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button v-if="canAddChild(row.id)" text size="small" type="primary" :icon="Plus" @click="openCreateDialog(row as Task)"><span v-if="!isMobile">加子任务</span></el-button>
            <el-button v-if="isLeaf(row.id)" text size="small" type="primary" :icon="Calendar" @click="openScheduleDialog(row as Task)"><span v-if="!isMobile">排期</span></el-button>
            <el-button text size="small" type="primary" :icon="Edit" @click="openEditDialog(row as Task)"><span v-if="!isMobile">编辑</span></el-button>
            <el-button text size="small" type="danger" :icon="Delete" @click="handleDelete(row as Task)"><span v-if="!isMobile">删除</span></el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- Matrix view（四象限看板）：数据源与编辑事件见 QuadrantMatrix 组件 -->
    <QuadrantMatrix v-if="layoutMode === 'matrix'" :tasks="matrixTasks" @edit="openEditDialog" />

    <!-- Create / Edit dialog -->
    <el-dialog v-model="formDialogVisible" :title="dialogTitle" :width="isMobile ? '92vw' : '480px'" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="可选描述" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" style="width: 100%;">
            <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="象限（重要 × 紧急）">
          <div class="quadrant-picker">
            <button
              v-for="q in QUADRANTS"
              :key="q.key"
              type="button"
              class="quadrant-option"
              :class="{ active: form.quadrant === q.key }"
              :style="form.quadrant === q.key ? { borderColor: q.color } : undefined"
              @click="form.quadrant = q.key"
            >
              <span class="color-dot" :style="{ background: q.color }"></span>
              <span>{{ q.label }}</span>
            </button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- Schedule dialog (排期: create a Schedule from this leaf task)——表单/校验在 ScheduleDialog -->
    <ScheduleDialog
      v-model:visible="scheduleDialogVisible"
      header="排期到日历"
      :initial="{
        title: '',
        description: schedulingTask?.description ?? '',
        date: todayLocal(),
        startTime: DEFAULT_SCHEDULE_START,
        endTime: DEFAULT_SCHEDULE_END,
        color: DEFAULT_SCHEDULE_COLOR
      }"
      :show-title="false"
      confirm-text="创建日程"
      @save="confirmSchedule"
    >
      <template #hint>
        <p class="schedule-hint">将任务「<strong>{{ schedulingTask?.title }}</strong>」排入日历日程。</p>
      </template>
    </ScheduleDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Search, Delete, Edit, Calendar } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { confirmAction } from '../utils/confirm'
import { QUADRANTS, quadrantOf, quadrantAxes, quadrantMeta, type QuadrantKey } from '../constants/quadrant'
import { DEFAULT_SCHEDULE_START, DEFAULT_SCHEDULE_END, DEFAULT_SCHEDULE_COLOR } from '../constants/schedule'
import { categoryOptions, categoryLabel, categoryTagType, levelTagType, type Category } from '../constants/categories'
import ScheduleDialog, { type ScheduleFormValue } from './ScheduleDialog.vue'
import QuadrantMatrix from './QuadrantMatrix.vue'
import { todayLocal } from '../utils/dates'
import { storeToRefs } from 'pinia'
import { useTaskStore, useUIStore, type Task } from '../stores'
import { useTaskViewFilter } from '../composables/useTaskViewFilter'

const { isMobile } = storeToRefs(useUIStore())

const taskStore = useTaskStore()
const {
  addTask,
  addChildTask,
  updateTask,
  deleteTask,
  setTaskCompleted,
  getTaskLevel,
  canAddChild,
  isLeaf,
  addScheduleFromTask
} = taskStore // action 直接解构（原 useTasks + useSchedules 合并于此）

// ---- 视图状态与筛选（偏好持久化/搜索/树与扁平推导在组合式）----
const {
  viewMode,
  viewOptions,
  layoutMode,
  layoutOptions,
  searchQuery,
  filterCategory,
  hasFilter,
  visibleTasks,
  filteredFlat,
  displayData
} = useTaskViewFilter()

// 矩阵数据源 = 无筛选用可见全集、有筛选用过滤扁平集（QuadrantMatrix 内部再按 order 排序）
const matrixTasks = computed(() => (hasFilter.value ? filteredFlat.value : visibleTasks.value))

// ---- Create / Edit ----
const formDialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formParent = ref<Task | null>(null) // 非空 = 新建子任务
// 象限在表单里以单值 key 编辑（四宫格选择），提交时解回两轴（避免 quadrant 混入 Task）
const form = ref({ title: '', description: '', category: 'other' as Category, quadrant: 'q4' as QuadrantKey })

const dialogTitle = computed(() => {
  if (editingId.value) return '编辑任务'
  if (formParent.value) return `新增子任务（属于「${formParent.value.title}」）`
  return '新增任务'
})

const openCreateDialog = (parent?: Task) => {
  editingId.value = null
  formParent.value = parent ?? null
  form.value = { title: '', description: '', category: 'other', quadrant: 'q4' }
  formDialogVisible.value = true
}

const openEditDialog = (row: Task) => {
  editingId.value = row.id
  formParent.value = null
  form.value = { title: row.title, description: row.description, category: row.category as Category, quadrant: quadrantOf(row) }
  formDialogVisible.value = true
}

const saveForm = () => {
  if (!form.value.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }
  const { title, description, category, quadrant } = form.value
  const data = { title, description, category, ...quadrantAxes(quadrant) }
  if (editingId.value) {
    updateTask(editingId.value, data)
    ElMessage.success('已更新')
  } else if (formParent.value) {
    addChildTask(formParent.value.id, data)
    ElMessage.success('已新增子任务')
  } else {
    addTask(data)
    ElMessage.success('已新增')
  }
  formDialogVisible.value = false
}

// ---- Complete toggle (cascade via setTaskCompleted) ----
const toggleComplete = (row: Task, value: any) => {
  setTaskCompleted(row.id, !!value)
}

// ---- Delete (cascade: children + schedules) ----
const handleDelete = async (row: Task) => {
  await confirmAction({
    message: `确定删除「${row.title}」吗？其子任务和关联日程也会一并删除。`,
    title: '删除任务',
    confirmText: '删除',
    action: () => deleteTask(row.id),
    success: '已删除'
  })
}

// ---- Schedule (排期，仅叶子任务)——表单/校验在 ScheduleDialog，此处只留任务上下文与落库 ----
const scheduleDialogVisible = ref(false)
const schedulingTask = ref<Task | null>(null)

const openScheduleDialog = (row: Task) => {
  schedulingTask.value = row
  scheduleDialogVisible.value = true
}

const confirmSchedule = (form: ScheduleFormValue) => {
  if (!schedulingTask.value) return
  const { date, startTime, endTime, color, description } = form
  addScheduleFromTask(schedulingTask.value.id, date, startTime, endTime, color, description.trim())
  ElMessage.success('已排入日历')
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
  padding-top: var(--space-xs);
  padding-bottom: var(--space-xs);
}

/* 操作列按钮：inline-flex 防换行 + 收紧间距（覆盖 EP 默认 12px margin） */
.row-actions {
  display: inline-flex;
  gap: 2px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 对抗 EP 默认间距的收紧特例 */
}

.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

/* 图标按钮：移动优先基础态（横向收紧、热区由 min-* 保证），桌面放宽水平内边距 */
.row-actions :deep(.el-button) {
  padding-left: 0;
  padding-right: 2px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 对抗 EP 默认内边距的收紧特例 */
  min-width: 28px;
  min-height: var(--touch-target);
}

@media (width >= 769px) {
  .row-actions :deep(.el-button) {
    padding-right: var(--space-xs);
  }
}

.manage-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex-wrap: wrap; /* 移动端控件多（两组胶囊），放不下时折行而非溢出 */
  flex-shrink: 0;
}

/* 视图切换：分段器（segmented control，圆角矩形） */
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

/* 象限四宫格选择器（新增/编辑 dialog）：选中态描边用象限色（内联绑定），底色走主题 */
.quadrant-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  width: 100%;
}

.quadrant-option {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);
  background: var(--el-bg-color-page);
  color: var(--text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.quadrant-option:hover {
  border-color: var(--color-primary-alpha);
}

.quadrant-option.active {
  color: var(--text-primary);
  font-weight: var(--weight-semibold);
  background: var(--el-color-primary-light-9);
}

/* 与 QuadrantMatrix 矩阵卡共用同一视觉（两处 scoped 各持一份，7 行微样式） */
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  vertical-align: middle;
}

.schedule-hint {
  margin: 0 0 var(--space-lg);
  color: var(--el-text-color-regular);
}
</style>
