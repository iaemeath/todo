<template>
  <div
    class="calendar-wrapper glass-panel"
    :class="{ 'show-col-header': showColHeader }"
    :style="{
      '--slot-height': settings.slotHeight + 'px',
      '--major-line-width': settings.majorLineWidth + 'px',
      '--major-line-opacity': settings.majorLineOpacity,
      '--minor-line-width': settings.minorLineWidth + 'px',
      '--minor-line-opacity': settings.minorLineOpacity,
      '--minor-line-style': settings.showMinorLines ? 'solid' : 'none',
      '--now-indicator-color': settings.nowIndicatorColor,
      '--now-indicator-height': settings.nowIndicatorHeight + 'px'
    }"
  >
    <!-- 顶部工具条（导航开关/时间选择器/月视图/待办开关）——独立组件，日历操作走 emits -->
    <CalendarToolbar
      v-model:selected-range="selectedRange"
      v-model:selected-month="selectedMonth"
      :picker-mode="pickerMode"
      @shift="shiftPeriod"
      @range-change="onRangeChange"
      @month-pick="onMonthPick"
      @toggle-month="toggleMonthMode"
      @today="goToday"
      @create="openCreateSchedule"
    />

    <FullCalendar ref="fullCalendar" :options="calendarOptions" />

    <!-- 日程新增/编辑弹窗（web 单击/右击、移动双击事件打开编辑）——表单/校验在 ScheduleDialog -->
    <ScheduleDialog
      v-model:visible="newScheduleDialogVisible"
      :header="editingScheduleId ? '编辑日程' : '新增日程'"
      :initial="scheduleDialogInitial"
      :confirm-text="editingScheduleId ? '保存' : '创建'"
      :show-delete="!!editingScheduleId"
      @save="confirmNewSchedule"
      @delete="handleDeleteSchedule"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import type { DayHeaderContentArg } from '@fullcalendar/core'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useSettingsStore, useUIStore } from '../stores'
import ScheduleDialog from './ScheduleDialog.vue'
import CalendarToolbar from './CalendarToolbar.vue'
import { useSwipe } from '../composables/useSwipe'
import { useCalendarNavigation } from '../composables/useCalendarNavigation'
import { useScheduleCalendar } from '../composables/useScheduleCalendar'

const { settings } = storeToRefs(useSettingsStore())
const uiStore = useUIStore()
const { isMobile, gotoDateRequest } = storeToRefs(uiStore)

const fullCalendar = ref<InstanceType<typeof FullCalendar> | null>(null)

// 初始滚动定位：FC 默认 scrollTime 06:00——下午/晚间打开首屏停在上午、当前时刻线在屏外。
// 定位到 now-2h 并夹取显示时段（末段预留 4h 可视；显示时段本身不足 4h 则顶格）
const initialScrollHour = (() => {
  const start = settings.value.startHour
  const end = settings.value.endHour
  const nowH = new Date().getHours() - 2
  return Math.min(Math.max(nowH, start), Math.max(start, end - 4))
})()

// 提醒通知点击定位：消费 ui store 的跳转请求（gotoDate 保持当前视图类型平移），
// 消费即清空；连续两次同日期请求由 ts 保证触发
watch(gotoDateRequest, (req) => {
  if (!req) return
  fullCalendar.value?.getApi().gotoDate(req.date)
  gotoDateRequest.value = null
})
let resizeObserver: ResizeObserver | null = null
let wrapperEl: HTMLElement | null = null

// ---- 移动端：左右滑动翻页（FC 标准版无滑动导航，手势判定细节见 useSwipe）----
// 起点须在日历网格内且不在日程块上（日程块交给 FC 拖拽，工具条上的滑动不翻页）；
// 快速轻扫与长按拖选（FC touch 下按 longPressDelay 才触发）天然错开；
// 翻页后 datesSet 自动回写中央时间选择器。与 ‹ › 按钮共用 shiftPeriod：
// 单日视图翻天，多日区间整段平移（按视图类型分支）
useSwipe('.calendar-wrapper', (dir) => shiftPeriod(dir), {
  enabled: () => isMobile.value,
  targetSel: '.fc',
  skipSel: '.fc-event'
})

onMounted(() => {
  // Initialize ResizeObserver to fix FullCalendar flex resize issue
  wrapperEl = document.querySelector('.calendar-wrapper')
  if (wrapperEl) {
    resizeObserver = new ResizeObserver(() => {
      if (fullCalendar.value) {
        fullCalendar.value.getApi().updateSize()
      }
    })
    resizeObserver.observe(wrapperEl)
  }
  // 一次性手势教学（coach mark）：移动端"长按拖选创建日程"零可发现性——首次进入提示一次
  if (isMobile.value && !localStorage.getItem('coach_drag_select')) {
    localStorage.setItem('coach_drag_select', '1')
    ElMessage({ message: '提示：长按日历空白处并拖动，圈选时段即可创建日程', duration: 6000, showClose: true })
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// ---- 日程事件与弹窗交互（事件映射/拖拽落库/编辑入口/弹窗状态）----
const {
  calendarEvents,
  newScheduleDialogVisible,
  scheduleDialogInitial,
  editingScheduleId,
  selectedScheduleIds,
  openNewScheduleDialog,
  confirmNewSchedule,
  handleDeleteSchedule,
  applyEventMove,
  handleEventReceive,
  handleSelect,
  handleEventClick,
  handleEventDidMount,
  handleEventDragStart,
  clearDragGhost
} = useScheduleCalendar()

// ---- 视图导航（中央时间选择器 ↔ FC 双向同步）----
const nav = useCalendarNavigation(fullCalendar)
const { pickerMode, selectedRange, selectedMonth, showColHeader, shiftPeriod, toggleMonthMode, goToday, handleDatesSet } = nav

// 显式新增入口（桌面工具条 +）：预填今天下一个整点起 1 小时
const openCreateSchedule = () => {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  openNewScheduleDialog(fmtDate(start), fmtTime(start), fmtTime(end))
}

// 工具栏回调：弹层收起已在 CalendarToolbar 内自理，这里只负责应用
const onRangeChange = (range: [Date, Date] | null) => {
  if (!range || !range[0] || !range[1]) return
  nav.applyCustomRange(range)
}
const onMonthPick = (d: Date | null) => {
  if (!d) return
  nav.changeMonth(d)
}

const calendarOptions = computed(() => {
  // 选中集在求值时先提出（闭包内惰性读取不进依赖收集）——选中变化重算
  // options，新 eventClassNames 引用驱动 FC 重渲染事件类名
  const selectedIds = selectedScheduleIds.value
  return {
  plugins: [timeGridPlugin, interactionPlugin, dayGridPlugin],
  initialView: isMobile.value ? 'timeGridDay' : 'timeGridWeek',
  events: calendarEvents.value,
  editable: true,
  selectable: true,
  droppable: true, // Enable dropping from external sources
  // 自定义区间视图：所见=所选（≤14 天，带时间轴）
  views: {
    timeGridCustom: { type: 'timeGrid', visibleRange: () => nav.getCustomRange() }
  },
  // 工具栏整体移除：视图切换与日期导航统一由中央时间选择器承担
  // （桌面：任意区间自定义视图；移动端：单日→日视图）
  headerToolbar: false as const,
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
  // 初始定位到当前时段（now-2h）；翻页不重置滚动（保持用户浏览位置）
  scrollTime: `${String(initialScrollHour).padStart(2, '0')}:00:00`,
  scrollTimeReset: false,
  eventDrop: applyEventMove, // 日程拖动落库（跨零点校验失败 revert；多选时整组按天数差平移）
  eventResize: applyEventMove, // 日程拉伸落库（跨零点校验失败 revert）
  eventDragStart: handleEventDragStart, // 多选整组拖拽：其余成员 DOM 跟随（纯视觉）
  eventDragStop: clearDragGhost, // 拖拽结束（含取消）：清除跟随位移
  // 选中高亮（web 单击/Ctrl+单击选中集合 → 拖拽整组平移与 Ctrl+V 的操作对象）
  eventClassNames: (arg: { event: { id: string } }) =>
    selectedIds.has(arg.event.id) ? ['ev-selected'] : [],
  eventReceive: handleEventReceive, // When external event is dropped
  select: handleSelect, // 拖选时段新增日程（唯一新增入口；单击被时长闸门过滤，防误触）
  eventClick: handleEventClick, // 移动端：双击事件编辑（自判定）
  eventDidMount: handleEventDidMount, // web 端：右击事件编辑
  datesSet: handleDatesSet, // 日期区间变化 → 同步中央时间选择器

  firstDay: 1, // Start week on Monday
  dayHeaderContent: (arg: DayHeaderContentArg) => {
    // 月视图列头显示星期名；其余视图两端统一 M月D日 格式
    if (arg.view.type === 'dayGridMonth') {
      return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][arg.date.getDay()]
    }
    // 移动端单日视图：中央选择器已显示当天日期，列头留空（整行由 CSS 隐藏）
    if (isMobile.value && arg.view.type === 'timeGridDay') return ''
    return `${arg.date.getMonth() + 1}月${arg.date.getDate()}日`
  },

  locale: 'zh-cn'
  }
})

// 设备切换时同步默认视图（initialView 仅首次渲染生效，resize 切换设备需用 API changeView）
watch(isMobile, (m) => {
  const api = fullCalendar.value?.getApi()
  if (api) api.changeView(m ? 'timeGridDay' : 'timeGridWeek')
})
</script>

<style>
/*
  Deep CSS Overrides to make FullCalendar look like our "拾光 Glassmorphism" Theme
  FullCalendar creates global classes, so we don't use 'scoped' for these overrides.
  工具条与选择器的样式随 CalendarToolbar 组件分离，此处仅保留容器与 FC 主题覆盖。
*/
.calendar-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;

  /* FC 网格铺满面板：不留内边距（左右/底部全部让给日历内容），
     圆角裁切由 overflow:hidden 完成；工具条自身的内边距独立设置 */
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* 移动端贴屏通栏：面板四边贴屏幕边缘，glass-panel 的圆角与边框会在屏幕边
   产生缺口/细线，全部拉平 */
html.platform-mobile .calendar-wrapper {
  border-radius: 0;
  border: none;
}

/* 长按拖选的按压反馈：触屏按住时间格出现淡色浸染（FC longPressDelay 期间的
   唯一视觉信号，配合一次性 coach mark 提升"按住可拖选"的可感知性） */
html.platform-mobile .calendar-wrapper .fc-timegrid-slot-lane:active,
html.platform-mobile .calendar-wrapper .fc-timegrid-col:active {
  background: var(--color-primary-alpha);
}

/* 日历主体填满工具条以下剩余空间 */
.calendar-wrapper .fc {
  flex: 1;
  min-height: 0;
}

/* 移动端：单日视图列头冗余（中央选择器已示当天），整行隐藏；
   多日区间视图（show-col-header 由视图类型驱动）不隐藏，列头与正文同源同格式。
   用 platform-mobile 类作用域（与 ui store isMobile 同源）而非媒体查询：
   FC 列头是表格布局，翻转写法无法可靠恢复其默认 display 值 */
html.platform-mobile .calendar-wrapper:not(.show-col-header) .fc .fc-col-header {
  display: none !important;
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
  border-radius: 4px; /* stylelint-disable-line declaration-property-value-disallowed-list -- FC 深度覆盖战争区 */
}

.fc-scroller::-webkit-scrollbar-thumb:hover {
  background: var(--border-glass);
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
  font-weight: 600 !important; /* stylelint-disable-line declaration-property-value-disallowed-list -- FC 战争区（!important 对抗 FC 内联样式） */
  font-size: 0.75rem !important;
  position: absolute;
  top: 0;
  left: 1px;
  transform: translateY(-50%);  /* 让文字中心对准刻度线 */
  background: var(--el-bg-color);
  padding: 0 4px;
  border-radius: 3px; /* stylelint-disable-line declaration-property-value-disallowed-list -- FC 深度覆盖战争区 */
  z-index: 2;
  white-space: nowrap;
}

/* Headers */
.fc .fc-col-header-cell-cushion {
  color: var(--text-primary) !important;
  font-weight: 800 !important; /* stylelint-disable-line declaration-property-value-disallowed-list -- FC 列头超粗为设计特例（超出字重刻度） */
  padding: 3px var(--space-xs) !important; /* 表头行紧凑：8px→3px 上下 */
  font-size: var(--font-xs) !important;
  white-space: nowrap !important;
}

/* Event Styles */
.fc-timegrid-event, .fc-daygrid-event {
  border-width: 1.5px !important;
  border-radius: var(--radius-md) !important;
  box-shadow: var(--shadow-md);
  transition: transform var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}

/* 选中日程高亮（web 单击选中；Ctrl+V 复制的操作对象） */
.fc .fc-event.ev-selected {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  box-shadow: var(--shadow-lg);
}

/* 撤销 toast 内的行动按钮（ElMessage VNode 挂 body，样式须全局——
   TodoSidebar 的同名 scoped 定义作用不到 ElMessage 根外的 DOM） */
.undo-toast {
  display: inline-flex;
  align-items: center;
  gap: var(--space-md);
}

.undo-toast__btn {
  background: transparent;
  border: none;
  color: var(--el-color-primary);
  font-size: var(--font-base);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  padding: var(--space-xs);
}

.fc-timegrid-event:hover {
  transform: scale(1.02);
  z-index: 10 !important;
  box-shadow: var(--shadow-lg);
}

.fc-event-main {
  padding: 4px 6px !important;
  font-family: var(--font-family) !important;
  font-size: 0.75rem !important;
  line-height: 1.3 !important;
  overflow: hidden;
  overflow-wrap: break-word;
}

/* Background Color Override for Day Area.
   --color-primary 是 hex 值，rgba(hex, a) 非法会整条丢弃——必须用 color-mix 派生透明度 */
.fc .fc-timegrid-col.fc-day-today {
  background-color: color-mix(in srgb, var(--color-primary) 2%, transparent) !important;
}

/* Current-time indicator (the red line + arrow).
   Color carries its own alpha (rgba from the color picker), so no separate
   opacity property is needed. */
.fc .fc-timegrid-now-indicator-line {
  border-top-width: var(--now-indicator-height, 2px) !important;
  border-top-color: var(--now-indicator-color, rgb(239 68 68 / 80%)) !important;
}

.fc .fc-timegrid-now-indicator-arrow {
  border-color: var(--now-indicator-color, rgb(239 68 68 / 80%)) transparent transparent !important;
}
</style>
