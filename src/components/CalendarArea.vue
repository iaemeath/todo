<template>
  <div
    class="calendar-wrapper glass-panel"
    :style="{
      '--slot-height': settings.slotHeight + 'px',
      '--major-line-width': settings.majorLineWidth + 'px',
      '--major-line-opacity': settings.majorLineOpacity,
      '--minor-line-width': settings.minorLineWidth + 'px',
      '--minor-line-opacity': settings.minorLineOpacity,
      '--minor-line-style': settings.showMinorLines ? 'solid' : 'none',
      '--now-indicator-color': settings.nowIndicatorColor,
      '--now-indicator-height': settings.nowIndicatorHeight + 'px',
      '--now-indicator-opacity': settings.nowIndicatorOpacity
    }"
  >
    <FullCalendar ref="fullCalendar" :options="calendarOptions" />
    <button
      v-if="!isMobile && !todoVisible"
      class="reopen-todo-btn"
      @click="setTodoVisible(true)"
      title="展开待办栏"
    >
      <PanelRight :size="24" />
    </button>
    <!-- 移动端：打开待办浮层 -->
    <button
      v-if="isMobile && !todoVisible"
      class="mobile-todo-fab"
      @click="setTodoVisible(true)"
      title="打开待办"
    >
      <PanelRight :size="24" />
    </button>

    <!-- 日程新增/编辑弹窗（web 右击、移动双击事件打开编辑） -->
    <el-dialog v-model="newScheduleDialogVisible" :title="editingScheduleId ? '编辑日程' : '新增日程'" :width="isMobile ? '92vw' : '480px'" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="标题">
          <el-input v-model="newScheduleForm.title" placeholder="请输入日程标题" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="newScheduleForm.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-time-picker v-model="newScheduleForm.startTime" value-format="HH:mm" format="HH:mm" placeholder="开始" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-time-picker v-model="newScheduleForm.endTime" value-format="HH:mm" format="HH:mm" placeholder="结束" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="颜色">
          <el-select v-model="newScheduleForm.color" style="width: 100%;">
            <el-option v-for="c in colorOptions" :key="c.value" :label="c.label" :value="c.value">
              <span class="color-dot" :style="{ background: c.hex }"></span>
              <span style="margin-left: 8px;">{{ c.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="editingScheduleId" type="danger" @click="handleDeleteSchedule">删除</el-button>
        <el-button @click="newScheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmNewSchedule">{{ editingScheduleId ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useSchedules } from '../composables/useTasks'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'
import { useUI } from '../composables/useUI'
import { PanelRight } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'

const { schedules, updateSchedule, addScheduleFromTask, addSchedule, deleteSchedule } = useSchedules()
const { settings } = useSettings()
const { isDark } = useTheme()
const { isMobile, todoVisible, setTodoVisible } = useUI()

const fullCalendar = ref<InstanceType<typeof FullCalendar> | null>(null)
let resizeObserver: ResizeObserver | null = null

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

// 新增日程颜色选项（与 colorMap 6 色一致）
const colorOptions = [
  { value: 'violet', label: '紫色', hex: '#8b5cf6' },
  { value: 'blue', label: '蓝色', hex: '#3b82f6' },
  { value: 'emerald', label: '绿色', hex: '#10b981' },
  { value: 'amber', label: '琥珀', hex: '#f59e0b' },
  { value: 'rose', label: '玫红', hex: '#f43f5e' },
  { value: 'cyan', label: '青色', hex: '#06b6d4' }
]

// Convert our schedules to FullCalendar event format
const calendarEvents = computed(() => {
  return schedules.value.map(task => {
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

  updateSchedule(id, {
    date: dateStr,
    startTime: startTimeStr,
    endTime: endTimeStr
  })
}

const handleEventReceive = (info: any) => {
  const { event } = info
  const taskId = event.extendedProps.taskId

  if (taskId) {
    const startDate = new Date(event.start)
    const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 60 * 60 * 1000)

    const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const startTimeStr = startDate.toTimeString().substring(0, 5)
    const endTimeStr = endDate.toTimeString().substring(0, 5)

    // 将叶子任务排期为日程
    addScheduleFromTask(taskId, dateStr, startTimeStr, endTimeStr, event.extendedProps.color || 'blue')
  }
  
  // Revert the temporary event inserted by FullCalendar
  // because Vue will reactively provide the new event via `calendarEvents`
  info.revert()
  // 仅移动端：拖入成功后关闭待办浮层（web 端保持侧栏不动）
  if (isMobile.value) setTodoVisible(false)
}

// ---- 日程弹窗（新增/编辑共用）+ 事件交互 ----
const newScheduleDialogVisible = ref(false)
const newScheduleForm = ref({ title: '', date: '', startTime: '09:00', endTime: '10:00', color: 'blue' })
// 非空 = 编辑模式（更新/删除），空 = 新增模式
const editingScheduleId = ref<string | null>(null)

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const openNewScheduleDialog = (dateStr: string, startTimeStr: string, endTimeStr: string) => {
  editingScheduleId.value = null
  newScheduleForm.value = { title: '', date: dateStr, startTime: startTimeStr, endTime: endTimeStr, color: 'blue' }
  newScheduleDialogVisible.value = true
}

// 打开编辑弹窗（预填现有值）
const openEditDialog = (eventId: string) => {
  const s = schedules.value.find(x => x.id === eventId)
  if (!s) return
  editingScheduleId.value = s.id
  newScheduleForm.value = { title: s.title, date: s.date, startTime: s.startTime, endTime: s.endTime, color: s.color }
  newScheduleDialogVisible.value = true
}

// 移动端：轻触事件，两次快速轻触同一事件（<350ms）视为双击 → 编辑。
// FC 无原生双击回调，基于 eventClick 自判定；滚动是滑动不会触发 eventClick，无双击误判。
let lastEventTap = { id: '', time: 0 }
const handleEventClick = (info: any) => {
  if (!isMobile.value) return // web 端走右键菜单，不用 eventClick
  const id = info.event.id
  const now = Date.now()
  if (lastEventTap.id === id && now - lastEventTap.time < 350) {
    openEditDialog(id)
    lastEventTap = { id: '', time: 0 }
  } else {
    lastEventTap = { id, time: now }
  }
}

// web 端：右击事件 → 编辑弹窗（FC 无原生 contextmenu 回调，事件挂载时绑原生监听）
const handleEventDidMount = (info: any) => {
  info.el.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault()
    if (isMobile.value) return // 移动端走双击入口（部分浏览器长按会触发 contextmenu，忽略）
    openEditDialog(info.event.id)
  })
}

// 单击时间格：默认时长 1h
const handleDateClick = (info: any) => {
  const d = new Date(info.date)
  const end = new Date(d.getTime() + 60 * 60 * 1000)
  openNewScheduleDialog(fmtDate(d), fmtTime(d), fmtTime(end))
}

// 拖选时段：精确起止时间
const handleSelect = (info: any) => {
  const start = new Date(info.start)
  const end = new Date(info.end)
  openNewScheduleDialog(fmtDate(start), fmtTime(start), fmtTime(end))
}

const confirmNewSchedule = () => {
  const { title, date, startTime, endTime, color } = newScheduleForm.value
  if (!title.trim()) { ElMessage.warning('标题不能为空'); return }
  if (!date || !startTime || !endTime) { ElMessage.warning('请填写完整的日期和时间'); return }
  if (editingScheduleId.value) {
    updateSchedule(editingScheduleId.value, { title: title.trim(), date, startTime, endTime, color })
    ElMessage.success('已更新')
  } else {
    addSchedule({ title: title.trim(), date, startTime, endTime, color })
    ElMessage.success('已新增日程')
  }
  newScheduleDialogVisible.value = false
}

const handleDeleteSchedule = () => {
  if (!editingScheduleId.value) return
  deleteSchedule(editingScheduleId.value)
  ElMessage.success('已删除')
  newScheduleDialogVisible.value = false
}

const calendarOptions = computed(() => ({
  plugins: [timeGridPlugin, interactionPlugin, dayGridPlugin],
  initialView: isMobile.value ? 'timeGridDay' : 'timeGridWeek',
  // 移动端日视图：title 显示当天日期（带星期）
  ...(isMobile.value ? { titleFormat: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' } as const } : {}),
  events: calendarEvents.value,
  editable: true,
  selectable: true,
  droppable: true, // Enable dropping from external sources
  headerToolbar: isMobile.value
    ? { left: '', center: 'title', right: '' }
    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
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
  dateClick: handleDateClick, // 点击空白时间格新增日程
  select: handleSelect, // 拖选时段新增日程（精确起止）
  eventClick: handleEventClick, // 移动端：双击事件编辑（自判定）
  eventDidMount: handleEventDidMount, // web 端：右击事件编辑
  
  firstDay: 1, // Start week on Monday
  dayHeaderContent: (arg: any) => {
    // 移动端日视图：title 已显示当天日期，隐藏列头避免重复（只保留一行表头）
    if (isMobile.value) return ''
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

// 设备切换时同步默认视图（initialView 仅首次渲染生效，resize 切换设备需用 API changeView）
watch(isMobile, (m) => {
  const api = fullCalendar.value?.getApi()
  if (api) api.changeView(m ? 'timeGridDay' : 'timeGridWeek')
})
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
  position: relative;
}

/* 新增日程弹窗颜色选项圆点 */
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

/* 待办栏收起后，日历右上角的展开入口 */
.calendar-wrapper .reopen-todo-btn {
  position: absolute;
  top: 17px;
  right: 5px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 5px;
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px var(--shadow-color);
  transition: all 0.2s ease;
}
.reopen-todo-btn:hover {
  border-color: var(--color-primary-light);
  color: var(--color-primary);
  background: var(--card-hover-bg);
}

/* 移动端：打开待办浮层的悬浮按钮（.calendar-wrapper 前缀提高特异性，
   覆盖全局 button:not(.el-button) 的圆角/缩放，确保圆形） */
.calendar-wrapper .mobile-todo-fab {
  position: absolute;
  top: 5px;
  right: 14px;
  z-index: 10;
  width: 52px;
  height: 52px;
  border: none;
  background: transparent;
  color: var(--color-primary);
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.calendar-wrapper .mobile-todo-fab:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 20px var(--color-primary-alpha);
}
.calendar-wrapper .mobile-todo-fab:active {
  transform: scale(0.94);
}

/* 移动端：隐藏空白的列头行（day 视图列头无内容，容器仍占位 → 干脆隐藏） */
@media (max-width: 768px) {
  .fc .fc-col-header {
    display: none !important;
  }
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
/* 只给右侧（月/周/日）视图切换组加右边距，给收起态的 reopen 按钮腾位。
   FC 工具栏按 left→center→right 渲染，右侧组恒为最后一个 chunk。 */
.fc-toolbar-chunk:last-child .fc-button-group {
  margin-right: 28px;
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

/* Current-time indicator (the red line + arrow).
   FC uses --fc-now-indicator-color; we layer height/opacity on top via
   custom properties set from settings. */
.fc .fc-timegrid-now-indicator-line {
  border-top-width: var(--now-indicator-height, 2px) !important;
  border-top-color: var(--now-indicator-color, #ef4444) !important;
  opacity: var(--now-indicator-opacity, 0.8);
}

.fc .fc-timegrid-now-indicator-arrow {
  border-color: var(--now-indicator-color, #ef4444) transparent transparent !important;
  opacity: var(--now-indicator-opacity, 0.8);
}
</style>
