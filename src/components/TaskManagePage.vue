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

    <!-- Table (tree) —— 桌面分支，移动端走下方卡片列表 -->
    <el-table
      v-if="layoutMode === 'tree' && !isMobile"
      :data="displayData"
      row-key="id"
      :tree-props="{ children: 'children' }"
      default-expand-all
      stripe
      border
      style="width: 100%;"
    >
      <template #empty>
        <div class="manage-empty">
          <p class="manage-empty__text">{{ viewMode === 'active' ? '暂无未完成任务' : '暂无已完成任务' }}</p>
          <el-button v-if="viewMode === 'active'" text type="primary" @click="openCreateDialog()">创建第一个任务</el-button>
        </div>
      </template>
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

    <!-- 移动端卡片列表（树/过滤扁平共用）：表格信息架构平移——标题+完成、标签组、描述、图标操作；层级用缩进+L 徽标表达，不折叠 -->
    <div v-else-if="layoutMode === 'tree'" class="manage-card-list">
      <div
        v-for="{ task, indent } in mobileTaskList"
        :key="task.id"
        class="manage-card"
        :class="{ 'is-done': task.completed }"
        :style="indent ? { marginLeft: `calc(${indent} * var(--space-lg))` } : undefined"
      >
        <div class="manage-card-head">
          <span class="manage-card-title">{{ task.title }}</span>
          <el-checkbox :model-value="task.completed" @change="toggleComplete(task, $event)" />
        </div>
        <div class="manage-card-tags">
          <el-tag size="small" :type="quadrantMeta(quadrantOf(task)).tagType" effect="plain">{{ quadrantMeta(quadrantOf(task)).label }}</el-tag>
          <el-tag size="small" :type="categoryTagType(task.category)">{{ categoryLabel(task.category) }}</el-tag>
          <el-tag size="small" :type="levelTagType(getTaskLevel(task.id))" effect="plain">L{{ getTaskLevel(task.id) }}</el-tag>
        </div>
        <p v-if="task.description" class="manage-card-desc">{{ task.description }}</p>
        <div class="row-actions manage-card-actions">
          <el-button v-if="canAddChild(task.id)" text size="small" type="primary" :icon="Plus" aria-label="加子任务" @click="openCreateDialog(task)" />
          <el-button v-if="isLeaf(task.id)" text size="small" type="primary" :icon="Calendar" aria-label="排期" @click="openScheduleDialog(task)" />
          <el-button text size="small" type="primary" :icon="Edit" aria-label="编辑" @click="openEditDialog(task)" />
          <el-button text size="small" type="danger" :icon="Delete" aria-label="删除" @click="handleDelete(task)" />
        </div>
      </div>
      <div v-if="!mobileTaskList.length" class="manage-empty">
        <p class="manage-empty__text">{{ viewMode === 'active' ? '暂无未完成任务' : '暂无已完成任务' }}</p>
        <el-button v-if="viewMode === 'active'" text type="primary" @click="openCreateDialog()">创建第一个任务</el-button>
      </div>
    </div>

    <!-- Matrix view（四象限看板）：数据源与编辑事件见 QuadrantMatrix 组件；@create 接全空态的创建引导 -->
    <QuadrantMatrix v-if="layoutMode === 'matrix'" :tasks="matrixTasks" @edit="openEditDialog" @create="openCreateDialog()" />

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
        color: DEFAULT_SCHEDULE_COLOR,
        remindMinutes: 0
      }"
      :show-title="false"
      confirm-text="创建日程"
      @save="confirmSchedule"
    >
      <template #hint>
        <!-- 选中任务的只读预览卡（上标题/下描述），替代原提示文案 -->
        <TaskPreviewCard
          class="schedule-task-preview"
          :title="schedulingTask?.title ?? ''"
          :description="schedulingTask?.description ?? ''"
        />
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
import TaskPreviewCard from './TaskPreviewCard.vue'
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

// ---- 移动端卡片列表（P0）：displayData 是树（无筛选，带 children）或扁平集（有筛选），
// 统一扁平化遍历；层级不折叠，用缩进（层级-1 档 --space-lg）+ L 徽标共同表达 ----
type TreeLikeTask = Task & { children?: TreeLikeTask[] }

const mobileTaskList = computed(() => {
  const out: { task: Task; indent: number }[] = []
  const walk = (nodes: TreeLikeTask[]): void => {
    for (const node of nodes) {
      out.push({ task: node, indent: Math.max(getTaskLevel(node.id) - 1, 0) })
      if (node.children?.length) walk(node.children)
    }
  }
  walk(displayData.value as TreeLikeTask[])
  return out
})

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
  const { date, startTime, endTime, color, description, remindMinutes } = form
  addScheduleFromTask(schedulingTask.value.id, date, startTime, endTime, color, description.trim(), remindMinutes)
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

/* ---- 移动端卡片列表（P0）：树表格 → 卡片，.matrix-card 家族语言 ---- */
.manage-card-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex-shrink: 0; /* 长列表撑高 .manage-page 触发整页滚动，而非被 flex 压扁 */
}

.manage-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  background: var(--bg-card);
}

.manage-card-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.manage-card-title {
  flex: 1;
  min-width: 0; /* flex 子项默认 min-width:auto 会顶开省略号 */
  font-size: var(--font-base);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 完成态：矩阵卡片同款语言（删除线 + 变灰） */
.manage-card.is-done .manage-card-title {
  color: var(--text-muted);
  text-decoration: line-through;
}

.manage-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.manage-card-desc {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 操作行右沉（拇指热区在右下角）；触控热区沿用 .row-actions 的 min-height */
.manage-card-actions {
  justify-content: flex-end;
}

/* ---- 空态行动引导（P1-8）：文案 + text 主色按钮直达创建 ---- */
.manage-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg) 0;
}

.manage-empty__text {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-sm);
}

.manage-empty :deep(.el-button) {
  min-height: var(--touch-target); /* 空态按钮同样保触控热区 */
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

/* ---- 胶囊触控热区（P1-4）：移动端纵向 ≥ 44px；
   指示块的 inset/height 本就是相对 .view-tabs 的百分比几何，随按钮增高自动跟随 ---- */
html.platform-mobile .view-tab {
  min-height: var(--touch-target);
}

/* ---- 移动端工具栏两段式（P2-9）：order 重排 + flex-basis 断行，模板不动、桌面单行不受影响 ----
   第一行：新增按钮 + 两组视图胶囊；第二行：搜索（撑满剩余宽）+ 分类筛选 */
html.platform-mobile .manage-toolbar .el-button {
  order: -4;
}

html.platform-mobile .manage-toolbar .view-tabs {
  order: -3;
}

html.platform-mobile .manage-toolbar .el-input {
  order: 1;

  /* 140px = 分类筛选的内联固定宽；basis 恰好留出它+gap 的位置，两者同排占满第二行并强制搜索断行 */
  flex: 1 1 calc(100% - 140px - var(--space-lg));
}

html.platform-mobile .manage-toolbar .el-select {
  order: 2;
  flex: 0 0 auto;
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

.schedule-task-preview {
  margin-bottom: var(--space-lg); /* 预览卡与下方表单的区块间距 */
}
</style>
