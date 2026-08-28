<template>
  <!-- 四象限看板：跨面板拖拽 = 改重要/紧急两轴，点击卡片 = 编辑 -->
  <div class="matrix-view">
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
          <div class="matrix-card" :class="{ 'is-done': element.completed }" @click="emit('edit', element as Task)">
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
</template>

<script setup lang="ts">
/**
 * 四象限矩阵看板（TaskManagePage 的矩阵布局）。
 * 数据流：父组件传入当前视图的任务源（未完成/已完成 + 搜索/分类筛选后的结果），
 * 组件内部维护 vuedraggable 所需的可变镜像列表，拖拽结束后 reconcileMatrixDrop
 * 把落点写回 store（唯一写 order 的入口）。
 */
import { reactive, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import { storeToRefs } from 'pinia'
import { useTaskStore, type Task } from '../stores'
import { QUADRANTS, quadrantOf, quadrantAxes, type QuadrantKey } from '../constants/quadrant'
import { categoryLabel, categoryTagType } from '../constants/categories'

const props = defineProps<{ tasks: Task[] }>()
const emit = defineEmits<{ edit: [task: Task] }>()

const taskStore = useTaskStore()
const { activeTasks } = storeToRefs(taskStore) // 活跃视图（墓碑已滤）
const { updateTask, setTaskCompleted } = taskStore

// vuedraggable 的 :list 需要可变数组（拖拽时原地 splice），store 派生列表不能直接喂；
// 用本地镜像 + watcher 对齐 store，拖拽结束后 reconcileMatrixDrop 把落点写回
const quadrantLists = reactive<Record<QuadrantKey, Task[]>>(
  { q1: [], q2: [], q3: [], q4: [] }
)

// 矩阵数据源 = 当前视图可见任务的扁平集（沿用 未完成/已完成 + 搜索/分类筛选），
// 统一按 order 排序——order 语义即「象限内位置」，面板内顺序因此稳定
const matrixSource = computed(() => [...props.tasks].sort((a, b) => a.order - b.order))

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

const toggleComplete = (row: Task, value: any) => {
  setTaskCompleted(row.id, !!value)
}
</script>

<style scoped>
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

/* 与 TaskManagePage 表单象限选择器共用同一视觉（两处 scoped 各持一份，7 行微样式） */
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  vertical-align: middle;
}
</style>
