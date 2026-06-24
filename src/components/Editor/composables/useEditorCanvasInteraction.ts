import { ref, onUnmounted } from 'vue'
import { timeStrToMins, minsToTimeStr } from '../../../composables/useTodos'

export function useEditorCanvasInteraction(
  updateTask: (id: string, updates: any) => void,
  addTaskFromTodo: (todoId: string, date: string, startTime: string, endTime: string, color: string) => any
) {
  const transformer = ref<any>(null)
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null
  let ghostBox: any = null

  // 1. Snapping and positioning calculations
  const dragBoundFuncFactory = (group: any) => {
    return (pos: any) => {
      if (!group.getStage()) return pos
      const stageY = group.getStage().y()
      const minBoundY = stageY + 0
      const maxBoundY = stageY + 900 - group.height()
      
      return {
        x: pos.x,
        y: Math.max(minBoundY, Math.min(maxBoundY, pos.y))
      }
    }
  }

  // 2. Render Snapped Ghost Guide Box on Drag Move
  const onCardDragMove = (
    group: any,
    task: any,
    colWidth: number,
    pixelsPerMinute: number,
    guideLayer: any
  ) => {
    if (!guideLayer) return

    const currentX = group.x()
    const currentY = group.y()

    const hoverColIdx = Math.max(0, Math.min(6, Math.round(currentX / colWidth)))

    const cardTopInCol = currentY
    const durationMins = group.height() / pixelsPerMinute
    let startMins = Math.round((cardTopInCol / pixelsPerMinute) / 5) * 5 + 360
    startMins = Math.max(360, Math.min(1440 - durationMins, startMins))

    const previewY = (startMins - 360) * pixelsPerMinute
    const previewX = hoverColIdx * colWidth + 4
    const previewW = colWidth - 8

    // Get theme stroke/fill styles from task
    const cardRect = group.findOne('.bg-rect')
    const strokeCol = cardRect ? cardRect.stroke() : 'rgba(59, 130, 246, 0.5)'
    const fillCol = cardRect ? cardRect.fill() : 'rgba(59, 130, 246, 0.12)'

    if (!ghostBox || !ghostBox.getParent() || ghostBox.getLayer() !== guideLayer) {
      const Konva = (window as any).Konva
      ghostBox = new Konva.Rect({
        name: 'ghost-box',
        stroke: strokeCol,
        strokeWidth: 2,
        dash: [4, 4],
        cornerRadius: 12,
        fill: fillCol,
        opacity: 0.5
      })
      guideLayer.add(ghostBox)
    } else {
      ghostBox.stroke(strokeCol)
      ghostBox.fill(fillCol)
    }

    ghostBox.x(previewX)
    ghostBox.y(previewY)
    ghostBox.width(previewW)
    ghostBox.height(group.height())
    
    guideLayer.batchDraw()
  }

  // 3. Snapping task to grid on Drag End and saving
  const onCardDragEnd = (
    group: any,
    task: any,
    colWidth: number,
    pixelsPerMinute: number,
    calendarDays: any[],
    adjustLayout: () => void,
    guideLayer: any
  ) => {
    const currentX = group.x()
    const currentY = group.y()

    const destColIdx = Math.max(0, Math.min(6, Math.round(currentX / colWidth)))
    const destDate = calendarDays[destColIdx].dateString

    const durationMins = group.height() / pixelsPerMinute
    let newStartMins = Math.round((currentY / pixelsPerMinute) / 5) * 5 + 360
    newStartMins = Math.max(360, Math.min(1440 - durationMins, newStartMins))
    const newEndMins = newStartMins + durationMins

    updateTask(task.id, {
      date: destDate,
      startTime: minsToTimeStr(newStartMins),
      endTime: minsToTimeStr(newEndMins)
    })

    if (ghostBox) {
      ghostBox.destroy()
      ghostBox = null
    }
    if (guideLayer) {
      guideLayer.batchDraw()
    }

    adjustLayout()
  }

  // 4. Update Selection Transformer nodes & handles
  const updateTransformerSelection = (
    selectedTaskId: string | null,
    Konva: any,
    mainLayer: any,
    guideLayer: any,
    pixelsPerMinute: number,
    gridHeight: number,
    adjustLayout: () => void
  ) => {
    if (!Konva || !mainLayer || !guideLayer) return

    // Clean up old transformer nodes
    if (transformer.value) {
      transformer.value.detach()
    }

    if (!selectedTaskId) {
      if (transformer.value) {
        transformer.value.destroy()
        transformer.value = null
        guideLayer.batchDraw()
      }
      return
    }

    const selectedGroup = mainLayer.findOne(`#${selectedTaskId}`)
    if (!selectedGroup) {
      if (transformer.value) {
        transformer.value.destroy()
        transformer.value = null
        guideLayer.batchDraw()
      }
      return
    }

    if (!transformer.value) {
      transformer.value = new Konva.Transformer({
        enabledAnchors: ['top-center', 'bottom-center'],
        rotateEnabled: false,
        keepRatio: false,
        anchorFill: '#ffffff',
        anchorStroke: '#8b5cf6',
        anchorSize: 8,
        borderStroke: '#8b5cf6',
        borderDash: [2, 2],
        boundBoxFunc: (oldBox: any, newBox: any) => {
          // Constrain height minimum duration to 15 minutes (12.5px)
          if (newBox.height < 12.5) {
            return oldBox
          }
          if (newBox.y < 0 || newBox.y + newBox.height > gridHeight) {
            return oldBox
          }
          return newBox
        }
      })
      guideLayer.add(transformer.value)
    }

    transformer.value.nodes([selectedGroup])

    // Bind scaling transform listeners to handle visual updates
    selectedGroup.off('transform')
    selectedGroup.off('transformend')

    selectedGroup.on('transform', () => {
      const scaleY = selectedGroup.scaleY()
      const scaledY = selectedGroup.y()
      const scaledHeight = selectedGroup.height() * scaleY

      let newStartMins = Math.round((scaledY / pixelsPerMinute) / 5) * 5 + 360
      let newDurationMins = Math.round((scaledHeight / pixelsPerMinute) / 5) * 5
      newDurationMins = Math.max(15, newDurationMins)
      newStartMins = Math.max(360, Math.min(1440 - newDurationMins, newStartMins))

      const snapY = (newStartMins - 360) * pixelsPerMinute
      const snapH = newDurationMins * pixelsPerMinute

      // Transform inner nodes visually
      const rectNode = selectedGroup.findOne('.bg-rect')
      if (rectNode) {
        rectNode.y((snapY - scaledY) / scaleY)
        rectNode.height(snapH / scaleY)
      }
      
      const titleText = selectedGroup.findOne('.title-text')
      if (titleText) {
        titleText.y(((snapY - scaledY) + (snapH < 36 ? 6 : 10)) / scaleY)
      }
      
      const timeText = selectedGroup.findOne('.time-text')
      if (timeText) {
        timeText.y(((snapY - scaledY) + (snapH - 20)) / scaleY)
        timeText.text(`${minsToTimeStr(newStartMins)} - ${minsToTimeStr(newStartMins + newDurationMins)}`)
        timeText.visible(snapH >= 36)
      }
    })

    selectedGroup.on('transformend', () => {
      const scaleY = selectedGroup.scaleY()
      const scaledY = selectedGroup.y()
      const scaledHeight = selectedGroup.height() * scaleY

      let newStartMins = Math.round((scaledY / pixelsPerMinute) / 5) * 5 + 360
      let newDurationMins = Math.round((scaledHeight / pixelsPerMinute) / 5) * 5
      newDurationMins = Math.max(15, newDurationMins)
      newStartMins = Math.max(360, Math.min(1440 - newDurationMins, newStartMins))

      const snapY = (newStartMins - 360) * pixelsPerMinute
      const snapH = newDurationMins * pixelsPerMinute

      // Reset coordinates and scale to 1
      selectedGroup.scaleY(1)
      selectedGroup.y(snapY)
      selectedGroup.height(snapH)

      updateTask(selectedTaskId, {
        startTime: minsToTimeStr(newStartMins),
        endTime: minsToTimeStr(newStartMins + newDurationMins)
      })

      adjustLayout()
    })

    guideLayer.batchDraw()
  }

  // 5. HTML5 Drop Handler
  const handleDrop = (
    event: DragEvent,
    stage: any,
    calendarDays: any[],
    pixelsPerMinute: number,
    onSuccess: (taskId: string) => void
  ) => {
    if (!stage || !event.dataTransfer) return
    
    const payloadStr = event.dataTransfer.getData('application/json')
    if (!payloadStr) return

    try {
      const payload = JSON.parse(payloadStr)
      if (payload.type !== 'todo') return

      const pointerPos = stage.getPointerPosition()
      if (!pointerPos) return

      const colWidth = stage.width() / 7
      const colIdx = Math.max(0, Math.min(6, Math.floor(pointerPos.x / colWidth)))
      const targetDate = calendarDays[colIdx]?.dateString

      let newStartMins = Math.round((pointerPos.y / pixelsPerMinute) / 5) * 5 + 360
      newStartMins = Math.max(360, Math.min(1440 - 60, newStartMins)) // Default 1 hour
      const newEndMins = newStartMins + 60

      const newT = addTaskFromTodo(
        payload.todoId,
        targetDate,
        minsToTimeStr(newStartMins),
        minsToTimeStr(newEndMins),
        'blue'
      )

      if (newT) {
        onSuccess(newT.id)
      }
    } catch (e) {
      console.error('Canvas drop failed in interaction helper', e)
    }
  }

  // 6. Keyboard Listeners
  const setupKeyListeners = (deleteSelectedTask: () => void) => {
    keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
          return
        }
        deleteSelectedTask()
      }
    }
    window.addEventListener('keydown', keydownHandler)
  }

  const cleanupKeyListeners = () => {
    if (keydownHandler) {
      window.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
    }
  }

  onUnmounted(() => {
    cleanupKeyListeners()
  })

  return {
    transformer,
    dragBoundFuncFactory,
    onCardDragMove,
    onCardDragEnd,
    updateTransformerSelection,
    handleDrop,
    setupKeyListeners,
    cleanupKeyListeners
  }
}
