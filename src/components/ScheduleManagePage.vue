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
      <el-button type="primary" :icon="Link" @click="openFromTodoDialog"><span v-if="!isMobile">从待办新增</span></el-button>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog"><span v-if="!isMobile">新增日程</span></el-button>
    </div>

    <!-- Table -->
    <el-table :data="filteredSchedules" stripe border style="width: 100%;" empty-text="暂无日程">
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
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

    <!-- Create / Edit dialog -->
    <el-dialog v-model="formDialogVisible" :title="editingId ? '编辑日程' : '新增日程'" :width="isMobile ? '92vw' : '480px'" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入日程标题" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-time-picker v-model="form.startTime" value-format="HH:mm" format="HH:mm" placeholder="开始" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-time-picker v-model="form.endTime" value-format="HH:mm" format="HH:mm" placeholder="结束" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="颜色">
          <el-select v-model="form.color" style="width: 100%;">
            <el-option v-for="c in colorOptions" :key="c.value" :label="c.label" :value="c.value">
              <span class="color-dot" :style="{ background: c.hex }"></span>
              <span style="margin-left: 8px;">{{ c.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- From-todo dialog (从待办新增) -->
    <el-dialog v-model="fromTodoDialogVisible" title="从待办新增日程" :width="isMobile ? '92vw' : '480px'" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="选择待办">
          <el-select v-model="fromTodoForm.taskId" filterable placeholder="搜索并选择待办..." style="width: 100%;">
            <el-option
              v-for="t in leafTasks"
              :key="t.id"
              :label="t.title + (t.completed ? ' (已完成)' : '')"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="fromTodoForm.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-time-picker v-model="fromTodoForm.startTime" value-format="HH:mm" format="HH:mm" placeholder="开始" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-time-picker v-model="fromTodoForm.endTime" value-format="HH:mm" format="HH:mm" placeholder="结束" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="颜色">
          <el-select v-model="fromTodoForm.color" style="width: 100%;">
            <el-option v-for="c in colorOptions" :key="c.value" :label="c.label" :value="c.value">
              <span class="color-dot" :style="{ background: c.hex }"></span>
              <span style="margin-left: 8px;">{{ c.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fromTodoDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmFromTodo">创建日程</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import { Plus, Search, Delete, Edit, Link } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { colorOptions, colorHex, colorLabel, type EventColor } from '../constants/colors'
import { storeToRefs } from 'pinia'
import { useTaskStore, useUIStore, type Schedule } from '../stores'

const { isMobile } = storeToRefs(useUIStore())
// tasks + schedules 合并于同一 useTaskStore
const taskStore = useTaskStore()
const { schedules, tasks, leafTasks } = storeToRefs(taskStore) // state/getter → storeToRefs
const { addSchedule, updateSchedule, deleteSchedule, addScheduleFromTask } = taskStore // action 直接解构

// ---- Options ----
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 来源任务标题：在全量 tasks 中查（任务即使后续变为父级，仍能正确显示来源）
const taskTitle = (taskId: string) => tasks.value.find(t => t.id === taskId)?.title

// ---- Search & filter ----
const searchQuery = ref('')
const filterColor = ref('')

const fuse = computed(() => new Fuse(schedules.value, { keys: ['title'], threshold: 0.4 }))

const filteredSchedules = computed(() => {
  let list = schedules.value
  if (filterColor.value) list = list.filter(t => t.color === filterColor.value)
  if (searchQuery.value.trim()) {
    list = fuse.value.search(searchQuery.value.trim()).map(r => r.item)
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
const todayStr = new Date().toISOString().slice(0, 10)
const form = ref({ title: '', date: todayStr, startTime: '09:00', endTime: '10:00', color: 'blue' as EventColor })

const openCreateDialog = () => {
  editingId.value = null
  form.value = { title: '', date: todayStr, startTime: '09:00', endTime: '10:00', color: 'blue' }
  formDialogVisible.value = true
}

const openEditDialog = (row: Schedule) => {
  editingId.value = row.id
  form.value = { title: row.title, date: row.date, startTime: row.startTime, endTime: row.endTime, color: row.color as EventColor }
  formDialogVisible.value = true
}

const saveForm = () => {
  if (!form.value.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }
  if (editingId.value) {
    updateSchedule(editingId.value, { ...form.value })
    ElMessage.success('已更新')
  } else {
    addSchedule({ ...form.value })
    ElMessage.success('已新增')
  }
  formDialogVisible.value = false
}

// ---- Delete ----
const handleDelete = async (row: Schedule) => {
  try {
    await ElMessageBox.confirm(`确定删除日程「${row.title}」吗？`, '删除日程', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
    deleteSchedule(row.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

// ---- From-task create (从待办/叶子任务新增日程) ----
const fromTodoDialogVisible = ref(false)
const fromTodoForm = ref({ taskId: '', date: todayStr, startTime: '09:00', endTime: '10:00', color: 'blue' as EventColor })

const openFromTodoDialog = () => {
  fromTodoForm.value = { taskId: '', date: todayStr, startTime: '09:00', endTime: '10:00', color: 'blue' }
  fromTodoDialogVisible.value = true
}

const confirmFromTodo = () => {
  if (!fromTodoForm.value.taskId) {
    ElMessage.warning('请选择一个待办')
    return
  }
  const { taskId, date, startTime, endTime, color } = fromTodoForm.value
  const result = addScheduleFromTask(taskId, date, startTime, endTime, color)
  if (result) {
    ElMessage.success('已从待办创建日程')
    fromTodoDialogVisible.value = false
  } else {
    ElMessage.error('创建失败，待办可能已被删除')
  }
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
  padding-top: 8px;
  padding-bottom: 8px;
}

/* 操作列按钮：inline-flex 防换行 + 收紧间距（覆盖 EP 默认 12px margin）*/
.row-actions {
  display: inline-flex;
  gap: 2px;
}
.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.manage-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
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
</style>
