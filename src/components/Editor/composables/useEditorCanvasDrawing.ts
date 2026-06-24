import { timeStrToMins } from '../../../composables/useTodos'

export function useEditorCanvasDrawing() {
  const colorMap: Record<string, { fill: string; stroke: string; text: string; textLight: string }> = {
    violet: { fill: 'rgba(139, 92, 246, 0.12)', stroke: 'rgba(139, 92, 246, 0.5)', text: '#a78bfa', textLight: '#6d28d9' },
    blue: { fill: 'rgba(59, 130, 246, 0.12)', stroke: 'rgba(59, 130, 246, 0.5)', text: '#93c5fd', textLight: '#1d4ed8' },
    emerald: { fill: 'rgba(16, 185, 129, 0.12)', stroke: 'rgba(16, 185, 129, 0.5)', text: '#6ee7b7', textLight: '#047857' },
    amber: { fill: 'rgba(245, 158, 11, 0.12)', stroke: 'rgba(245, 158, 11, 0.5)', text: '#fde047', textLight: '#b45309' },
    rose: { fill: 'rgba(244, 63, 94, 0.12)', stroke: 'rgba(244, 63, 94, 0.5)', text: '#fda4af', textLight: '#be123c' },
    cyan: { fill: 'rgba(6, 182, 212, 0.12)', stroke: 'rgba(6, 182, 212, 0.5)', text: '#67e8f9', textLight: '#0369a1' }
  }

  const drawStage = (
    Konva: any,
    stage: any,
    gridLayer: any,
    mainLayer: any,
    guideLayer: any,
    tasks: any[],
    calendarDays: any[],
    isDarkMode: boolean,
    isEditorMode: boolean,
    dragBoundFuncFactory: (group: any) => (pos: any) => { x: number; y: number },
    onCardDragMove: (group: any, task: any, colWidth: number, pixelsPerMinute: number, guideLayer: any) => void,
    onCardDragEnd: (group: any, task: any, colWidth: number, pixelsPerMinute: number, guideLayer: any) => void,
    onCardClick: (taskId: string, event: any) => void
  ) => {
    if (!stage || !Konva) return
 
    // Clear Layers
    gridLayer.clearCache()
    gridLayer.destroyChildren()
    guideLayer.destroyChildren()
 
    const stageW = stage.width()
    const colWidth = stageW / 7
    const gridHeight = 900
    const pixelsPerMinute = gridHeight / 1080
 
    // Fetch Stroke Colors from theme CSS variables dynamically
    const styles = getComputedStyle(document.documentElement)
    const borderCol = styles.getPropertyValue('--border-glass-subtle').trim() || 'rgba(255, 255, 255, 0.05)'
 
    // Draw background grid vertical lines
    for (let i = 1; i < 7; i++) {
      const x = i * colWidth
      const line = new Konva.Line({
        points: [x, 0, x, gridHeight],
        stroke: borderCol,
        strokeWidth: 1
      })
      gridLayer.add(line)
    }
 
    // Draw background grid horizontal lines
    for (let i = 0; i < 18; i++) {
      const y = i * 50
      const line = new Konva.Line({
        points: [0, y, stageW, y],
        stroke: borderCol,
        strokeWidth: 1,
        dash: [4, 4]
      })
      gridLayer.add(line)
    }
 
    gridLayer.batchDraw()
    gridLayer.cache({
      x: 0,
      y: 0,
      width: stageW,
      height: gridHeight
    })
 
    // Get existing task card groups for node pooling / reuse
    const existingGroups = mainLayer.getChildren((node: any) => node.name() === 'task-card')
    const groupMap = new Map<string, any>()
    existingGroups.forEach((g: any) => {
      if (g.id()) {
        groupMap.set(g.id(), g)
      }
    })
 
    const visitedIds = new Set<string>()
 
    // Draw/Update Task Cards
    tasks.forEach(task => {
      visitedIds.add(task.id)
      const colIdx = calendarDays.findIndex(d => d.dateString === task.date)
      if (colIdx === -1) return
 
      const startMins = timeStrToMins(task.startTime)
      const endMins = timeStrToMins(task.endTime)
      if (isNaN(startMins) || isNaN(endMins)) {
        console.warn('Skipping invalid task with NaN times', task)
        return
      }
 
      const y = (startMins - 360) * pixelsPerMinute
      const height = (endMins - startMins) * pixelsPerMinute
 
      const x = colIdx * colWidth + 4
      const width = colWidth - 8
 
      // Card styling parameters
      const colorScheme = colorMap[task.color] || colorMap.blue
      const fillCol = colorScheme.fill
      const strokeCol = colorScheme.stroke
      const textCol = isDarkMode ? colorScheme.text : colorScheme.textLight
 
      let group = groupMap.get(task.id)
 
      if (!group) {
        // Create new Group container if it doesn't exist
        group = new Konva.Group({
          id: task.id,
          x,
          y,
          width,
          height,
          draggable: isEditorMode,
          name: 'task-card'
        })
 
        // Background Rect
        const rect = new Konva.Rect({
          x: 0,
          y: 0,
          width,
          height,
          fill: fillCol,
          stroke: strokeCol,
          strokeWidth: 1.5,
          cornerRadius: 12,
          name: 'bg-rect'
        })
        group.add(rect)
 
        // Task Title
        const titleText = new Konva.Text({
          x: 10,
          y: 10,
          width: width - 20,
          text: task.title,
          fontSize: 12,
          fontStyle: 'bold',
          fontFamily: 'sans-serif',
          fill: isDarkMode ? '#f1f5f9' : '#1e1e2f',
          ellipsis: true,
          wrap: 'none',
          name: 'title-text'
        })
        group.add(titleText)
 
        // Task Time Label
        const timeText = new Konva.Text({
          x: 10,
          y: height - 20,
          width: width - 20,
          text: `${task.startTime} - ${task.endTime}`,
          fontSize: 10,
          fontStyle: 'bold',
          fontFamily: 'sans-serif',
          fill: textCol,
          ellipsis: true,
          wrap: 'none',
          name: 'time-text'
        })
        group.add(timeText)
 
        if (isEditorMode) {
          // Apply Y constraints during dragging
          group.dragBoundFunc(dragBoundFuncFactory(group))
 
          // Wire interaction handlers
          group.on('dragmove', () => onCardDragMove(group, task, colWidth, pixelsPerMinute, guideLayer))
          group.on('dragend', () => onCardDragEnd(group, task, colWidth, pixelsPerMinute, guideLayer))
          group.on('click tap', (e: any) => {
            e.cancelBubble = true
            onCardClick(task.id, e)
          })
        }
 
        mainLayer.add(group)
      } else {
        // Reuse and update properties of existing Group container
        group.x(x)
        group.y(y)
        group.width(width)
        group.height(height)
        group.draggable(isEditorMode)
 
        // Update child background Rect
        const rect = group.findOne('.bg-rect')
        if (rect) {
          rect.width(width)
          rect.height(height)
          rect.fill(fillCol)
          rect.stroke(strokeCol)
        }
 
        // Update child Texts
        const titleText = group.findOne('.title-text')
        if (titleText) {
          titleText.width(width - 20)
          titleText.text(task.title)
          titleText.fill(isDarkMode ? '#f1f5f9' : '#1e1e2f')
        }
 
        const timeText = group.findOne('.time-text')
        if (timeText) {
          timeText.width(width - 20)
          timeText.text(`${task.startTime} - ${task.endTime}`)
          timeText.fill(textCol)
        }
      }
 
      // Common height adjustments for texts
      const titleTextNode = group.findOne('.title-text')
      const timeTextNode = group.findOne('.time-text')
      if (titleTextNode && timeTextNode) {
        if (height < 36) {
          titleTextNode.y(6)
          timeTextNode.visible(false)
        } else if (height < 45) {
          titleTextNode.y(6)
          timeTextNode.y(height - 15)
          timeTextNode.visible(true)
        } else {
          titleTextNode.y(10)
          timeTextNode.y(height - 20)
          timeTextNode.visible(true)
        }
      }
    })
 
    // Destroy obsolete groups that are no longer in the tasks list
    groupMap.forEach((g: any, id: string) => {
      if (!visitedIds.has(id)) {
        g.destroy()
      }
    })
 
    mainLayer.batchDraw()
    guideLayer.batchDraw()
  }

  const adjustLayout = (
    stage: any,
    mainLayer: any,
    tasks: any[],
    calendarDays: any[],
    isDarkMode: boolean,
    transformer: any
  ) => {
    if (!stage || !mainLayer) return

    const stageW = stage.width()
    const colWidth = stageW / 7
    const gridHeight = 900
    const pixelsPerMinute = gridHeight / 1080

    tasks.forEach(task => {
      const group = mainLayer.findOne(`#${task.id}`)
      if (!group) return

      const colIdx = calendarDays.findIndex(d => d.dateString === task.date)
      if (colIdx === -1) return

      const startMins = timeStrToMins(task.startTime)
      const endMins = timeStrToMins(task.endTime)

      const y = (startMins - 360) * pixelsPerMinute
      const height = (endMins - startMins) * pixelsPerMinute

      const x = colIdx * colWidth + 4
      const width = colWidth - 8

      // Reset scales
      group.scaleX(1)
      group.scaleY(1)

      // Set properties on Group
      group.x(x)
      group.y(y)
      group.width(width)
      group.height(height)

      // Apply color scheme styling
      const colorScheme = colorMap[task.color] || colorMap.blue
      const textCol = isDarkMode ? colorScheme.text : colorScheme.textLight

      // Update child background Rect
      const rect = group.findOne('.bg-rect')
      if (rect) {
        rect.x(0)
        rect.y(0)
        rect.width(width)
        rect.height(height)
        rect.fill(colorScheme.fill)
        rect.stroke(colorScheme.stroke)
      }

      // Update child Texts
      const titleText = group.findOne('.title-text')
      if (titleText) {
        titleText.x(10)
        titleText.y(height < 36 ? 6 : 10)
        titleText.width(width - 20)
        titleText.text(task.title)
      }

      const timeText = group.findOne('.time-text')
      if (timeText) {
        timeText.x(10)
        timeText.y(height < 45 ? height - 15 : height - 20)
        timeText.width(width - 20)
        timeText.text(`${task.startTime} - ${task.endTime}`)
        timeText.fill(textCol)
        timeText.visible(height >= 36)
      }
    })

    mainLayer.batchDraw()
    if (transformer) {
      transformer.forceUpdate()
    }
  }

  return {
    colorMap,
    drawStage,
    adjustLayout
  }
}
