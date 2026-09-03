/**
 * 日历视图导航（工具栏中央时间选择器 ↔ FullCalendar 双向同步）：
 * 区间模式（默认）：「所见=所选」自定义区间（≤maxRangeDays 天 timeGrid，保留时间轴）；
 * 月模式：「月」按钮 toggle → 月选择器 + 标准月视图（桌面专属，移动端由设置控制）。
 * pickerMode 由视图状态驱动（datesSet 同步），保证与日历所见一致。
 * customRange 特意保持非响应式：FC 的 visibleRange 在 changeView 时由其内部重新读取，
 * 无需响应式追踪（保持原实现语义）。
 */
import { ref, computed, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { CalendarApi, DatesSetArg } from '@fullcalendar/core'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useSettingsStore, useUIStore } from '../stores'

/** FullCalendar 组件实例的最小结构面（composable 不依赖 @fullcalendar/vue3 组件类型） */
interface CalendarHandle {
  getApi: () => CalendarApi
}

export function useCalendarNavigation(calendar: Ref<CalendarHandle | null>) {
  const { settings } = storeToRefs(useSettingsStore())
  const { isMobile } = storeToRefs(useUIStore())

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

  /** calendarOptions 的 timeGridCustom.visibleRange 读取口（闭包直读可变值，保持原语义） */
  const getCustomRange = () => customRange

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
      calendar.value?.getApi().changeView('timeGridDay', start.toDate())
      return
    }
    calendar.value?.getApi().changeView('timeGridCustom', start.toDate())
  }

  // 月模式：选中月份 → 跳转该月（弹层收起由工具栏在 emit 后自理）
  const changeMonth = (d: Date) => {
    calendar.value?.getApi().changeView('dayGridMonth', d)
  }

  // 「月」按钮：toggle 进出月模式
  const toggleMonthMode = () => {
    const api = calendar.value?.getApi()
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
    const api = calendar.value?.getApi()
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

  // 「今天」：回到包含今天的视图——月模式回当月；单日视图跳今天；
  // 区间模式保持当前跨度、整段平移到今天起步（Google Calendar「今天」同语义）
  const goToday = () => {
    const api = calendar.value?.getApi()
    if (!api) return
    if (pickerMode.value === 'month') {
      api.changeView('dayGridMonth', new Date())
      return
    }
    if (curViewType.value === 'timeGridDay') {
      api.gotoDate(new Date())
      return
    }
    const today = dayjs().startOf('day')
    const days = Math.max(1, dayjs(customRange.end).startOf('day').diff(dayjs(customRange.start).startOf('day'), 'day'))
    applyCustomRange([today.toDate(), today.add(days - 1, 'day').toDate()])
  }

  return {
    pickerMode,
    selectedRange,
    selectedMonth,
    curViewType,
    showColHeader,
    getCustomRange,
    handleDatesSet,
    applyCustomRange,
    changeMonth,
    goToday,
    toggleMonthMode,
    shiftPeriod
  }
}
