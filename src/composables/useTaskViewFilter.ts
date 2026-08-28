/**
 * 任务管理页视图状态与筛选（TaskManagePage 专用组合式）：
 * 未完成/已完成 + 树/矩阵两组视图偏好（localStorage 持久化，重挂载恢复）、
 * 搜索（Fuse 模糊）与分类筛选（相交模式：匹配集落在当前可见范围内）、
 * 视图数据推导：L1 根集 → 可见全集（含子孙）→ 过滤扁平集 / 树形结构。
 */
import { ref, computed, watch } from 'vue'
import Fuse from 'fuse.js'
import { storeToRefs } from 'pinia'
import { useTaskStore, type Task } from '../stores'

// ---- Options ----

// ---- View mode & filter ----
// 视图按 L1（顶级任务）的 completed 归类：done = 已完成的 L1，active = 未完成的 L1。
// 子任务（L2/L3）的完成状态不参与视图归类，子树跟随所属 L1 整体呈现。
type ViewMode = 'active' | 'done'
type LayoutMode = 'tree' | 'matrix'

export type { ViewMode, LayoutMode }

export function useTaskViewFilter() {
  const taskStore = useTaskStore()
  const { activeTasks } = storeToRefs(taskStore) // 活跃视图（墓碑已滤）
  const { getDescendants } = taskStore

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

  return {
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
  }
}
