<template>
  <div
    class="calendar-wrapper glass-panel"
    :class="{ 'is-fullscreen': calendarFullscreen }"
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
    <!-- 顶部工具条：中央时间选择器（选范围按跨度智能切视图）+ 右侧待办开关 -->
    <div class="calendar-toolbar">
      <div class="calendar-toolbar__side"></div>
      <div class="calendar-toolbar__center">
        <button class="period-nav" title="上一时段" @click="shiftPeriod(-1)">
          <ChevronLeft :size="20" />
        </button>
        <!-- 移动端区间模式：单日选择 → 跳转该天（单月面板不溢出屏幕） -->
        <el-date-picker
          v-if="isMobile && pickerMode !== 'month'"
          ref="pickerRef"
          v-model="selectedDay"
          class="calendar-day-picker"
          type="date"
          :clearable="false"
          format="YYYY年M月D日"
          @change="handleDayPick"
        />
        <!-- 月模式（两端共用）：月选择器 + 月视图 -->
        <el-date-picker
          v-else-if="pickerMode === 'month'"
          ref="pickerRef"
          v-model="selectedMonth"
          class="calendar-title-picker calendar-month-picker"
          type="month"
          :clearable="false"
          format="YYYY年M月"
          @change="handleMonthPick"
        />
        <!-- 桌面区间模式：所见=所选的自定义区间 -->
        <el-date-picker
          v-else
          ref="pickerRef"
          v-model="selectedRange"
          class="calendar-title-picker"
          type="daterange"
          range-separator="–"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="M月D日"
          :clearable="false"
          @change="handlePickerChange"
        />
        <button class="period-nav" title="下一时段" @click="shiftPeriod(1)">
          <ChevronRight :size="20" />
        </button>
      </div>
      <div class="calendar-toolbar__side calendar-toolbar__side--right">
        <!-- 月视图 toggle：激活时选择器切换为月选择器 -->
        <button class="month-toggle" :class="{ active: pickerMode === 'month' }" @click="toggleMonthMode" title="月视图">
          月
        </button>
        <!-- 全屏 toggle：CSS 伪全屏（fixed 铺满），ESC 退出 -->
        <button
          class="fullscreen-toggle"
          :title="calendarFullscreen ? '退出全屏 (Esc)' : '全屏 (Esc)'"
          @click="toggleCalendarFullscreen"
        >
          <Minimize2 v-if="calendarFullscreen" :size="20" />
          <Maximize2 v-else :size="20" />
        </button>
        <!-- 待办栏收起后：web 展开侧栏 / 移动打开浮层 -->
        <button
          v-if="!isMobile && !todoVisible"
          class="reopen-todo-btn"
          @click="setTodoVisible(true)"
          title="展开待办栏"
        >
          <PanelRight :size="20" />
        </button>
        <button
          v-if="isMobile && !todoVisible"
          class="mobile-todo-fab"
          @click="setTodoVisible(true)"
          title="打开待办"
        >
          <PanelRight :size="24" />
        </button>
      </div>
    </div>

    <FullCalendar ref="fullCalendar" :options="calendarOptions" />

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
import dayjs from 'dayjs'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import type { CalendarOptions, DateSelectArg, DatesSetArg, DayHeaderContentArg, EventChangeArg, EventClickArg, EventMountArg } from '@fullcalendar/core'

// FC v6 core 未直接导出 eventReceive 回调的 Arg 类型，从 CalendarOptions 推导
type EventReceiveArg = Parameters<NonNullable<CalendarOptions['eventReceive']>>[0]
import { storeToRefs } from 'pinia'
import { useTaskStore, useSettingsStore, useThemeStore, useUIStore } from '../stores'
import { PanelRight, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { colorOptions, colorScheme } from '../constants/colors'

const taskStore = useTaskStore()
const { schedules } = storeToRefs(taskStore) // state → storeToRefs
const { updateSchedule, addScheduleFromTask, addSchedule, deleteSchedule } = taskStore // action
const { settings } = storeToRefs(useSettingsStore())
const { isDark } = storeToRefs(useThemeStore())
const uiStore = useUIStore()
const { isMobile, todoVisible, calendarFullscreen } = storeToRefs(uiStore) // state
const { setTodoVisible, toggleCalendarFullscreen } = uiStore // action

const fullCalendar = ref<InstanceType<typeof FullCalendar> | null>(null)
let resizeObserver: ResizeObserver | null = null
let wrapperEl: HTMLElement | null = null

// ---- 移动端：左右滑动翻页（FC 标准版无滑动导航，手势自实现）----
// 判定：单指快速水平滑动（|dx|≥60px、水平位移≥1.5×垂直位移、<800ms）；
// 起点须在日历网格内且不在日程块上（日程块交给 FC 拖拽，工具条上的滑动不翻页）。
// 快速轻扫与长按拖选（FC touch 下按 longPressDelay 才触发）天然错开；
// 翻页后 datesSet 自动回写中央单日选择器。
const SWIPE_MIN_DX = 60
let touchStart: { x: number; y: number; t: number } | null = null

const onTouchStart = (e: TouchEvent) => {
  touchStart = null
  if (!isMobile.value || e.touches.length !== 1) return
  const target = e.target as HTMLElement
  if (!target.closest('.fc') || target.closest('.fc-event')) return
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
}

const onTouchEnd = (e: TouchEvent) => {
  const s = touchStart
  touchStart = null
  if (!s || e.changedTouches.length !== 1) return
  const dx = e.changedTouches[0].clientX - s.x
  const dy = e.changedTouches[0].clientY - s.y
  if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < 1.5 * Math.abs(dy)) return
  if (Date.now() - s.t > 800) return // 慢速拖动（可能是长按拖选）不翻页
  // 与 ‹ › 按钮共用 shiftPeriod：移动端=翻天；若未来移动端开放月模式则自动翻月
  shiftPeriod(dx < 0 ? 1 : -1)
}

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
    // passive：不阻断浏览器原生滚动与 FC 事件拖拽
    wrapperEl.addEventListener('touchstart', onTouchStart, { passive: true })
    wrapperEl.addEventListener('touchend', onTouchEnd, { passive: true })
  }
  // 全屏时 ESC 退出（document 级监听，随组件生命周期增删）
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  wrapperEl?.removeEventListener('touchstart', onTouchStart)
  wrapperEl?.removeEventListener('touchend', onTouchEnd)
  document.removeEventListener('keydown', onKeydown)
})

// ---- 全屏：ESC 退出 ----
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && calendarFullscreen.value) toggleCalendarFullscreen()
}

// Convert our schedules to FullCalendar event format
const calendarEvents = computed(() => {
  return schedules.value.map(task => {
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

const handleEventChange = (changeInfo: EventChangeArg) => {
  const event = changeInfo.event
  const id = event.id
  
  // Format dates back to our custom format
  const startDate = new Date(event.start as Date)
  const endDate = event.end ? new Date(event.end as Date) : new Date(startDate.getTime() + 60 * 60 * 1000)
  
  const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
  const startTimeStr = startDate.toTimeString().substring(0, 5)
  const endTimeStr = endDate.toTimeString().substring(0, 5)

  updateSchedule(id, {
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

const confirmNewSchedule = () => {
  const { title, date, startTime, endTime, color } = newScheduleForm.value
  if (!title.trim()) { ElMessage.warning('标题不能为空'); return }
  if (!date || !startTime || !endTime) { ElMessage.warning('请填写完整的日期和时间'); return }
  if (startTime >= endTime) { ElMessage.warning('结束时间必须晚于开始时间'); return }
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

// ---- 工具栏中央时间选择器 ----
// 区间模式（默认）：daterange → 所见=所选（≤14 天 timeGrid，保留时间轴）
// 月模式：「月」按钮 toggle → 月选择器 + 标准月视图（桌面专属，移动端隐藏按钮）
// pickerMode 由视图状态驱动（datesSet 同步），保证与日历所见一致
const pickerRef = ref<{ handleClose?: () => void } | null>(null)
const pickerMode = ref<'range' | 'month'>('range')
const selectedRange = ref<[Date, Date]>([new Date(), new Date()])
const selectedDay = ref<Date>(new Date())
const selectedMonth = ref<Date>(new Date())

const MAX_RANGE_DAYS = 14 // 区间选择上限

// 自定义区间视图的可见范围（由 picker 选择驱动；end 为排他边界 = 次日 0 点）
let customRange: { start: Date; end: Date } = {
  start: dayjs().startOf('day').toDate(),
  end: dayjs().startOf('day').add(7, 'day').toDate()
}

// FC 日期区间变化 → 回写选择器 + 同步模式。
// 用 currentStart/currentEnd（逻辑区间）而非 start/end（月视图含跨月补齐格）；
// FC 的 end 一律排他，减 1 天得到用户理解的"含尾日期"
const handleDatesSet = (info: DatesSetArg) => {
  const s = new Date(info.view.currentStart)
  if (info.view.type === 'dayGridMonth') {
    pickerMode.value = 'month'
    selectedMonth.value = s
  } else {
    pickerMode.value = 'range'
    if (isMobile.value) {
      selectedDay.value = s
    } else {
      selectedRange.value = [s, dayjs(info.view.currentEnd).subtract(1, 'day').toDate()]
      // 同步 customRange：否则窗口尺寸切换（watch(isMobile) → timeGridWeek）后，
      // 首次按 ‹/› 会按旧区间跳变；也修正初始 timeGridWeek 与 customRange 不一致
      customRange = { start: s, end: new Date(info.view.currentEnd) }
    }
  }
}

// 桌面区间选择 → 自定义区间视图（所见=所选），超上限自动截断
const handlePickerChange = (range: [Date, Date] | null) => {
  if (!range || !range[0] || !range[1]) return
  let [s, e] = range
  const start = dayjs(s).startOf('day')
  let end = dayjs(e).startOf('day')
  if (end.diff(start, 'day') + 1 > MAX_RANGE_DAYS) {
    end = start.add(MAX_RANGE_DAYS - 1, 'day')
    ElMessage.warning(`最多选择 ${MAX_RANGE_DAYS} 天，已自动截断`)
  }
  customRange = { start: start.toDate(), end: end.add(1, 'day').toDate() } // FC end 排他
  fullCalendar.value?.getApi().changeView('timeGridCustom', start.toDate())
  pickerRef.value?.handleClose?.()
}

// 移动端区间模式：选中单日 → 跳转该天（确保日视图）
const handleDayPick = (d: Date | null) => {
  if (!d) return
  fullCalendar.value?.getApi().changeView('timeGridDay', d)
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

// ‹ › 时段平移：区间模式平移整个区间；月模式翻月；移动端单日翻天
const shiftPeriod = (dir: 1 | -1) => {
  const api = fullCalendar.value?.getApi()
  if (!api) return
  if (pickerMode.value === 'month') {
    const cur = dayjs(api.getDate()).startOf('month').add(dir, 'month')
    api.changeView('dayGridMonth', cur.toDate())
    return
  }
  if (isMobile.value) {
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
  eventChange: handleEventChange, // When event is dragged or resized
  eventReceive: handleEventReceive, // When external event is dropped
  select: handleSelect, // 拖选时段新增日程（唯一新增入口；单击被时长闸门过滤，防误触）
  eventClick: handleEventClick, // 移动端：双击事件编辑（自判定）
  eventDidMount: handleEventDidMount, // web 端：右击事件编辑
  datesSet: handleDatesSet, // 日期区间变化 → 同步中央时间选择器

  firstDay: 1, // Start week on Monday
  dayHeaderContent: (arg: DayHeaderContentArg) => {
    // 月视图列头显示星期名；其余视图显示具体日期
    if (arg.view.type === 'dayGridMonth') {
      return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][arg.date.getDay()]
    }
    // 移动端日视图：中央选择器已显示当天日期，隐藏列头避免重复（只保留一行表头）
    if (isMobile.value) return ''
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

/* 新增日程弹窗颜色选项圆点 */
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
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

/* ‹ › 与「月」按钮：移动优先默认隐藏（移动端翻时段由左右滑动手势承担），桌面恢复显示。
   .calendar-toolbar 祖先提权：全局 button:not(.el-button)（theme.css）特异性更高，
   单类 .period-nav 会被其 display:flex 压过导致隐藏失效 */
.calendar-toolbar .period-nav,
.calendar-toolbar .month-toggle,
.calendar-toolbar .fullscreen-toggle {
  display: none;
}

@media (width >= 769px) {
  .calendar-toolbar .period-nav,
  .calendar-toolbar .month-toggle,
  .calendar-toolbar .fullscreen-toggle {
    display: inline-flex;
  }
}

/* 工具条按钮统一形态（fullscreen 按钮样式）：32×32 透明底、无边框、hover 灰底 + 主题色。
   period-nav / month / fullscreen / reopen 四者共用一组规则（display 与居中由全局
   button 规则和上方恢复块管理，这里不再声明）；month-toggle 仅追加文字排版 */
.calendar-toolbar .period-nav,
.calendar-toolbar .month-toggle,
.calendar-toolbar .fullscreen-toggle,
.calendar-toolbar .reopen-todo-btn {
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
.calendar-toolbar .fullscreen-toggle:hover,
.calendar-toolbar .reopen-todo-btn:hover {
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

/* 日期文本：大号加粗居中 */
.calendar-title-picker .el-range-input {
  background: transparent;
  font-size: 1.08rem;
  font-weight: var(--weight-bold);
  color: var(--el-text-color-primary);
  cursor: pointer;
  text-align: center;
}

/* 清除按钮隐藏态仍占 14px、破坏胶囊内对称，隐藏；左侧日历图标保留（主题色点缀） */
.calendar-title-picker .el-range__close-icon {
  display: none;
}

/* 分隔符：主题色点缀 */
.calendar-title-picker .el-range-separator {
  color: var(--el-color-primary);
  font-weight: var(--weight-bold);
}

/* 单值选择器（移动端单日 / 桌面月模式），type=date|month 的 el-input 结构，样式统一。
   宽度规则：月选择器带 calendar-title-picker 类，宽度由上方 daterange 的 250px 规则统一生效 */
.calendar-day-picker.el-input {
  --el-date-editor-width: 178px;
}

.calendar-day-picker .el-input__wrapper,
.calendar-month-picker .el-input__wrapper {
  background: var(--el-bg-color); /* 白底浮于工具条灰带（同 daterange 胶囊） */
  box-shadow: none !important;
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
  transition: background var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}

.calendar-day-picker .el-input__wrapper:hover,
.calendar-day-picker .el-input__wrapper.is-active,
.calendar-month-picker .el-input__wrapper:hover,
.calendar-month-picker .el-input__wrapper.is-active {
  box-shadow: var(--shadow-sm) !important;
}

.calendar-day-picker .el-input__inner,
.calendar-month-picker .el-input__inner {
  font-size: var(--font-base);
  font-weight: var(--weight-bold);
  color: var(--el-text-color-primary);
  text-align: center;
  cursor: pointer;
}

.calendar-day-picker .el-input__prefix,
.calendar-month-picker .el-input__prefix {
  color: var(--el-color-primary);
}

/* 待办栏收起后的展开按钮已并入上方工具条统一形态组（.calendar-toolbar .reopen-todo-btn） */

/* 全屏态：CSS 伪全屏（fixed 铺满视口）。
   z-index 999 的分层依据：低于 EP 弹窗/消息（~2000+，保证全屏中日程弹窗可见），
   高于普通内容与导航；语音球（--z-overlay 10000）仍浮于其上，全屏中语音排期可用。
   刻意不用原生 Fullscreen API：其 top-layer 会挡住挂在 body 上的 el-dialog。 */
.calendar-wrapper.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 999;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

/* 待办栏收起后的展开按钮已并入上方工具条统一形态组（.calendar-toolbar .reopen-todo-btn） */

/* 移动端：打开待办浮层的按钮（.calendar-wrapper 前缀提高特异性，
   覆盖全局 button:not(.el-button) 的圆角/缩放，确保圆形） */
.calendar-wrapper .mobile-todo-fab {
  width: var(--touch-target);
  height: var(--touch-target);
  border: none;
  background: transparent;
  color: var(--color-primary);
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}

.calendar-wrapper .mobile-todo-fab:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 20px var(--color-primary-alpha);
}

.calendar-wrapper .mobile-todo-fab:active {
  transform: scale(0.94);
}

/* 移动端：隐藏空白的列头行（day 视图列头无内容，容器仍占位 → 干脆隐藏）。
   用 platform-mobile 类作用域（与 ui store isMobile 同源）而非媒体查询：
   FC 列头是表格布局，翻转写法无法可靠恢复其默认 display 值 */
html.platform-mobile .fc .fc-col-header {
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
  left: 4px;               /* 贴左对齐 */
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
  font-size: 0.85rem !important;
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
