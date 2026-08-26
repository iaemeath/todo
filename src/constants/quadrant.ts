// 四象限（艾森豪威尔矩阵）系统：单一数据源。
// Task 只存 important/urgent 两个布尔轴，象限 key 由 quadrantOf 派生；
// 标签、el-tag 类型、强调色集中于此，任务管理页（表格列/四宫格表单/矩阵视图）
// 与待办栏色条共用，改样式只需改本文件。

export type QuadrantKey = 'q1' | 'q2' | 'q3' | 'q4'

export interface QuadrantMeta {
  key: QuadrantKey
  label: string
  /** el-tag type（表格列、任务卡标签） */
  tagType: 'danger' | 'primary' | 'warning' | 'info'
  /** 强调色（CSS 变量）：四宫格选中态描边、矩阵面板色点、待办栏左缘色条 */
  color: string
}

/** 象限元数据（顺序即矩阵视觉序：Z 字形 q1→q2→q3→q4） */
export const QUADRANTS: QuadrantMeta[] = [
  { key: 'q1', label: '重要紧急', tagType: 'danger', color: 'var(--el-color-danger)' },
  { key: 'q2', label: '重要不紧急', tagType: 'primary', color: 'var(--color-primary)' },
  { key: 'q3', label: '紧急不重要', tagType: 'warning', color: 'var(--el-color-warning)' },
  { key: 'q4', label: '不重要不紧急', tagType: 'info', color: 'var(--el-text-color-disabled)' }
]

// ---- helpers（两轴缺字段按 false 容忍——旧数据/语音缺省自然落入 q4）----

/** 任务两轴 → 象限 key */
export const quadrantOf = (t: { important?: boolean; urgent?: boolean }): QuadrantKey =>
  t.important ? (t.urgent ? 'q1' : 'q2') : (t.urgent ? 'q3' : 'q4')

/** 象限 key → 两轴（表单提交、矩阵拖拽落点反解） */
export const quadrantAxes = (key: QuadrantKey): { important: boolean; urgent: boolean } => ({
  q1: { important: true, urgent: true },
  q2: { important: true, urgent: false },
  q3: { important: false, urgent: true },
  q4: { important: false, urgent: false }
})[key]

/** 象限 key → 元数据，未知回退 q4 */
export const quadrantMeta = (key: QuadrantKey): QuadrantMeta =>
  QUADRANTS.find(q => q.key === key) ?? QUADRANTS[3]

/** 象限 → 排序权重（待办栏「按象限」排序：q1 红顶置 → q4 沉底） */
export const QUADRANT_RANK: Record<QuadrantKey, number> = { q1: 0, q2: 1, q3: 2, q4: 3 }
