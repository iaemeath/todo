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

    <!-- Matrix view（四象限看板）：跨面板拖拽 = 改重要/紧急两轴，点击卡片 = 编辑 -->
    <div v-if="layoutMode === 'matrix'" class="matrix-view">
      <div v-for="q in QUADRANTS" :key="q.key" class="quadrant-panel">
        <div class="quadrant-panel-header">
          <span class="color-dot" :style="{ background: q.color }"></span>
          <span class="quadrant-panel-title">{{ q.label }}</span>
          <span class="quadrant-count">{{ quadrantLists[q.key].length }}</span>
        </div>
        <draggable
          :list="quadrantLists[q.key]"
          item-key="id"
          group="quadrants"
          class="quadrant-list"
          ghost-class="matrix-ghost"
          :animation="200"
          :delay="200"
          delay-on-touch-only
          @end="reconcileMatrixDrop"
        >
          <template #item="{ element }">
            <div class="matrix-card" :class="{ 'is-done': element.completed }" @click="openEditDialog(element as Task)">
              <el-checkbox
                :model-value="element.completed"
                @change="toggleComplete(element as Task, $event)"
                @click.stop
              />
              <span class="matrix-card-title">{{ element.title }}</span>
              <el-tag size="small" :type="categoryTagType(element.category)" effect="plain">{{ categoryLabel(element.category) }}</el-tag>
            </div>
          </template>
          <template #header v-if="quadrantLists[q.key].length === 0">
            <p class="matrix-empty">暂无任务</p>
          </template>
        </draggable>
      </div>
    </div>

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
import { ref, reactive, computed, watch } from 'vue'
import Fuse from 'fuse.js'
import { Plus, Search, Delete, Edit, Calendar } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import draggable from 'vuedraggable'
import { confirmAction } from '../utils/confirm'
import { colorOptions, type EventColor } from '../constants/colors'
import { QUADRANTS, quadrantOf, quadrantAxes, quadrantMeta, type QuadrantKey } from '../constants/quadrant'
import { todayLocal } from '../utils/dates'
import { storeToRefs } from 'pinia'
import { useTaskStore, useUIStore, type Task } from '../stores'

const { isMobile } = storeToRefs(useUIStore())

const taskStore = useTaskStore()
const { activeTasks } = storeToRefs(taskStore) // 活跃视图（墓碑已滤）
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

const categoryOptions: { value: Category; label: string }[] = [
  { value: 'work', label: '工作' },
  { value: 'personal', label: '个人' },
  { value: 'fitness', label: '健身' },
  { value: 'ideas', label: '想法' },
  { value: 'shopping', label: '购物' },
  { value: 'other', label: '其他' }
]

const categoryLabel = (v: string) => categoryOptions.find(c => c.value === v)?.label ?? v
const categoryTagType = (v: string) => {
  const map: Record<string, string> = { work: 'primary', personal: 'danger', fitness: 'success', ideas: 'warning', shopping: 'warning', other: 'info' }
  return (map[v] || 'info') as 'primary' | 'danger' | 'success' | 'warning' | 'info'
}
const levelTagType = (level: number) => {
  const map: Record<number, string> = { 1: 'primary', 2: 'warning', 3: 'info' }
  return (map[level] || 'info') as 'primary' | 'warning' | 'info'
}

// ---- View mode & filter ----
// 视图按 L1（顶级任务）的 completed 归类：done = 已完成的 L1，active = 未完成的 L1。
// 子任务（L2/L3）的完成状态不参与视图归类，子树跟随所属 L1 整体呈现。
type ViewMode = 'active' | 'done'

// 视图偏好持久化：App.vue 按 v-if 切换视图，组件每次重挂载本地 ref 会归零——
// 未完成/已完成 + 树/矩阵两组选择记入 localStorage，进入页面恢复上次状态
const LS_VIEW_PREFS = 'task_view_prefs'
type ViewPrefs = { view: ViewMode; layout: LayoutMode }
const readViewPrefs = (): ViewPrefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_VIEW_PREFS) || '{}')
    return {
      view: raw.view === 'done' ? 'done' : 'active',
      layout: raw.layout === 'tree' ? 'tree' : 'matrix'
    }
  } catch {
    return { view: 'active', layout: 'matrix' }
  }
}
const initialPrefs = readViewPrefs()

const viewMode = ref<ViewMode>(initialPrefs.view)

const viewOptions = computed<{ value: ViewMode; label: string }[]>(() => [
  { value: 'active', label: '未完成' },
  { value: 'done', label: '已完成' }
])

// ---- Layout mode：象限（四象限看板，默认）/ 树（层级表格）----
type LayoutMode = 'tree' | 'matrix'
const layoutMode = ref<LayoutMode>(initialPrefs.layout)

const layoutOptions = computed<{ value: LayoutMode; label: string }[]>(() => [
  { value: 'matrix', label: '象限' },
  { value: 'tree', label: '树' }
])

watch([viewMode, layoutMode], ([view, layout]) => {
  localStorage.setItem(LS_VIEW_PREFS, JSON.stringify({ view, layout } satisfies ViewPrefs))
})

const searchQuery = ref('')
const filterCategory = ref('')

const hasFilter = computed(() => !!searchQuery.value.trim() || !!filterCategory.value)

const fuse = computed(() => new Fuse(activeTasks.value, { keys: ['title', 'description'], threshold: 0.4 }))

// 当前视图的顶级任务（L1）
const viewRoots = computed(() =>
  activeTasks.value.filter(t => t.parentId === null && t.completed === (viewMode.value === 'done'))
)

// 当前视图可见的全部任务 = 这些 L1 + 其全部子孙
const visibleTasks = computed(() => {
  const ids = new Set<string>()
  for (const r of viewRoots.value) {
    ids.add(r.id)
    getDescendants(r.id).forEach(d => ids.add(d.id))
  }
  return activeTasks.value.filter(t => ids.has(t.id))
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
    activeTasks.value
      .filter(t => t.parentId === parentId && visIds.has(t.id))
      .sort((a, b) => a.order - b.order)
      .map(t => ({ ...t, children: build(t.id) }))
  return build(null)
})

const displayData = computed(() => (hasFilter.value ? filteredFlat.value : taskTree.value))

// ---- Matrix view（四象限看板） ----
// vuedraggable 的 :list 需要可变数组（拖拽时原地 splice），store 派生列表不能直接喂；
// 用本地镜像 + watcher 对齐 store，拖拽结束后 reconcileMatrixDrop 把落点写回
const quadrantLists = reactive<Record<QuadrantKey, Task[]>>(
  { q1: [], q2: [], q3: [], q4: [] }
)

// 矩阵数据源 = 当前视图可见任务的扁平集（沿用 未完成/已完成 + 搜索/分类筛选），
// 统一按 order 排序——order 语义即「象限内位置」，面板内顺序因此稳定
const matrixSource = computed(() => {
  const base = hasFilter.value ? filteredFlat.value : visibleTasks.value
  return [...base].sort((a, b) => a.order - b.order)
})

const syncMatrixLists = () => {
  const byKey: Record<QuadrantKey, Task[]> = { q1: [], q2: [], q3: [], q4: [] }
  for (const t of matrixSource.value) byKey[quadrantOf(t)].push(t)
  for (const q of QUADRANTS) quadrantLists[q.key] = byKey[q.key]
}
watch(matrixSource, syncMatrixLists, { immediate: true })

// 拖拽结算（唯一写 order 的入口）：以四块本地列表的最终顺序为准——
// 跨面板拖 = 改两轴；面板内拖 = 改象限内位置。每个象限按「可见拖后序 + 被遮挡任务
// 按原序垫底」重编号 0..n，order 有变化或两轴不符的任务写回（touch 打 revTime 供同步）
const reconcileMatrixDrop = () => {
  for (const q of QUADRANTS) {
    const axes = quadrantAxes(q.key)
    const list = quadrantLists[q.key]
    const listIds = new Set(list.map(t => t.id))
    // 被筛选/另一完成视图遮挡的同象限任务，追加在可见序之后保持原相对序
    const hidden = activeTasks.value
      .filter(t => quadrantOf(t) === q.key && !listIds.has(t.id))
      .sort((a, b) => a.order - b.order)
    ;[...list, ...hidden].forEach((t, i) => {
      const axesChanged = !!t.important !== axes.important || !!t.urgent !== axes.urgent
      if (axesChanged || t.order !== i) updateTask(t.id, { ...axes, order: i })
    })
  }
  syncMatrixLists()
}

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

/* 矩阵视图：四象限面板（移动端单列，桌面 2×2） */
.matrix-view {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
  align-content: start;
}

/* 桌面：矩阵占满剩余高度，象限列表各自内部滚动（页面不滚）。
   移动端保持整页滚动——竖排四面板若各自内滚，每块仅 1/4 屏高过分局促 */
@media (width >= 769px) {
  .matrix-view {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    flex: 1;
    min-height: 0;
  }

  .quadrant-panel {
    min-height: 0; /* 覆盖空面板 120px 落点高度，改为由列表的 48px 兜底 */
    overflow: hidden;
  }

  .quadrant-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

.quadrant-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 120px; /* 空面板也保留拖拽落点 */
  padding: var(--space-md);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-lg);

  /* 面板比页面底（--el-bg-color-page）亮一档：浅色=纯白、深色=微抬升；
     卡片保持 --bg-card 灰调，与面板形成层次 */
  background: var(--el-bg-color);
}

.quadrant-panel-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.quadrant-panel-title {
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}

.quadrant-count {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 9999px;
  background: var(--el-fill-color);
  color: var(--text-secondary);
  font-size: var(--font-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.quadrant-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-height: 48px;
}

.matrix-card {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.matrix-card:hover {
  border-color: var(--color-primary-alpha);
}

.matrix-card-title {
  flex: 1;
  font-size: var(--font-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.matrix-card.is-done .matrix-card-title {
  color: var(--text-muted);
  text-decoration: line-through;
}

.quadrant-list::-webkit-scrollbar {
  width: 4px;
}

.quadrant-list::-webkit-scrollbar-thumb {
  background: var(--border-glass-subtle);
  border-radius: 4px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 滚动条微调特例 */
}

.matrix-empty {
  margin: 0;
  padding: var(--space-sm) 0;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-sm);
}

.matrix-view :deep(.matrix-ghost) {
  opacity: 0.4;
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
