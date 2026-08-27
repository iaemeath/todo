import { onMounted, onBeforeUnmount } from 'vue'

/**
 * 单指快速水平滑动手势（容器选择器定位，passive 监听不阻断原生滚动）。
 * 判定：单指、|dx|≥minDx、水平位移≥1.5×垂直位移、时长 <maxMs（慢速拖动不算——
 * 可能是长按拖选）。onSwipe(dir)：-1 向右滑（上一时段），1 向左滑（下一时段）。
 */
export interface SwipeOptions {
  /** 仅当返回 true 时手势生效（如仅移动端启用） */
  enabled?: () => boolean
  /** 起点须命中的祖先选择器（如 '.fc' 日历网格，工具条上的滑动不翻页）；不传不限 */
  targetSel?: string
  /** 起点须避开的祖先选择器（如 '.fc-event' 日程块交给拖拽）；不传不避 */
  skipSel?: string
  minDx?: number
  maxMs?: number
}

export function useSwipe(containerSel: string, onSwipe: (dir: 1 | -1) => void, opts: SwipeOptions = {}) {
  const { enabled, targetSel, skipSel, minDx = 60, maxMs = 800 } = opts
  let el: HTMLElement | null = null
  let start: { x: number; y: number; t: number } | null = null

  const onTouchStart = (e: TouchEvent) => {
    start = null
    if (enabled && !enabled()) return
    if (e.touches.length !== 1) return
    const target = e.target as HTMLElement
    if (targetSel && !target.closest(targetSel)) return
    if (skipSel && target.closest(skipSel)) return
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }

  const onTouchEnd = (e: TouchEvent) => {
    const s = start
    start = null
    if (!s || e.changedTouches.length !== 1) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) < minDx || Math.abs(dx) < 1.5 * Math.abs(dy)) return
    if (Date.now() - s.t > maxMs) return
    onSwipe(dx < 0 ? 1 : -1)
  }

  onMounted(() => {
    el = document.querySelector(containerSel)
    el?.addEventListener('touchstart', onTouchStart, { passive: true })
    el?.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onBeforeUnmount(() => {
    el?.removeEventListener('touchstart', onTouchStart)
    el?.removeEventListener('touchend', onTouchEnd)
  })
}
