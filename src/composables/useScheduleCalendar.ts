/**
 * 日程事件与弹窗交互（CalendarArea 专用组合式）：
 * schedules → FC 事件映射、拖拽/拉伸落库（跨零点 revert）、外部任务拖入排期、
 * 拖选新增（单击闸门过滤）、移动端双击 / web 右键编辑入口、新增/编辑弹窗状态
 * （表单渲染与校验在 ScheduleDialog 组件，本组合式只持状态与落库）。
 */
import { ref, computed, h, onMounted, onBeforeUnmount } from 'vue'
import dayjs from 'dayjs'
import type { CalendarOptions, DateSelectArg, EventClickArg, EventDropArg, EventMountArg } from '@fullcalendar/core'

// FC v6 core 未直接导出 eventReceive 回调的 Arg 类型，从 CalendarOptions 推导
type EventReceiveArg = Parameters<NonNullable<CalendarOptions['eventReceive']>>[0]
// v6 的 eventResize 参数类型（EventResizeDoneArg）未从 core 导出，同法取形
type EventResizeArg = Parameters<NonNullable<CalendarOptions['eventResize']>>[0]

import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useTaskStore, useThemeStore, useUIStore } from '../stores'
import { colorScheme } from '../constants/colors'
import { DEFAULT_SCHEDULE_START, DEFAULT_SCHEDULE_END, DEFAULT_SCHEDULE_COLOR } from '../constants/schedule'
import type { ScheduleFormValue } from '../components/ScheduleDialog.vue'

export function useScheduleCalendar() {
  const taskStore = useTaskStore()
  const { activeSchedules } = storeToRefs(taskStore) // 活跃视图（墓碑已滤）
  const { updateSchedule, addScheduleFromTask, addSchedule, deleteSchedule } = taskStore // action
  const uiStore = useUIStore()
  const { isMobile } = storeToRefs(uiStore)
  const { setTodoVisible } = uiStore
  const { isDark } = storeToRefs(useThemeStore())

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
   * 多选整组平移：被拖成员 ∈ 选中集且跨天时，其余成员按同天数差平移
   * （时刻保留，date±N 天永不跨零点）；原地拉伸/同日拖动天数差为 0 天然不触发。
   */
  const applyEventMove = (info: EventDropArg | EventResizeArg) => {
    const event = info.event

    // Format dates back to our custom format
    const startDate = new Date(event.start as Date)
    const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 60 * 60 * 1000)

    const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const startTimeStr = startDate.toTimeString().substring(0, 5)
    const endTimeStr = endDate.toTimeString().substring(0, 5)

    if (endTimeStr <= startTimeStr) {
      info.revert()
      ElMessage.warning('日程不能跨零点，请调整到更早的时段')
      return
    }

    // 变更前快照（撤销用）：被拖成员从 oldEvent 取，其余成员从活跃集取
    const oldStart = info.oldEvent?.start ? new Date(info.oldEvent.start) : startDate
    const oldEnd = info.oldEvent?.end ? new Date(info.oldEvent.end) : oldStart
    const moved: Array<{ id: string; before: { date: string; startTime: string; endTime: string } }> = [{
      id: event.id,
      before: { date: fmtDate(oldStart), startTime: fmtTime(oldStart), endTime: fmtTime(oldEnd) }
    }]
    updateSchedule(event.id, {
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr
    })

    // 整组平移：其余选中成员按被拖成员的天数差平移（只动 date）
    const dayDiff = dayjs(dateStr).diff(dayjs(moved[0].before.date), 'day')
    const group = dayDiff !== 0 && selectedScheduleIds.value.has(event.id)
      ? [...selectedScheduleIds.value].filter(id => id !== event.id)
      : []
    for (const id of group) {
      const s = activeSchedules.value.find(x => x.id === id)
      if (!s) continue
      moved.push({ id, before: { date: s.date, startTime: s.startTime, endTime: s.endTime } })
      updateSchedule(id, { date: dayjs(s.date).add(dayDiff, 'day').format('YYYY-MM-DD') })
    }
    if (group.length > 0) {
      ElMessage({
        message: h('span', { class: 'undo-toast' }, [
          `已平移 ${moved.length} 个日程（${dayDiff > 0 ? '+' : ''}${dayDiff} 天）`,
          h('button', {
            class: 'undo-toast__btn',
            onClick: () => {
              for (const m of moved) updateSchedule(m.id, m.before)
              ElMessage.closeAll()
            }
          }, '撤销')
        ]),
        duration: 5000,
        showClose: true
      })
    }
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
    title: '', description: '', date: '', startTime: DEFAULT_SCHEDULE_START, endTime: DEFAULT_SCHEDULE_END, color: DEFAULT_SCHEDULE_COLOR, remindMinutes: 0
  })
  // 非空 = 编辑模式（更新/删除），空 = 新增模式
  const editingScheduleId = ref<string | null>(null)

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const openNewScheduleDialog = (dateStr: string, startTimeStr: string, endTimeStr: string) => {
    editingScheduleId.value = null
    scheduleDialogInitial.value = { title: '', description: '', date: dateStr, startTime: startTimeStr, endTime: endTimeStr, color: DEFAULT_SCHEDULE_COLOR, remindMinutes: 0 }
    newScheduleDialogVisible.value = true
  }

  // 打开编辑弹窗（预填现有值）
  const openEditDialog = (eventId: string) => {
    const s = activeSchedules.value.find(x => x.id === eventId)
    if (!s) return
    editingScheduleId.value = s.id
    scheduleDialogInitial.value = { title: s.title, description: s.description ?? '', date: s.date, startTime: s.startTime, endTime: s.endTime, color: s.color, remindMinutes: s.remindMinutes }
    newScheduleDialogVisible.value = true
  }

  // ---- 选中态与键盘复制（web 端；移动端无键盘/Ctrl 修饰不参与）----
  // 始终替换式更新（new Set）保证响应式触发；Ctrl+单击加减选、普通单击重置单选
  const selectedScheduleIds = ref<Set<string>>(new Set())
  const replaceSelection = (ids: Iterable<string>) => {
    selectedScheduleIds.value = new Set(ids)
  }

  // Ctrl+V：选中日程复制到后一天（时段、颜色、提醒、任务关联全保留）。
  // 多选时整组复制；选中新副本集合——连续 Ctrl+V 自然递增 +1/+2/+3 天，不重复
  const copySelectedToNextDay = () => {
    const picked = activeSchedules.value.filter(s => selectedScheduleIds.value.has(s.id))
    if (picked.length === 0) {
      replaceSelection([])
      return
    }
    const srcIds = picked.map(s => s.id)
    const createdIds: string[] = []
    for (const src of picked) {
      const created = addSchedule({
        taskId: src.taskId,
        title: src.title,
        description: src.description,
        date: dayjs(src.date).add(1, 'day').format('YYYY-MM-DD'),
        startTime: src.startTime,
        endTime: src.endTime,
        color: src.color,
        remindMinutes: src.remindMinutes
      })
      createdIds.push(created.id)
    }
    replaceSelection(createdIds)
    const label = picked.length === 1
      ? `已复制「${picked[0].title.slice(0, 12)}${picked[0].title.length > 12 ? '…' : ''}」到 ${dayjs(picked[0].date).add(1, 'day').format('M月D日')}`
      : `已复制 ${picked.length} 个日程到后一天`
    ElMessage({
      message: h('span', { class: 'undo-toast' }, [
        label,
        h('button', {
          class: 'undo-toast__btn',
          onClick: () => {
            for (const id of createdIds) deleteSchedule(id)
            replaceSelection(srcIds)
            ElMessage.closeAll()
          }
        }, '撤销')
      ]),
      duration: 5000,
      showClose: true
    })
  }

  // 键盘：Esc 取消选中；Ctrl/Cmd+V 复制到后一天。编辑弹窗打开或焦点在
  // 表单控件时不接管（用户可能在输入框里正常粘贴文字）
  const isTypingTarget = (el: EventTarget | null) => {
    if (!(el instanceof HTMLElement)) return false
    return el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null
  }
  const onKeydown = (e: KeyboardEvent) => {
    if (newScheduleDialogVisible.value || selectedScheduleIds.value.size === 0) return
    if (isTypingTarget(e.target)) return
    if (e.key === 'Escape') {
      replaceSelection([])
      return
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault()
      copySelectedToNextDay()
    }
  }
  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

  // 单击/双击（双端统一 350ms 同一事件判定）：
  // web 单击=选中（Ctrl/Cmd+单击追加或移除成员、普通单击重置单选），
  // 350ms 内再点同一事件=编辑；移动端单击静默，双击编辑维持原语义
  let lastEventTap = { id: '', time: 0 }
  const handleEventClick = (info: EventClickArg) => {
    const id = info.event.id
    const now = Date.now()
    if (lastEventTap.id === id && now - lastEventTap.time < 350) {
      openEditDialog(id)
      lastEventTap = { id: '', time: 0 }
      return
    }
    lastEventTap = { id, time: now }
    if (isMobile.value) return
    const next = new Set(selectedScheduleIds.value)
    if (info.jsEvent.ctrlKey || info.jsEvent.metaKey) {
      if (next.has(id)) next.delete(id)
      else next.add(id)
    } else {
      next.clear()
      next.add(id)
    }
    replaceSelection(next)
  }

  // web 端：右击事件 → 编辑弹窗（FC 无原生 contextmenu 回调，事件挂载时绑原生监听）
  const handleEventDidMount = (info: EventMountArg) => {
    // 悬浮显示日程描述：FC 无内置 tooltip，原生 title 零依赖兜底（extendedProps 已带全量日程字段）
    const desc = info.event.extendedProps.description
    if (desc) info.el.title = String(desc)
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
    const { title, description, date, startTime, endTime, color, remindMinutes } = form
    if (editingScheduleId.value) {
      updateSchedule(editingScheduleId.value, { title: title.trim(), description: description.trim(), date, startTime, endTime, color, remindMinutes })
      ElMessage.success('已更新')
    } else {
      addSchedule({ title: title.trim(), description: description.trim(), date, startTime, endTime, color, remindMinutes })
      ElMessage.success('已新增日程')
    }
  }

  const handleDeleteSchedule = () => {
    if (!editingScheduleId.value) return
    deleteSchedule(editingScheduleId.value)
    ElMessage.success('已删除')
    newScheduleDialogVisible.value = false
  }

  return {
    calendarEvents,
    newScheduleDialogVisible,
    openNewScheduleDialog,
    scheduleDialogInitial,
    editingScheduleId,
    selectedScheduleIds,
    confirmNewSchedule,
    handleDeleteSchedule,
    applyEventMove,
    handleEventReceive,
    handleSelect,
    handleEventClick,
    handleEventDidMount
  }
}
