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
      <el-button type="primary" :icon="Link" @click="openFromTodoDialog"><span v-if="!isMobile">从待办新增</span></el-button>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog"><span v-if="!isMobile">新增日程</span></el-button>
    </div>

    <!-- Table -->
    <el-table :data="filteredSchedules" stripe border style="width: 100%;" :empty-text="emptyText">
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
import { ref, computed, onUnmounted } from 'vue'
import Fuse from 'fuse.js'
import { Plus, Search, Delete, Edit, Link } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { colorOptions, colorHex, colorLabel, type EventColor } from '../constants/colors'
import { todayLocal } from '../utils/dates'
import { storeToRefs } from 'pinia'
import { useTaskStore, useUIStore, type Schedule } from '../stores'

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
const form = ref({ title: '', date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue' as EventColor })

const openCreateDialog = () => {
  editingId.value = null
  form.value = { title: '', date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue' }
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
  if (!form.value.date || !form.value.startTime || !form.value.endTime) {
    ElMessage.warning('请填写完整的日期和时间')
    return
  }
  if (form.value.startTime >= form.value.endTime) {
    ElMessage.warning('结束时间必须晚于开始时间')
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
const fromTodoForm = ref({ taskId: '', date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue' as EventColor })

const openFromTodoDialog = () => {
  fromTodoForm.value = { taskId: '', date: todayLocal(), startTime: '09:00', endTime: '10:00', color: 'blue' }
  fromTodoDialogVisible.value = true
}

const confirmFromTodo = () => {
  if (!fromTodoForm.value.taskId) {
    ElMessage.warning('请选择一个待办')
    return
  }
  const { taskId, date, startTime, endTime, color } = fromTodoForm.value
  if (!date || !startTime || !endTime) {
    ElMessage.warning('请填写完整的日期和时间')
    return
  }
  if (startTime >= endTime) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
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

/* 二段切换（照搬任务页 未完成|已完成 胶囊样式） */
.view-tabs {
  position: relative;
  display: inline-flex;
  padding: 3px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 胶囊指示器几何偏移特例 */
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
  border-radius: 9999px;
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
</style>
