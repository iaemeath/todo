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

    <!-- ⋮ dropdown menu (anchored under the FC menu button) -->
    <Teleport to="body">
      <div v-if="menuOpen" class="fc-menu-backdrop" @click="closeMenu" />
      <Transition name="fc-menu">
        <div v-if="menuOpen" class="fc-menu glass-panel" ref="menuRef">
          <button class="fc-menu-item disabled" disabled title="开发中">
            <CalendarRange class="fc-menu-icon" />
            <span>日程管理</span>
            <span class="fc-menu-tag">开发中</span>
          </button>
          <button class="fc-menu-item disabled" disabled title="开发中">
            <ListChecks class="fc-menu-icon" />
            <span>待办管理</span>
            <span class="fc-menu-tag">开发中</span>
          </button>
          <div class="fc-menu-divider" />
          <button class="fc-menu-item" @click="openSettings">
            <SettingsIcon class="fc-menu-icon" />
            <span>设置</span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import { CalendarRange, ListChecks, Settings as SettingsIcon } from 'lucide-vue-next'
import { useTodos } from '../composables/useTodos'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'
import { useMobile } from '../composables/useMobile'
import { useUI } from '../composables/useUI'

const { tasks, updateTask, addTaskFromTodo } = useTodos()
const { settings } = useSettings()
const { isDark } = useTheme()
const { isMobile } = useMobile()
const { sidebarOpen, toggleSidebar, openSettings, menuOpen, toggleMenu, closeMenu } = useUI()

const fullCalendar = ref<InstanceType<typeof FullCalendar> | null>(null)
const menuRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

// Position the ⋮ dropdown menu under the FC menu button when it opens
watch(menuOpen, async (open) => {
  if (!open) return
  await nextTick()
  const btn = document.querySelector<HTMLElement>('.fc-menu-button')
  const menu = menuRef.value
  if (!btn || !menu) return
  const rect = btn.getBoundingClientRect()
  const menuWidth = 200
  // Right-align the menu with the button, keep it on screen
  const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
  menu.style.position = 'fixed'
  menu.style.top = `${rect.bottom + 6}px`
  menu.style.left = `${left}px`
  menu.style.width = `${menuWidth}px`
})

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
  // Custom buttons injected into the toolbar. Icons are rendered via CSS mask
  // (see the <style> block) because FC customButtons only accept text, not HTML.
  customButtons: {
    menu: {
      text: ' ',
      hint: '更多',
      click: () => toggleMenu()
    },
    toggleSidebar: {
      text: ' ',
      hint: '切换备忘录侧边栏',
      click: () => toggleSidebar()
    }
  },
  headerToolbar: isMobile.value
    ? {
        left: 'prev,next',
        center: 'title',
        right: 'menu toggleSidebar today'
      }
    : {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay menu toggleSidebar'
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
  background: var(--el-bg-color);
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
  background-color: var(--el-bg-color) !important;
  border-color: var(--el-border-color) !important;
  color: var(--el-text-color-primary) !important;
  border-radius: 8px !important;
  text-transform: capitalize;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
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

/* ===== Custom toolbar buttons (icon via CSS mask) ===== */
/* FC customButtons only accept text, not HTML, so we hide the text and paint
   the icon via a mask on ::before. The class is fc-{buttonName}-button. */
.fc .fc-toggleSidebar-button,
.fc .fc-menu-button {
  font-size: 0 !important;   /* hide the placeholder text */
  width: 38px !important;
  height: 38px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.fc .fc-toggleSidebar-button::before,
.fc .fc-menu-button::before {
  content: '';
  display: block;
  width: 18px;
  height: 18px;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

/* Sidebar toggle — PanelLeft icon */
.fc .fc-toggleSidebar-button::before {
  -webkit-mask-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeD0iMyIgeT0iMyIgcng9IjIiLz48cGF0aCBkPSJNOSAzdjE4Ii8+PC9zdmc+");
  mask-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeD0iMyIgeT0iMyIgcng9IjIiLz48cGF0aCBkPSJNOSAzdjE4Ii8+PC9zdmc+");
}

/* Menu button — EllipsisVertical icon */
.fc .fc-menu-button::before {
  -webkit-mask-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjUiIHI9IjEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjE5IiByPSIxIi8+PC9zdmc+");
  mask-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjUiIHI9IjEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjE5IiByPSIxIi8+PC9zdmc+");
}

/* ===== ⋮ Dropdown menu ===== */
.fc-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-dropdown);
  /* transparent click-catcher; doesn't block visually */
}

.fc-menu {
  z-index: calc(var(--z-dropdown) + 1);
  border-radius: 12px !important;
  padding: 6px;
  box-shadow: var(--shadow-glass) !important;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--font-family);
}

.fc-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.fc-menu-item:hover:not(.disabled) {
  background: var(--card-hover-bg);
}

.fc-menu-item.disabled {
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}

.fc-menu-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.fc-menu-tag {
  margin-left: auto;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--border-glass);
  color: var(--text-muted);
}

.fc-menu-divider {
  height: 1px;
  background: var(--border-glass);
  margin: 4px 0;
}

/* Menu open/close transition */
.fc-menu-enter-active,
.fc-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fc-menu-enter-from,
.fc-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
