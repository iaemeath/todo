<template>
  <div class="manage-page">
    <!-- Toolbar -->
    <div class="manage-toolbar">
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
      <el-table-column label="优先级" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="priorityTagType(row.priority)" effect="plain">{{ priorityLabel(row.priority) }}</el-tag>
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

    <!-- Create / Edit dialog -->
    <el-dialog v-model="formDialogVisible" :title="dialogTitle" :width="isMobile ? '92vw' : '480px'" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="可选描述" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-select v-model="form.category" style="width: 100%;">
                <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-select v-model="form.priority" style="width: 100%;">
                <el-option v-for="p in priorityOptions" :key="p.value" :label="p.label" :value="p.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- Schedule dialog (排期: create a Schedule from this leaf task) -->
    <el-dialog v-model="scheduleDialogVisible" title="排期到日历" :width="isMobile ? '92vw' : '480px'" destroy-on-close>
      <p class="schedule-hint">将任务「<strong>{{ schedulingTask?.title }}</strong>」排入日历日程。</p>
      <el-form label-position="top">
        <el-form-item label="日期">
          <el-date-picker v-model="scheduleForm.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-time-picker v-model="scheduleForm.startTime" value-format="HH:mm" format="HH:mm" placeholder="开始" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-time-picker v-model="scheduleForm.endTime" value-format="HH:mm" format="HH:mm" placeholder="结束" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="颜色">
          <el-select v-model="scheduleForm.color" style="width: 100%;">
            <el-option v-for="c in colorOptions" :key="c.value" :label="c.label" :value="c.value">
              <span class="color-dot" :style="{ background: c.hex }"></span>
              <span style="margin-left: 8px;">{{ c.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSchedule">创建日程</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import { Plus, Search, Delete, Edit, Calendar } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { colorOptions, type EventColor } from '../constants/colors'
import { todayLocal } from '../utils/dates'
import { storeToRefs } from 'pinia'
import { useTaskStore, useUIStore, type Task } from '../stores'

const { isMobile } = storeToRefs(useUIStore())

const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore) // state → storeToRefs
const {
  addTask,
  addChildTask,
  updateTask,
  deleteTask,
  setTaskCompleted,
  getDescendants,
  getTaskLevel,
  canAddChild,
  isLeaf,
  addScheduleFromTask
} = taskStore // action 直接解构（原 useTasks + useSchedules 合并于此）

// ---- Options ----
type Category = 'work' | 'personal' | 'fitness' | 'ideas' | 'shopping' | 'other'
type Priority = 'high' | 'medium' | 'low'

const categoryOptions: { value: Category; label: string }[] = [
  { value: 'work', label: '工作' },
  { value: 'personal', label: '个人' },
  { value: 'fitness', label: '健身' },
  { value: 'ideas', label: '想法' },
  { value: 'shopping', label: '购物' },
  { value: 'other', label: '其他' }
]
const priorityOptions: { value: Priority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' }
]

const categoryLabel = (v: string) => categoryOptions.find(c => c.value === v)?.label ?? v
const priorityLabel = (v: string) => priorityOptions.find(p => p.value === v)?.label ?? v
const categoryTagType = (v: string) => {
  const map: Record<string, string> = { work: 'primary', personal: 'danger', fitness: 'success', ideas: 'warning', shopping: 'warning', other: 'info' }
  return (map[v] || 'info') as 'primary' | 'danger' | 'success' | 'warning' | 'info'
}
const priorityTagType = (v: string) => {
  const map: Record<string, string> = { high: 'danger', medium: 'warning', low: 'info' }
  return (map[v] || 'info') as 'danger' | 'warning' | 'info'
}
const levelTagType = (level: number) => {
  const map: Record<number, string> = { 1: 'primary', 2: 'warning', 3: 'info' }
  return (map[level] || 'info') as 'primary' | 'warning' | 'info'
}

// ---- View mode & filter ----
// 视图按 L1（顶级任务）的 completed 归类：done = 已完成的 L1，active = 未完成的 L1。
// 子任务（L2/L3）的完成状态不参与视图归类，子树跟随所属 L1 整体呈现。
type ViewMode = 'active' | 'done'
const viewMode = ref<ViewMode>('active')

const viewOptions = computed<{ value: ViewMode; label: string }[]>(() => [
  { value: 'active', label: '未完成' },
  { value: 'done', label: '已完成' }
])

const searchQuery = ref('')
const filterCategory = ref('')

const hasFilter = computed(() => !!searchQuery.value.trim() || !!filterCategory.value)

const fuse = computed(() => new Fuse(tasks.value, { keys: ['title', 'description'], threshold: 0.4 }))

// 当前视图的顶级任务（L1）
const viewRoots = computed(() =>
  tasks.value.filter(t => t.parentId === null && t.completed === (viewMode.value === 'done'))
)

// 当前视图可见的全部任务 = 这些 L1 + 其全部子孙
const visibleTasks = computed(() => {
  const ids = new Set<string>()
  for (const r of viewRoots.value) {
    ids.add(r.id)
    getDescendants(r.id).forEach(d => ids.add(d.id))
  }
  return tasks.value.filter(t => ids.has(t.id))
})

// 扁平过滤结果（搜索/筛选时，在当前可见任务范围内）
const filteredFlat = computed(() => {
  let list = visibleTasks.value.slice()
  if (filterCategory.value) list = list.filter(t => t.category === filterCategory.value)
  if (searchQuery.value.trim()) {
    const matchedIds = new Set(fuse.value.search(searchQuery.value.trim()).map(r => r.item.id))
    list = list.filter(t => matchedIds.has(t.id))
  }
  return list
})

// 树形结构（无筛选时使用，基于当前可见任务）
type TaskNode = Task & { children: TaskNode[] }
const taskTree = computed<TaskNode[]>(() => {
  const visIds = new Set(visibleTasks.value.map(t => t.id))
  const build = (parentId: string | null): TaskNode[] =>
    tasks.value
      .filter(t => t.parentId === parentId && visIds.has(t.id))
      .sort((a, b) => a.order - b.order)
      .map(t => ({ ...t, children: build(t.id) }))
  return build(null)
})

const displayData = computed(() => (hasFilter.value ? filteredFlat.value : taskTree.value))

// ---- Create / Edit ----
const formDialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formParent = ref<Task | null>(null) // 非空 = 新建子任务
const form = ref({ title: '', description: '', category: 'other' as Category, priority: 'medium' as Priority })

const dialogTitle = computed(() => {
  if (editingId.value) return '编辑任务'
  if (formParent.value) return `新增子任务（属于「${formParent.value.title}」）`
  return '新增任务'
})

const openCreateDialog = (parent?: Task) => {
  editingId.value = null
  formParent.value = parent ?? null
  form.value = { title: '', description: '', category: 'other', priority: 'medium' }
  formDialogVisible.value = true
}

const openEditDialog = (row: Task) => {
  editingId.value = row.id
  formParent.value = null
  form.value = { title: row.title, description: row.description, category: row.category as Category, priority: row.priority as Priority }
  formDialogVisible.value = true
}

const saveForm = () => {
  if (!form.value.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }
  if (editingId.value) {
    updateTask(editingId.value, { ...form.value })
    ElMessage.success('已更新')
  } else if (formParent.value) {
    addChildTask(formParent.value.id, { ...form.value })
    ElMessage.success('已新增子任务')
  } else {
    addTask({ ...form.value })
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
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.title}」吗？其子任务和关联日程也会一并删除。`,
      '删除任务',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    deleteTask(row.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

// ---- Schedule (排期，仅叶子任务) ----
const scheduleDialogVisible = ref(false)
const schedulingTask = ref<Task | null>(null)
const scheduleForm = ref({ date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue' as EventColor })

const openScheduleDialog = (row: Task) => {
  schedulingTask.value = row
  scheduleForm.value = { date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue' }
  scheduleDialogVisible.value = true
}

const confirmSchedule = () => {
  if (!schedulingTask.value) return
  const { date, startTime, endTime, color } = scheduleForm.value
  if (!date || !startTime || !endTime) {
    ElMessage.warning('请填写完整的日期和时间')
    return
  }
  if (startTime >= endTime) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  addScheduleFromTask(schedulingTask.value.id, date, startTime, endTime, color)
  ElMessage.success('已排入日历')
  scheduleDialogVisible.value = false
}
</script>

<style scoped>
.manage-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  overflow-y: auto;
}

/* 收紧表格行高（配合操作按钮 size="small"） */
.manage-page :deep(.el-table .el-table__cell) {
  padding-top: var(--space-xs);
  padding-bottom: var(--space-xs);
}

/* 操作列按钮：inline-flex 防换行 + 收紧间距（覆盖 EP 默认 12px margin） */
.row-actions {
  display: inline-flex;
  gap: 2px;
}

.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

/* 图标按钮：移动优先基础态（横向收紧、热区由 min-* 保证），桌面放宽水平内边距 */
.row-actions :deep(.el-button) {
  padding-left: 0;
  padding-right: 2px;
  min-width: 28px;
  min-height: var(--touch-target);
}

@media (width >= 769px) {
  .row-actions :deep(.el-button) {
    padding-right: 6px;
  }
}

.manage-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex-shrink: 0;
}

/* 视图切换：胶囊分段器（segmented control） */
.view-tabs {
  position: relative;
  display: inline-flex;
  padding: 3px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--border-glass);
  border-radius: 9999px;
}

.view-tab-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  background: var(--color-primary);
  border-radius: 9999px;
  box-shadow: 0 2px 8px var(--color-primary-alpha);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
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
  border-radius: 9999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  transition: color 0.25s ease;
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
