<template>
  <div class="manage-page">
    <!-- Toolbar -->
    <div class="manage-toolbar">
      <el-input v-model="searchQuery" :prefix-icon="Search" placeholder="搜索标题或描述..." clearable style="width: 240px;" />
      <el-select v-model="filterCategory" placeholder="分类" clearable style="width: 140px;">
        <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
      </el-select>
      <el-checkbox v-model="onlyIncomplete">只看未完成</el-checkbox>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog()">新增任务</el-button>
      <span class="toolbar-count">共 {{ flatCount }} 条</span>
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
      empty-text="暂无任务"
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
      <el-table-column label="操作" width="240" fixed="right">
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
    <el-dialog v-model="formDialogVisible" :title="dialogTitle" width="480px" destroy-on-close>
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
    <el-dialog v-model="scheduleDialogVisible" title="排期到日历" width="420px" destroy-on-close>
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
import { useTasks, useSchedules, type Task } from '../composables/useTasks'
import { useUI } from '../composables/useUI'

const { isMobile } = useUI()

const {
  tasks,
  addTask,
  addChildTask,
  updateTask,
  deleteTask,
  setTaskCompleted,
  getTaskLevel,
  canAddChild,
  isLeaf
} = useTasks()
const { addScheduleFromTask } = useSchedules()

// ---- Options ----
type Category = 'work' | 'personal' | 'fitness' | 'ideas' | 'shopping' | 'other'
type Priority = 'high' | 'medium' | 'low'
type EventColor = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan'

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
const colorOptions: { value: EventColor; label: string; hex: string }[] = [
  { value: 'violet', label: '紫色', hex: '#8b5cf6' },
  { value: 'blue', label: '蓝色', hex: '#3b82f6' },
  { value: 'emerald', label: '绿色', hex: '#10b981' },
  { value: 'amber', label: '琥珀', hex: '#f59e0b' },
  { value: 'rose', label: '玫红', hex: '#f43f5e' },
  { value: 'cyan', label: '青色', hex: '#06b6d4' }
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

// ---- Search & filter ----
const searchQuery = ref('')
const filterCategory = ref('')
const onlyIncomplete = ref(false)

const hasFilter = computed(() => !!searchQuery.value.trim() || !!filterCategory.value || onlyIncomplete.value)

const fuse = computed(() => new Fuse(tasks.value, { keys: ['title', 'description'], threshold: 0.4 }))

// 扁平过滤结果（搜索/筛选时使用）
const filteredFlat = computed(() => {
  let list = tasks.value.slice()
  if (filterCategory.value) list = list.filter(t => t.category === filterCategory.value)
  if (onlyIncomplete.value) list = list.filter(t => !t.completed)
  if (searchQuery.value.trim()) {
    const matchedIds = new Set(fuse.value.search(searchQuery.value.trim()).map(r => r.item.id))
    list = list.filter(t => matchedIds.has(t.id))
  }
  return list
})

// 树形结构（无筛选时使用）
type TaskNode = Task & { children: TaskNode[] }
const taskTree = computed<TaskNode[]>(() => {
  const build = (parentId: string | null): TaskNode[] =>
    tasks.value
      .filter(t => t.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(t => ({ ...t, children: build(t.id) }))
  return build(null)
})

const displayData = computed(() => (hasFilter.value ? filteredFlat.value : taskTree.value))
const flatCount = computed(() => tasks.value.length)

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
const todayStr = new Date().toISOString().slice(0, 10)
const scheduleForm = ref({ date: todayStr, startTime: '09:00', endTime: '10:00', color: 'blue' as EventColor })

const openScheduleDialog = (row: Task) => {
  schedulingTask.value = row
  scheduleForm.value = { date: todayStr, startTime: '09:00', endTime: '10:00', color: 'blue' }
  scheduleDialogVisible.value = true
}

const confirmSchedule = () => {
  if (!schedulingTask.value) return
  const { date, startTime, endTime, color } = scheduleForm.value
  if (!date || !startTime || !endTime) {
    ElMessage.warning('请填写完整的日期和时间')
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
  gap: 16px;
  overflow-y: auto;
}

/* 收紧表格行高（配合操作按钮 size="small"）*/
.manage-page :deep(.el-table .el-table__cell) {
  padding-top: 5px;
  padding-bottom: 5px;
}

/* 操作列按钮：inline-flex 防换行 + 收紧间距（覆盖 EP 默认 12px margin）*/
.row-actions {
  display: inline-flex;
  gap: 2px;
}
.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
/* 收紧 text small 按钮水平内边距 */
.row-actions :deep(.el-button) {
  padding-left: 0;
  padding-right: 6px;
}

.manage-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.toolbar-count {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
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
  margin: 0 0 16px;
  color: var(--el-text-color-regular);
}
</style>
