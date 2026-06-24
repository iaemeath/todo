<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTodos, timeStrToMins } from '../composables/useTodos'

const { tasks } = useTodos()

const stageContainer = ref<HTMLDivElement | null>(null)

// --- Konva references ---
let Konva: any = null
let stage: any = null
let gridLayer: any = null
let mainLayer: any = null

const isDarkMode = ref(false)

// --- Theme Colors ---
const colorMap: Record<string, { fill: string; stroke: string; text: string; textLight: string }> = {
  violet: { fill: 'rgba(139, 92, 246, 0.12)', stroke: 'rgba(139, 92, 246, 0.5)', text: '#a78bfa', textLight: '#6d28d9' },
  blue: { fill: 'rgba(59, 130, 246, 0.12)', stroke: 'rgba(59, 130, 246, 0.5)', text: '#93c5fd', textLight: '#1d4ed8' },
  emerald: { fill: 'rgba(16, 185, 129, 0.12)', stroke: 'rgba(16, 185, 129, 0.5)', text: '#6ee7b7', textLight: '#047857' },
  amber: { fill: 'rgba(245, 158, 11, 0.12)', stroke: 'rgba(245, 158, 11, 0.5)', text: '#fde047', textLight: '#b45309' },
  rose: { fill: 'rgba(244, 63, 94, 0.12)', stroke: 'rgba(244, 63, 94, 0.5)', text: '#fda4af', textLight: '#be123c' },
  cyan: { fill: 'rgba(6, 182, 212, 0.12)', stroke: 'rgba(6, 182, 212, 0.5)', text: '#67e8f9', textLight: '#0369a1' }
}

// --- Dates & Time Slots ---
const calendarDays = computed(() => {
  const days = []
  const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    
    const dateString = d.toISOString().split('T')[0]
    let dayLabel = weekLabels[d.getDay()]
    if (i === 0) dayLabel = '今天'
    if (i === 1) dayLabel = '明天'
    
    days.push({
      dateString,
      dayLabel,
      formattedDate: `${d.getMonth() + 1}/${d.getDate()}`,
      dayOfWeek: weekLabels[d.getDay()]
    })
  }
  return days
})

const timeSlots = computed(() => {
  const slots = []
  for (let h = 6; h <= 23; h++) {
    slots.push({
      value: `${String(h).padStart(2, '0')}:00`,
      label: `${String(h).padStart(2, '0')}:00`
    })
  }
  return slots
})

// --- Draw Stage & Shapes ---
const drawStage = () => {
  if (!stage || !Konva) return

  // Clear Layers
  gridLayer.clearCache()
  gridLayer.destroyChildren()
  mainLayer.destroyChildren()

  const stageW = stage.width()
  const colWidth = stageW / 7
  const gridHeight = 900
  const pixelsPerMinute = gridHeight / 1080

  // Fetch Stroke Colors from theme CSS variables dynamically
  const styles = getComputedStyle(document.documentElement)
  const borderCol = styles.getPropertyValue('--border-glass-subtle').trim() || 'rgba(255, 255, 255, 0.05)'

  // Update theme mode flag
  isDarkMode.value = document.documentElement.getAttribute('data-theme') === 'dark'

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

  // Draw Task Card Groups
  tasks.value.forEach(task => {
    const colIdx = calendarDays.value.findIndex(d => d.dateString === task.date)
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
    const textCol = isDarkMode.value ? colorScheme.text : colorScheme.textLight

    // Create Group container
    const group = new Konva.Group({
      id: task.id,
      x,
      y,
      width,
      height,
      name: 'task-card'
    })

    // Background Rect (no heavy shadowBlur calculations for high frame-rate rendering)
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
      fill: isDarkMode.value ? '#f1f5f9' : '#1e1e2f',
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
    
    // Adjust time position if card is small
    if (height < 36) {
      titleText.y(6)
      timeText.visible(false)
    } else if (height < 45) {
      titleText.y(6)
      timeText.y(height - 15)
    }
    
    group.add(timeText)
    mainLayer.add(group)
  })

  mainLayer.batchDraw()
}

// Stage resizing handler with rAF throttling
let resizeTick: any = null
const handleResize = () => {
  if (!stage || !stageContainer.value) return
  stage.width(stageContainer.value.clientWidth)
  if (!resizeTick) {
    resizeTick = requestAnimationFrame(() => {
      drawStage()
      resizeTick = null
    })
  }
}

// Watch tasks for updates and redraw
watch(tasks, () => {
  nextTick(() => drawStage())
}, { deep: true })

// Watch window system theme/dark mode changes
const setupThemeObserver = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.attributeName === 'data-theme') {
        nextTick(() => drawStage())
      }
    })
  })
  observer.observe(document.documentElement, { attributes: true })
  return observer
}

let themeObserver: MutationObserver | null = null

// Initializing stage onMount
onMounted(async () => {
  // Dynamically import Konva for client side rendering compatibility
  const module = await import('konva')
  Konva = module.default

  if (!stageContainer.value) return

  stage = new Konva.Stage({
    container: stageContainer.value,
    width: stageContainer.value.clientWidth,
    height: 900
  })

  gridLayer = new Konva.Layer()
  mainLayer = new Konva.Layer()

  stage.add(gridLayer)
  stage.add(mainLayer)

  drawStage()

  window.addEventListener('resize', handleResize)
  themeObserver = setupThemeObserver()

  onUnmounted(() => {
    if (resizeTick) {
      cancelAnimationFrame(resizeTick)
      resizeTick = null
    }
    window.removeEventListener('resize', handleResize)
    if (themeObserver) {
      themeObserver.disconnect()
    }
    if (stage) {
      stage.destroy()
    }
  })
})
</script>

<template>
  <div class="days-columns-scroll">
    <div class="scheduler-grid">
      <!-- Top Headers Row (Sticky Top) -->
      <div class="scheduler-headers-row">
        <div class="time-axis-header-placeholder"></div>
        <div class="day-headers">
          <div 
            v-for="day in calendarDays" 
            :key="day.dateString" 
            class="day-header"
            :class="{ 'is-today': day.dayLabel === '今天' }"
          >
            <span class="day-lbl">{{ day.dayLabel }}</span>
            <span class="day-dt">{{ day.formattedDate }}</span>
          </div>
        </div>
      </div>

      <!-- Grid Body Row -->
      <div class="scheduler-body-row">
        <!-- Left Time Column Sticky (Sticky Left) -->
        <div class="time-axis-column">
          <div v-for="slot in timeSlots" :key="slot.value" class="time-axis-slot">
            <span>{{ slot.label }}</span>
            <span class="label-dot"></span>
          </div>
        </div>

        <!-- Canvas Container Grid -->
        <div 
          ref="stageContainer" 
          class="stage-container"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.days-columns-scroll {
  flex: 1;
  width: 100%;
  overflow: auto;
  height: 100%;
  position: relative;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.days-columns-scroll::-webkit-scrollbar {
  display: none;
}

.scheduler-grid {
  display: flex;
  flex-direction: column;
  min-width: 900px;
  height: fit-content;
}

.scheduler-headers-row {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  background: var(--bg-app);
  border-bottom: 1px solid var(--border-glass);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  height: 52px;
}

.time-axis-header-placeholder {
  width: 60px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-glass);
}

.day-headers {
  display: flex;
  flex: 1;
}

.day-header {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-right: 1px solid var(--border-glass-subtle);
  box-sizing: border-box;
}

.day-header.is-today .day-lbl {
  color: var(--color-primary-light);
}

.day-lbl {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text-primary);
}

.day-dt {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-weight: 500;
  margin-top: 2px;
}

.scheduler-body-row {
  display: flex;
  position: relative;
  height: 900px;
}

.time-axis-column {
  position: sticky;
  left: 0;
  z-index: 20;
  width: 60px;
  flex-shrink: 0;
  background: var(--bg-app);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-glass);
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.02);
  box-sizing: border-box;
}

.time-axis-slot {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 14px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px dashed var(--border-glass-subtle);
  box-sizing: border-box;
}

.time-axis-slot .label-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-muted);
  margin-right: -10px;
  z-index: 22;
}

.stage-container {
  flex: 1;
  height: 900px;
  position: relative;
  background: transparent;
  outline: none;
}
</style>
