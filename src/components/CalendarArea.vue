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
    <!-- 顶部工具条统一四段式（双端同构）：
         左 导航开关 | 中 时间选择器（选范围按跨度智能切视图）| 右 月视图 + 待办开关 -->
    <div class="calendar-toolbar">
      <div class="calendar-toolbar__side">
        <!-- 左端导航开关：桌面 toggle rail 显隐 / 移动端拉出导航抽屉 -->
        <button
          v-if="isMobile"
          class="toolbar-burger"
          title="导航菜单"
          @click="setNavDrawerOpen(true)"
        >
          <Menu :size="20" />
        </button>
        <button
          v-else
          class="toolbar-nav-toggle"
          :title="navRailCollapsed ? '显示导航栏' : '隐藏导航栏'"
          @click="setNavRailCollapsed(!navRailCollapsed)"
        >
          <PanelLeftClose v-if="!navRailCollapsed" :size="20" />
          <PanelLeftOpen v-else :size="20" />
        </button>
      </div>
      <div class="calendar-toolbar__center">
        <button class="period-nav" title="上一时段" @click="shiftPeriod(-1)">
          <ChevronLeft :size="20" />
        </button>
        <!-- 区间模式：两端共用 EP daterange（所见=所选）。移动端面板收窄为单月：
             unlink-panels 使左面板自带前进箭头，CSS 隐藏右面板（EP 双月 646px 溢出手机屏） -->
        <el-date-picker
          v-if="pickerMode !== 'month'"
          ref="pickerRef"
          v-model="selectedRange"
          class="calendar-title-picker"
          type="daterange"
          :unlink-panels="isMobile"
          :popper-class="isMobile ? 'mobile-range-panel' : undefined"
          range-separator="–"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="M月D日"
          :clearable="false"
          @change="handlePickerChange"
        />
        <!-- 月模式（两端共用）：月选择器 + 月视图 -->
        <el-date-picker
          v-else
          ref="pickerRef"
          v-model="selectedMonth"
          class="calendar-title-picker calendar-month-picker"
          type="month"
          :clearable="false"
          format="YYYY年M月"
          @change="handleMonthPick"
        />
        <button class="period-nav" title="下一时段" @click="shiftPeriod(1)">
          <ChevronRight :size="20" />
        </button>
      </div>
      <div class="calendar-toolbar__side calendar-toolbar__side--right">
        <!-- 月视图 toggle：激活时选择器切换为月选择器。
             网页端常驻；移动端由「设置-视觉与外观」控制（默认隐藏） -->
        <button v-if="!isMobile || settings.showMonthButton" class="month-toggle" :class="{ active: pickerMode === 'month' }" @click="toggleMonthMode" title="月视图">
          月
        </button>
        <!-- 待办面板开关（原待办头部"收起待办栏"按钮移此，双端统一）：
             web 收/展侧栏，移动端收/开浮层 -->
        <button
          class="todo-toggle"
          :title="todoVisible ? '收起待办栏' : '展开待办栏'"
          @click="setTodoVisible(!todoVisible)"
        >
          <PanelRightClose v-if="todoVisible" :size="20" />
          <PanelRight v-else :size="20" />
        </button>
      </div>
    </div>

    <FullCalendar ref="fullCalendar" :options="calendarOptions" />

    <!-- 日程新增/编辑弹窗（web 右击、移动双击事件打开编辑）——表单/校验在 ScheduleDialog -->
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
import dayjs from 'dayjs'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import type { CalendarOptions, DateSelectArg, DatesSetArg, DayHeaderContentArg, EventClickArg, EventDropArg, EventMountArg } from '@fullcalendar/core'

// FC v6 core 未直接导出 eventReceive 回调的 Arg 类型，从 CalendarOptions 推导
type EventReceiveArg = Parameters<NonNullable<CalendarOptions['eventReceive']>>[0]
// v6 的 eventResize 参数类型（EventResizeDoneArg）未从 core 导出，同法取形
type EventResizeArg = Parameters<NonNullable<CalendarOptions['eventResize']>>[0]
import { storeToRefs } from 'pinia'
import { useTaskStore, useSettingsStore, useThemeStore, useUIStore } from '../stores'
import { PanelRight, PanelRightClose, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight, Menu } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { colorScheme } from '../constants/colors'
import { DEFAULT_SCHEDULE_START, DEFAULT_SCHEDULE_END, DEFAULT_SCHEDULE_COLOR } from '../constants/schedule'
import ScheduleDialog, { type ScheduleFormValue } from './ScheduleDialog.vue'
import { useSwipe } from '../composables/useSwipe'

const taskStore = useTaskStore()
const { activeSchedules } = storeToRefs(taskStore) // 活跃视图（墓碑已滤）
const { updateSchedule, addScheduleFromTask, addSchedule, deleteSchedule } = taskStore // action
const { settings } = storeToRefs(useSettingsStore())
const { isDark } = storeToRefs(useThemeStore())
const uiStore = useUIStore()
const { isMobile, todoVisible, navRailCollapsed, gotoDateRequest } = storeToRefs(uiStore) // state
const { setTodoVisible, setNavDrawerOpen, setNavRailCollapsed } = uiStore // action

const fullCalendar = ref<InstanceType<typeof FullCalendar> | null>(null)

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
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// Convert our schedules to FullCalendar event format
const calendarEvents = computed(() => {
  return activeSchedules.value.map(task => {
    const scheme = colorScheme(task.color)
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

/**
 * 日程移动/拉伸后的落库（eventDrop / eventResize 共用，两回调才带 revert 能力）。
 * Schedule 模型无跨天字段（date + 同日 start/end）：拖过零点会解析出
 * endTime < startTime 的非法数据——校验失败 revert 回原位，不落库。
 */
const applyEventMove = (info: EventDropArg | EventResizeArg) => {
  const event = info.event

  // Format dates back to our custom format
  const startDate = new Date(event.start as Date)
  const endDate = event.end ? new Date(event.end as Date) : new Date(startDate.getTime() + 60 * 60 * 1000)

  const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
  const startTimeStr = startDate.toTimeString().substring(0, 5)
  const endTimeStr = endDate.toTimeString().substring(0, 5)

  if (endTimeStr <= startTimeStr) {
    info.revert()
    ElMessage.warning('日程不能跨零点，请调整到更早的时段')
    return
  }
  updateSchedule(event.id, {
    date: dateStr,
    startTime: startTimeStr,
    endTime: endTimeStr
  })
}

const handleEventReceive = (info: EventReceiveArg) => {
  const { event } = info
  const taskId = event.extendedProps.taskId

  if (taskId) {
    const startDate = new Date(event.start as Date)
    const endDate = event.end ? new Date(event.end as Date) : new Date(startDate.getTime() + 60 * 60 * 1000)

    const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const startTimeStr = startDate.toTimeString().substring(0, 5)
    const endTimeStr = endDate.toTimeString().substring(0, 5)

    // 跨零点时段（如 23:30 拖入默认时长越过零点）非法——不排期，弹回临时事件
    if (endTimeStr <= startTimeStr) {
      info.revert()
      ElMessage.warning('日程不能跨零点，请拖到更早的时段')
      return
    }

    // 将叶子任务排期为日程
    addScheduleFromTask(taskId, dateStr, startTimeStr, endTimeStr, event.extendedProps.color || DEFAULT_SCHEDULE_COLOR)
  }
  
  // Revert the temporary event inserted by FullCalendar
  // because Vue will reactively provide the new event via `calendarEvents`
  info.revert()
  // 仅移动端：拖入成功后关闭待办浮层（web 端保持侧栏不动）
  if (isMobile.value) setTodoVisible(false)
}

// ---- 日程弹窗（新增/编辑共用，表单态/校验在 ScheduleDialog）+ 事件交互 ----
const newScheduleDialogVisible = ref(false)
// 弹窗打开时的表单初始值（组件在 visible 翻真时拷贝为本地可编辑副本）
const scheduleDialogInitial = ref<ScheduleFormValue>({
  title: '', date: '', startTime: DEFAULT_SCHEDULE_START, endTime: DEFAULT_SCHEDULE_END, color: DEFAULT_SCHEDULE_COLOR
})
// 非空 = 编辑模式（更新/删除），空 = 新增模式
const editingScheduleId = ref<string | null>(null)

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const openNewScheduleDialog = (dateStr: string, startTimeStr: string, endTimeStr: string) => {
  editingScheduleId.value = null
  scheduleDialogInitial.value = { title: '', date: dateStr, startTime: startTimeStr, endTime: endTimeStr, color: DEFAULT_SCHEDULE_COLOR }
  newScheduleDialogVisible.value = true
}

// 打开编辑弹窗（预填现有值）
const openEditDialog = (eventId: string) => {
  const s = activeSchedules.value.find(x => x.id === eventId)
  if (!s) return
  editingScheduleId.value = s.id
  scheduleDialogInitial.value = { title: s.title, date: s.date, startTime: s.startTime, endTime: s.endTime, color: s.color }
  newScheduleDialogVisible.value = true
}

// 移动端：轻触事件，两次快速轻触同一事件（<350ms）视为双击 → 编辑。
// FC 无原生双击回调，基于 eventClick 自判定；滚动是滑动不会触发 eventClick，无双击误判。
let lastEventTap = { id: '', time: 0 }
const handleEventClick = (info: EventClickArg) => {
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
const handleEventDidMount = (info: EventMountArg) => {
  info.el.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault()
    if (isMobile.value) return // 移动端走双击入口（部分浏览器长按会触发 contextmenu，忽略）
    openEditDialog(info.event.id)
  })
}

// 拖选时段：精确起止时间（web 拖选；移动端长按约 1s 后拖选，与滑动翻页的 <800ms 快扫错开）。
// 注意：FC 在 selectable 模式下，静止单击也会走本回调，且区间恰好 = 一个 snap（5min）；
// 单击新增已刻意去除（易误触），用「≤ 一个 snap」闸门过滤（实测单击正是 5min，边界相等须用 <=）。
const MIN_SELECT_MS = 5 * 60 * 1000 // snapDuration 5min；真实拖选至少 ≥ 10min 才弹窗
const handleSelect = (info: DateSelectArg) => {
  const start = new Date(info.start)
  const end = new Date(info.end)
  if (end.getTime() - start.getTime() <= MIN_SELECT_MS) return // 单击/极短选区：忽略
  openNewScheduleDialog(fmtDate(start), fmtTime(start), fmtTime(end))
}

// 落库与提示（校验已由 ScheduleDialog 完成，save 携带合法表单值）
const confirmNewSchedule = (form: ScheduleFormValue) => {
  const { title, date, startTime, endTime, color } = form
  if (editingScheduleId.value) {
    updateSchedule(editingScheduleId.value, { title: title.trim(), date, startTime, endTime, color })
    ElMessage.success('已更新')
  } else {
    addSchedule({ title: title.trim(), date, startTime, endTime, color })
    ElMessage.success('已新增日程')
  }
}

const handleDeleteSchedule = () => {
  if (!editingScheduleId.value) return
  deleteSchedule(editingScheduleId.value)
  ElMessage.success('已删除')
  newScheduleDialogVisible.value = false
}

// ---- 工具栏中央时间选择器 ----
// 区间模式（默认）：两端统一「所见=所选」自定义区间（≤14 天 timeGrid，保留时间轴）。
// 桌面 EP daterange 双月面板；移动端同一选择器，unlink-panels + 隐藏右面板收窄为单月。
// 月模式：「月」按钮 toggle → 月选择器 + 标准月视图（桌面专属，移动端隐藏按钮）
// pickerMode 由视图状态驱动（datesSet 同步），保证与日历所见一致
const pickerRef = ref<{ handleClose?: () => void } | null>(null)
const pickerMode = ref<'range' | 'month'>('range')
const selectedRange = ref<[Date, Date]>([new Date(), new Date()])
const selectedMonth = ref<Date>(new Date())
// 当前 FC 视图类型（datesSet 同步）：timeGridDay 单日翻日 / 其余按区间整段平移
const curViewType = ref('')

/* 区间选择上限（天）：两端独立设置（设置页可调） */
const maxRangeDays = computed(() =>
  isMobile.value ? settings.value.mobileMaxRangeDays : settings.value.webMaxRangeDays
)

// 移动端多日区间视图恢复列头（单日视图列头冗余仍隐藏）
const showColHeader = computed(() =>
  isMobile.value && curViewType.value !== '' &&
  curViewType.value !== 'timeGridDay' && curViewType.value !== 'dayGridMonth'
)

// 自定义区间视图的可见范围（由 picker 选择驱动；end 为排他边界 = 次日 0 点）
let customRange: { start: Date; end: Date } = {
  start: dayjs().startOf('day').toDate(),
  end: dayjs().startOf('day').add(7, 'day').toDate()
}

// FC 日期区间变化 → 回写选择器 + 同步模式/视图类型（两端统一：移动端单日视图
// 即 1 天区间，datesSet 天然覆盖胶囊文案与 customRange 的同步）。
// 用 currentStart/currentEnd（逻辑区间）而非 start/end（月视图含跨月补齐格）；
// FC 的 end 一律排他，减 1 天得到用户理解的"含尾日期"
const handleDatesSet = (info: DatesSetArg) => {
  const s = new Date(info.view.currentStart)
  curViewType.value = info.view.type
  if (info.view.type === 'dayGridMonth') {
    pickerMode.value = 'month'
    selectedMonth.value = s
  } else {
    pickerMode.value = 'range'
    selectedRange.value = [s, dayjs(info.view.currentEnd).subtract(1, 'day').toDate()]
    // 同步 customRange：否则窗口尺寸切换（watch(isMobile) → timeGridWeek）后，
    // 首次按 ‹/› 或滑动会按旧区间跳变；也修正初始视图与 customRange 不一致
    customRange = { start: s, end: new Date(info.view.currentEnd) }
  }
}

// 应用自定义区间（桌面 daterange 与移动端弹窗共用）：
// 上限截断 + 所见=所选（timeGridCustom 的 visibleRange 读 customRange）
const applyCustomRange = (range: [Date, Date]) => {
  const start = dayjs(range[0]).startOf('day')
  let end = dayjs(range[1]).startOf('day')
  if (end.diff(start, 'day') + 1 > maxRangeDays.value) {
    end = start.add(maxRangeDays.value - 1, 'day')
    ElMessage.warning(`最多选择 ${maxRangeDays.value} 天，已自动截断`)
  }
  customRange = { start: start.toDate(), end: end.add(1, 'day').toDate() } // FC end 排他
  // 单日区间直接用日视图（移动端列头隐藏/翻日语义与旧单日选择器一致；桌面仅少一列冗余列头）
  if (start.isSame(end, 'day')) {
    fullCalendar.value?.getApi().changeView('timeGridDay', start.toDate())
    return
  }
  fullCalendar.value?.getApi().changeView('timeGridCustom', start.toDate())
}

// 桌面区间选择 → 应用（弹层收起）
const handlePickerChange = (range: [Date, Date] | null) => {
  if (!range || !range[0] || !range[1]) return
  applyCustomRange(range)
  pickerRef.value?.handleClose?.()
}

// 月模式：选中月份 → 跳转该月
const handleMonthPick = (d: Date | null) => {
  if (!d) return
  fullCalendar.value?.getApi().changeView('dayGridMonth', d)
  pickerRef.value?.handleClose?.()
}

// 「月」按钮：toggle 进出月模式
const toggleMonthMode = () => {
  const api = fullCalendar.value?.getApi()
  if (!api) return
  if (pickerMode.value === 'month') {
    // 回区间模式：恢复上次自定义区间
    api.changeView('timeGridCustom', customRange.start)
  } else {
    api.changeView('dayGridMonth', customRange.start)
  }
}

// ‹ › / 左右滑动 时段平移：月模式翻月；单日视图（移动端默认）翻天；
// 其余（自定义区间等）整段平移区间天数——按视图类型分支而非设备，
// 移动端弹窗选出多日区间后滑动同样按整段平移
const shiftPeriod = (dir: 1 | -1) => {
  const api = fullCalendar.value?.getApi()
  if (!api) return
  if (pickerMode.value === 'month') {
    const cur = dayjs(api.getDate()).startOf('month').add(dir, 'month')
    api.changeView('dayGridMonth', cur.toDate())
    return
  }
  if (curViewType.value === 'timeGridDay') {
    api.gotoDate(dayjs(api.getDate()).add(dir, 'day').toDate())
    return
  }
  const days = dayjs(customRange.end).startOf('day').diff(dayjs(customRange.start).startOf('day'), 'day')
  customRange = {
    start: dayjs(customRange.start).startOf('day').add(days * dir, 'day').toDate(),
    end: dayjs(customRange.end).startOf('day').add(days * dir, 'day').toDate()
  }
  api.changeView('timeGridCustom', customRange.start)
}

const calendarOptions = computed(() => ({
  plugins: [timeGridPlugin, interactionPlugin, dayGridPlugin],
  initialView: isMobile.value ? 'timeGridDay' : 'timeGridWeek',
  events: calendarEvents.value,
  editable: true,
  selectable: true,
  droppable: true, // Enable dropping from external sources
  // 自定义区间视图：所见=所选（≤14 天，带时间轴）
  views: {
    timeGridCustom: { type: 'timeGrid', visibleRange: () => customRange }
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
  eventDrop: applyEventMove, // 日程拖动落库（跨零点校验失败 revert）
  eventResize: applyEventMove, // 日程拉伸落库（跨零点校验失败 revert）
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
}))

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

/* 新增日程弹窗颜色选项圆点：已随 ScheduleDialog 组件化（scoped 自带），此处移除 */

/* ===== 移动端 daterange 面板收窄为单月（popper 传送至 body，需全局样式）=====
   EP 范围面板双月并排 ~646px 溢出手机屏；unlink-panels 使左面板自带前进箭头，
   隐藏右侧面板后仍是可完整导航的单月范围选择。
   左面板定宽 322px（同 EP 单日期面板），单元格 ≈44px 触控友好；
   content 为 table-cell 布局，不定宽会自适应撑满 body */
.mobile-range-panel .el-date-range-picker {
  width: fit-content;
  max-width: calc(100vw - var(--space-lg));
}

.mobile-range-panel .el-picker-panel__body,
.mobile-range-panel .el-picker-panel__body-wrapper {
  width: auto;

  /* EP 给范围面板 body 预留 min-width 513px（双月表格最小宽），
     隐藏右面板后它就是右侧空白区的来源，必须显式清零 */
  min-width: 0;
}

.mobile-range-panel .el-date-range-picker__content.is-left {
  width: 322px;
}

.mobile-range-panel .el-date-range-picker__content.is-right {
  display: none;
}

/* ===== 顶部工具条（文档流三段式，替代已移除的 FC 工具栏）===== */

/* 左右等宽占位 + 中央选择器，保证 picker 始终水平居中；右侧承载待办开关。
   与待办头部（TodoSidebar .sidebar-header）同构的灰带：12px 灰顶边 + 44 内容 + 1px 底边，
   两带用同一 calc 定高（子元素不撑高）几何严格相等；底边直接贴 FC 网格（无间距） */
.calendar-toolbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: calc(44px + var(--space-md) + 1px); /* 桌面 57 / 移动 53（顶边随令牌） */

  /* 上下边框不对称（12px 顶 / 1px 底），flex 只在内容盒居中会整体偏下 (12-1)/2=5.5px；
     补「边框差」等量 padding-bottom，把按钮/选择器抬回整条灰带的视觉中心 */
  padding: 0 var(--space-md) calc(var(--space-md) - 1px);
  border-top: var(--space-md) solid var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.calendar-toolbar__side {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.calendar-toolbar__side--right {
  justify-content: flex-end;
  gap: var(--space-sm);
}

/* 中央组合：‹ 选择器 › */
.calendar-toolbar__center {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* ‹ › 按钮：移动优先默认隐藏（移动端翻时段由左右滑动手势承担），桌面恢复显示。
   「月」按钮不再由 CSS 控制——显示与否走 settings.showMonthButton（v-if）。
   .calendar-toolbar 祖先提权：全局 button:not(.el-button)（theme.css）特异性更高，
   单类 .period-nav 会被其 display:flex 压过导致隐藏失效 */
.calendar-toolbar .period-nav {
  display: none;
}

@media (width >= 769px) {
  .calendar-toolbar .period-nav {
    display: inline-flex;
  }
}

/* 工具条按钮统一形态：32×32 透明底、无边框、hover 灰底 + 主题色。
   period-nav / month / nav 开关 / todo 开关 / burger 五者共用一组规则（display 与居中
   由全局 button 规则和上方恢复块管理，这里不再声明）；month-toggle 仅追加文字排版 */
.calendar-toolbar .period-nav,
.calendar-toolbar .month-toggle,
.calendar-toolbar .toolbar-nav-toggle,
.calendar-toolbar .todo-toggle,
.calendar-toolbar .toolbar-burger {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

/* 月按钮：统一形态内的文字排版（字号与 20px 图标视觉等重） */
.calendar-toolbar .month-toggle {
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
  line-height: 1;
}

.calendar-toolbar .period-nav:hover,
.calendar-toolbar .month-toggle:hover,
.calendar-toolbar .toolbar-nav-toggle:hover,
.calendar-toolbar .todo-toggle:hover,
.calendar-toolbar .toolbar-burger:hover {
  background: var(--el-fill-color); /* 工具条灰带上 hover 需更深一档可见 */
  color: var(--el-color-primary);
}

.calendar-toolbar .month-toggle.active {
  background: var(--color-primary);
  color: #fff;
}

/* 日历主体填满工具条以下剩余空间 */
.calendar-wrapper .fc {
  flex: 1;
  min-height: 0;
}

/* 宽度与高度：daterange 根元素带内联 --el-date-editor-width 变量 + 组件单类 width 规则，
   须用「祖先+双类」高优先级选择器 + 直接 width 声明才能覆盖 */
.calendar-wrapper .calendar-title-picker.el-date-editor {
  width: 250px;

  --el-date-editor-width: 250px;
  height: 40px;
}

/* 胶囊底：白底浮于工具条灰带（原灰底会融进带子），与 FC 按钮组质感统一 */
.calendar-title-picker.el-range-editor {
  background: var(--el-bg-color);
  box-shadow: none !important;
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-lg);
  cursor: pointer;
  transition: background var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}

.calendar-title-picker.el-range-editor:hover,
.calendar-title-picker.el-range-editor.is-active {
  background: var(--el-fill-color);
  box-shadow: var(--shadow-sm) !important;
}

/* 移动端紧凑档：左右内边距 8→4、宽度 250→230 同步收窄（空隙压掉后内容可用区不减，
   纯省屏宽）；month picker 共用 calendar-title-picker 类同宽，避免模式切换宽度跳动 */
html.platform-mobile .calendar-wrapper .calendar-title-picker.el-date-editor {
  width: 230px;

  --el-date-editor-width: 230px;
}

html.platform-mobile .calendar-title-picker.el-range-editor {
  padding: var(--space-xs);
}

/* 日期文本：大号加粗居中 */
.calendar-title-picker .el-range-input {
  background: transparent;
  font-size: 1.08rem;
  font-weight: var(--weight-semibold);
  color: var(--el-text-color-primary);
  cursor: pointer;
  text-align: center;
}

/* 两个日期框 EP 默认 39% 定宽；移动端胶囊收窄 20px 后按 42% 回补，
   保证最长 "12月31日"（1.08rem×5 字 ≈ 87px）不贴边截字 */
html.platform-mobile .calendar-title-picker .el-range-input {
  width: 42%;
}

/* 清除按钮隐藏态仍占 14px、破坏胶囊内对称，隐藏；左侧日历图标保留（主题色点缀） */
.calendar-title-picker .el-range__close-icon {
  display: none;
}

/* 日历图标：主题色，调大一档（18px）与 1.08rem 粗体日期文字视觉等重 */
.calendar-title-picker .el-range__icon {
  color: var(--el-color-primary);
  font-size: 18px;
  margin-right: 2px;
}

/* 分隔符：主题色点缀 */
.calendar-title-picker .el-range-separator {
  color: var(--el-color-primary);
  font-weight: var(--weight-semibold);
}

/* 分隔符 "–"：en-dash 字面自带留白，移动端紧凑档去掉 EP 默认 padding 0 5px */
html.platform-mobile .calendar-title-picker .el-range-separator {
  padding: 0;
}

/* 桌面月模式选择器，type=month 的 el-input 结构。
   宽度规则：月选择器带 calendar-title-picker 类，宽度由上方 daterange 的 250px 规则统一生效 */
.calendar-month-picker .el-input__wrapper {
  background: var(--el-bg-color); /* 白底浮于工具条灰带（同 daterange 胶囊） */
  box-shadow: none !important;
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
  transition: background var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}

.calendar-month-picker .el-input__wrapper:hover,
.calendar-month-picker .el-input__wrapper.is-active {
  box-shadow: var(--shadow-sm) !important;
}

.calendar-month-picker .el-input__inner {
  font-size: var(--font-base);
  font-weight: var(--weight-semibold);
  color: var(--el-text-color-primary);
  text-align: center;
  cursor: pointer;
}

.calendar-month-picker .el-input__prefix {
  color: var(--el-color-primary);
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
