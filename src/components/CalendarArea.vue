<template>
  <div 
    class="calendar-wrapper glass-panel"
    :class="{ 'is-mobile-calendar': isMobile }"
    :style="{
      '--slot-height': settings.slotHeight + 'px',
      '--major-line-width': settings.majorLineWidth + 'px',
      '--major-line-opacity': settings.majorLineOpacity,
      '--minor-line-width': settings.minorLineWidth + 'px',
      '--minor-line-opacity': settings.minorLineOpacity,
      '--minor-line-style': settings.showMinorLines ? 'solid' : 'none'
    }"
  >
    <FullCalendar ref="fullCalendar" :options="calendarOptions" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useTodos } from '../composables/useTodos'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'
import { useMobile } from '../composables/useMobile'

const { tasks, updateTask, addTaskFromTodo } = useTodos()
const { settings } = useSettings()
const { isDark } = useTheme()
const { isMobile } = useMobile()

const fullCalendar = ref<InstanceType<typeof FullCalendar> | null>(null)
let resizeObserver: ResizeObserver | null = null

watch(isMobile, (newVal) => {
  if (fullCalendar.value) {
    const api = fullCalendar.value.getApi()
    if (newVal) {
      api.changeView('timeGridDay')
    } else {
      api.changeView('timeGridWeek')
    }
  }
})

// Update mode to recalculate colors if needed
onMounted(() => {
  // Initialize ResizeObserver to fix FullCalendar flex resize issue
  const wrapper = document.querySelector('.calendar-wrapper')
  if (wrapper) {
    resizeObserver = new ResizeObserver(() => {
      if (fullCalendar.value) {
        fullCalendar.value.getApi().updateSize()
      }
    })
    resizeObserver.observe(wrapper)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

const colorMap: Record<string, { fill: string; stroke: string; text: string; textLight: string }> = {
  violet: { fill: 'rgba(139, 92, 246, 0.12)', stroke: 'rgba(139, 92, 246, 0.5)', text: '#a78bfa', textLight: '#6d28d9' },
  blue: { fill: 'rgba(59, 130, 246, 0.12)', stroke: 'rgba(59, 130, 246, 0.5)', text: '#93c5fd', textLight: '#1d4ed8' },
  emerald: { fill: 'rgba(16, 185, 129, 0.12)', stroke: 'rgba(16, 185, 129, 0.5)', text: '#6ee7b7', textLight: '#047857' },
  amber: { fill: 'rgba(245, 158, 11, 0.12)', stroke: 'rgba(245, 158, 11, 0.5)', text: '#fde047', textLight: '#b45309' },
  rose: { fill: 'rgba(244, 63, 94, 0.12)', stroke: 'rgba(244, 63, 94, 0.5)', text: '#fda4af', textLight: '#be123c' },
  cyan: { fill: 'rgba(6, 182, 212, 0.12)', stroke: 'rgba(6, 182, 212, 0.5)', text: '#67e8f9', textLight: '#0369a1' }
}

// Convert our tasks to FullCalendar event format
const calendarEvents = computed(() => {
  return tasks.value.map(task => {
    const scheme = colorMap[task.color] || colorMap.blue
    const textColor = isDark.value ? scheme.text : scheme.textLight

    return {
      id: task.id,
      title: task.title,
      start: `${task.date}T${task.startTime}:00`,
      end: `${task.date}T${task.endTime}:00`,
      backgroundColor: scheme.fill,
      borderColor: scheme.stroke,
      textColor: textColor,
      extendedProps: { ...task }
    }
  })
})

const handleEventChange = (changeInfo: any) => {
  const event = changeInfo.event
  const id = event.id
  
  // Format dates back to our custom format
  const startDate = new Date(event.start)
  const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 60 * 60 * 1000)
  
  const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
  const startTimeStr = startDate.toTimeString().substring(0, 5)
  const endTimeStr = endDate.toTimeString().substring(0, 5)

  updateTask(id, {
    date: dateStr,
    startTime: startTimeStr,
    endTime: endTimeStr
  })
}

const handleEventReceive = (info: any) => {
  const { event } = info
  const todoId = event.extendedProps.todoId
  
  if (todoId) {
    const startDate = new Date(event.start)
    const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 60 * 60 * 1000)
    
    const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const startTimeStr = startDate.toTimeString().substring(0, 5)
    const endTimeStr = endDate.toTimeString().substring(0, 5)

    // Convert the todo memo into a scheduled task
    addTaskFromTodo(todoId, dateStr, startTimeStr, endTimeStr, event.extendedProps.color || 'blue')
  }
  
  // Revert the temporary event inserted by FullCalendar
  // because Vue will reactively provide the new event via `calendarEvents`
  info.revert()
}

const calendarOptions = computed(() => ({
  plugins: [timeGridPlugin, interactionPlugin, dayGridPlugin],
  initialView: isMobile.value ? 'timeGridDay' : 'timeGridWeek',
  events: calendarEvents.value,
  editable: true,
  selectable: true,
  droppable: true, // Enable dropping from external sources
  headerToolbar: isMobile.value 
    ? {
        left: 'prev,next',
        center: 'title',
        right: 'today'
      }
    : {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
  slotLabelFormat: {
    hour: '2-digit' as const,
    minute: '2-digit' as const,
    hour12: false
  },
  slotMinTime: `${settings.value.startHour.toString().padStart(2, '0')}:00:00`,
  slotMaxTime: `${settings.value.endHour.toString().padStart(2, '0')}:00:00`,
  slotDuration: settings.value.slotDuration,
  snapDuration: '00:05:00',
  slotLabelInterval: '01:00',
  height: '100%',
  allDaySlot: false,
  nowIndicator: true,
  eventChange: handleEventChange, // When event is dragged or resized
  eventReceive: handleEventReceive, // When external event is dropped
  
  firstDay: 1, // Start week on Monday
  dayHeaderContent: (arg: any) => {
    return `${arg.date.getMonth() + 1}月${arg.date.getDate()}日`
  },
  
  // UI text customization
  buttonText: {
    today: '今天',
    month: '月',
    week: '周',
    day: '日'
  },
  locale: 'zh-cn'
}))
</script>

<style>
/* 
  Deep CSS Overrides to make FullCalendar look like our "Antigravity Glassmorphism" Theme 
  FullCalendar creates global classes, so we don't use 'scoped' for these overrides.
*/
.calendar-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

/* Base FullCalendar Overrides */
.fc-theme-standard .fc-scrollgrid {
  border: 1px solid var(--border-glass) !important;
}

.fc-theme-standard td, .fc-theme-standard th {
  border-color: var(--border-glass-subtle) !important;
}

/* Scrollbar Overrides */
.fc-scroller::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.fc-scroller::-webkit-scrollbar-track {
  background: transparent;
}
.fc-scroller::-webkit-scrollbar-thumb {
  background: var(--border-glass-subtle);
  border-radius: 4px;
}
.fc-scroller::-webkit-scrollbar-thumb:hover {
  background: var(--border-glass);
}

/* Toolbar Title */
.fc-toolbar-title {
  color: var(--text-primary) !important;
  font-size: 1.25rem !important;
  font-weight: 800 !important;
}

/* Time Grid Overrides */
.fc .fc-timegrid-slot {
  height: var(--slot-height, 48px) !important;
}

.fc .fc-timegrid-slot-minor,
.fc .fc-timegrid-slot-minor td {
  border-top: var(--minor-line-width, 1px) var(--minor-line-style, solid) rgb(128 128 128 / var(--minor-line-opacity, 0.15)) !important;
}

/* Make full hour (major) lines slightly darker */
.fc .fc-timegrid-slot:not(.fc-timegrid-slot-minor),
.fc .fc-timegrid-slot:not(.fc-timegrid-slot-minor) td {
  border-top: var(--major-line-width, 1.5px) solid rgb(128 128 128 / var(--major-line-opacity, 0.4)) !important;
}

.fc .fc-timegrid-slot-label,
.fc .fc-timegrid-axis {
  position: relative !important;
}

.fc .fc-timegrid-slot-label-cushion,
.fc .fc-timegrid-axis-cushion {
  color: var(--text-secondary) !important;
  font-weight: 600 !important;
  font-size: 0.75rem !important;
  position: absolute;
  top: 0;
  left: 4px;               /* 贴左对齐 */
  transform: translateY(-50%);  /* 让文字中心对准刻度线 */
  background: var(--bg-glass-solid);
  padding: 0 4px;
  border-radius: 3px;
  z-index: 2;
  white-space: nowrap;
}

/* Headers */
.fc .fc-col-header-cell-cushion {
  color: var(--text-primary) !important;
  font-weight: 800 !important;
  padding: 8px 4px !important;
  font-size: 0.85rem !important;
  white-space: nowrap !important;
}

/* Event Styles */
.fc-timegrid-event, .fc-daygrid-event {
  border-width: 1.5px !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
}

.fc-timegrid-event:hover {
  transform: scale(1.02);
  z-index: 10 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.fc-event-main {
  padding: 4px 6px !important;
  font-family: var(--font-family) !important;
  font-size: 0.75rem !important;
  line-height: 1.3 !important;
  overflow: hidden;
  word-break: break-word;
}

/* Toolbar Buttons */
.fc .fc-button-primary {
  background-color: var(--bg-glass-solid) !important;
  border-color: var(--border-glass) !important;
  color: var(--text-primary) !important;
  border-radius: 8px !important;
  backdrop-filter: var(--blur-glass);
  text-transform: capitalize;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  transition: all 0.2s ease;
}

.fc .fc-button-primary:hover {
  background-color: var(--card-hover-bg) !important;
  border-color: var(--color-primary-light) !important;
}

.fc .fc-button-primary:not(:disabled).fc-button-active,
.fc .fc-button-primary:not(:disabled):active {
  background-color: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
  color: white !important;
}

/* Background Color Override for Day Area */
.fc .fc-timegrid-col.fc-day-today {
  background-color: rgba(var(--color-primary), 0.02) !important;
}
</style>

<style scoped>
/* Mobile adjustments for toolbar to save screen space */
.is-mobile-calendar :deep(.fc-header-toolbar) {
  margin-bottom: 8px !important;
  flex-wrap: wrap;
  gap: 8px;
}

.is-mobile-calendar :deep(.fc-toolbar-title) {
  font-size: 1rem !important;
}

.is-mobile-calendar :deep(.fc-button) {
  padding: 4px 8px !important;
  font-size: 0.8rem !important;
}
</style>
