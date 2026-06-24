<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTodos } from '../../../composables/useTodos'
import { useEditorCanvasStage } from '../composables/useEditorCanvasStage'
import { useEditorCanvasDrawing } from '../composables/useEditorCanvasDrawing'
import { useEditorCanvasInteraction } from '../composables/useEditorCanvasInteraction'

const props = defineProps<{
  selectedTaskId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:selectedTaskId', val: string | null): void
}>()

const { tasks, updateTask, deleteTask, addTaskFromTodo } = useTodos()

const stageContainer = ref<HTMLDivElement | null>(null)
const isDarkMode = ref(false)

// --- Composables ---
const { stage, gridLayer, mainLayer, guideLayer, initStage, destroyStage } = useEditorCanvasStage()
const { drawStage, adjustLayout } = useEditorCanvasDrawing()
const {
  transformer,
  dragBoundFuncFactory,
  onCardDragMove,
  onCardDragEnd,
  updateTransformerSelection,
  handleDrop: interactionHandleDrop,
  setupKeyListeners,
  cleanupKeyListeners
} = useEditorCanvasInteraction(updateTask, addTaskFromTodo)

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

const selectedTaskColor = computed(() => {
  if (!props.selectedTaskId) return 'blue'
  const t = tasks.value.find(task => task.id === props.selectedTaskId)
  return t ? t.color : 'blue'
})

// Trigger a redraw or update when themes, dimensions or inputs alter
const triggerDraw = () => {
  isDarkMode.value = document.documentElement.getAttribute('data-theme') === 'dark'
  const Konva = (window as any).Konva
  if (Konva && stage.value) {
    drawStage(
      Konva,
      stage.value,
      gridLayer.value,
      mainLayer.value,
      guideLayer.value,
      tasks.value,
      calendarDays.value,
      isDarkMode.value,
      true, // isEditorMode
      dragBoundFuncFactory,
      onCardDragMove,
      (g, t, w, p, gl) => onCardDragEnd(g, t, w, p, calendarDays.value, runAdjustLayout, gl),
      onCardClick
    )
    updateTransformerSelection(
      props.selectedTaskId,
      Konva,
      mainLayer.value,
      guideLayer.value,
      900 / 1080, // pixelsPerMinute
      900, // gridHeight
      runAdjustLayout
    )
  }
}

const runAdjustLayout = () => {
  isDarkMode.value = document.documentElement.getAttribute('data-theme') === 'dark'
  if (stage.value) {
    adjustLayout(
      stage.value,
      mainLayer.value,
      tasks.value,
      calendarDays.value,
      isDarkMode.value,
      transformer.value
    )
  }
}

// Card click callback
const onCardClick = (taskId: string) => {
  emit('update:selectedTaskId', taskId)
}

// HTML5 Drop handler
const handleDrop = (event: DragEvent) => {
  const pixelsPerMinute = 900 / 1080
  interactionHandleDrop(event, stage.value, calendarDays.value, pixelsPerMinute, (newTaskId) => {
    emit('update:selectedTaskId', newTaskId)
    nextTick(() => triggerDraw())
  })
}

// Expose Editor Canvas Actions to Parents
const changeSelectedColor = (color: string) => {
  if (!props.selectedTaskId) return
  updateTask(props.selectedTaskId, { color })
  nextTick(() => runAdjustLayout())
}

const deleteSelectedTask = () => {
  if (!props.selectedTaskId) return
  deleteTask(props.selectedTaskId)
  emit('update:selectedTaskId', null)
  nextTick(() => triggerDraw())
}

defineExpose({
  deleteSelectedTask,
  changeSelectedColor,
  selectedTaskColor
})

// --- Watchers ---
watch(() => props.selectedTaskId, (newVal) => {
  const Konva = (window as any).Konva
  if (Konva && stage.value) {
    updateTransformerSelection(
      newVal,
      Konva,
      mainLayer.value,
      guideLayer.value,
      900 / 1080,
      900,
      runAdjustLayout
    )
  }
})

onMounted(async () => {
  if (!stageContainer.value) return
  
  await initStage(stageContainer.value, () => {
    emit('update:selectedTaskId', null)
  }, triggerDraw)

  // Cache Konva globally for callbacks if needed
  const module = await import('konva')
  ;(window as any).Konva = module.default

  triggerDraw()
  setupKeyListeners(deleteSelectedTask)
})

onUnmounted(() => {
  cleanupKeyListeners()
  destroyStage()
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
          @dragover.prevent
          @drop="handleDrop"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.days-columns-scroll {
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
  background: var(--bg-glass-solid);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border-bottom: 1px solid var(--border-glass-subtle);
  height: 52px;
}

.time-axis-header-placeholder {
  width: 50px;
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
  width: 50px;
  flex-shrink: 0;
  background: var(--bg-glass-solid);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-glass);
  box-sizing: border-box;
}

.time-axis-slot {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
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
