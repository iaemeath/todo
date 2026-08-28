/**
 * 任务分类与层级标签映射（纯常量，无运行时依赖）：
 * 树表格列与矩阵卡片共用（TaskManagePage / QuadrantMatrix）。
 */

export type Category = 'work' | 'personal' | 'fitness' | 'ideas' | 'shopping' | 'other'

export const categoryOptions: { value: Category; label: string }[] = [
  { value: 'work', label: '工作' },
  { value: 'personal', label: '个人' },
  { value: 'fitness', label: '健身' },
  { value: 'ideas', label: '想法' },
  { value: 'shopping', label: '购物' },
  { value: 'other', label: '其他' }
]

export const categoryLabel = (v: string) => categoryOptions.find(c => c.value === v)?.label ?? v

export const categoryTagType = (v: string) => {
  const map: Record<string, string> = { work: 'primary', personal: 'danger', fitness: 'success', ideas: 'warning', shopping: 'warning', other: 'info' }
  return (map[v] || 'info') as 'primary' | 'danger' | 'success' | 'warning' | 'info'
}

export const levelTagType = (level: number) => {
  const map: Record<number, string> = { 1: 'primary', 2: 'warning', 3: 'info' }
  return (map[level] || 'info') as 'primary' | 'warning' | 'info'
}
