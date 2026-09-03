<template>
  <!-- 移动端：全应用统一顶条 MobileAppBar（汉堡在组件内）——
       中 时间选择器（选范围按跨度智能切视图）| 右 月视图 + 待办开关 -->
  <MobileAppBar v-if="isMobile">
    <template #center>
      <!-- 区间模式：两端共用 EP daterange（所见=所选）。移动端面板收窄为单月：
           unlink-panels 使左面板自带前进箭头，CSS 隐藏右面板（EP 双月 646px 溢出手机屏） -->
      <el-date-picker
        v-if="pickerMode !== 'month'"
        ref="pickerRef"
        v-model="selectedRange"
        class="calendar-title-picker"
        type="daterange"
        unlink-panels
        popper-class="mobile-range-panel"
        range-separator="–"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        format="M月D日"
        :clearable="false"
        @change="onRangeChange"
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
        @change="onMonthPick"
      />
      <!-- 「今天」：浏览偏离今天时出现（条件显示避免常态噪音），点击回到包含今天的视图 -->
      <button v-if="showToday" class="today-toggle" title="回到今天" @click="emit('today')">今</button>
    </template>
    <template #right>
      <!-- 月视图 toggle：激活时选择器切换为月选择器。
           移动端由「设置-视觉与外观」控制（默认隐藏） -->
      <button
        v-if="settings.showMonthButton"
        class="month-toggle"
        :class="{ active: pickerMode === 'month' }"
        @click="emit('toggleMonth')"
        title="月视图"
      >
        月
      </button>
      <!-- 待办面板开关：移动端收/开浮层（桌面分支同按钮收/展侧栏） -->
      <button
        class="todo-toggle"
        :title="todoVisible ? '收起待办栏' : '展开待办栏'"
        @click="setTodoVisible(!todoVisible)"
      >
        <PanelRightClose v-if="todoVisible" :size="20" />
        <PanelRight v-else :size="20" />
      </button>
    </template>
  </MobileAppBar>

  <!-- 桌面：顶部工具条三段式——
       左 导航开关（toggle rail 显隐）| 中 ‹ 今天 时间选择器 › | 右 新增 + 月视图 + 待办开关 -->
  <div v-else class="calendar-toolbar">
    <div class="calendar-toolbar__side">
      <button
        class="toolbar-nav-toggle"
        :title="navRailCollapsed ? '显示导航栏' : '隐藏导航栏'"
        @click="setNavRailCollapsed(!navRailCollapsed)"
      >
        <PanelLeftClose v-if="!navRailCollapsed" :size="20" />
        <PanelLeftOpen v-else :size="20" />
      </button>
    </div>
    <div class="calendar-toolbar__center">
      <button class="period-nav" title="上一时段" @click="emit('shift', -1)">
        <ChevronLeft :size="20" />
      </button>
      <el-date-picker
        v-if="pickerMode !== 'month'"
        ref="pickerRef"
        v-model="selectedRange"
        class="calendar-title-picker"
        type="daterange"
        range-separator="–"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        format="M月D日"
        :clearable="false"
        @change="onRangeChange"
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
        @change="onMonthPick"
      />
      <button class="period-nav" title="下一时段" @click="emit('shift', 1)">
        <ChevronRight :size="20" />
      </button>
      <!-- 「今天」：浏览偏离今天时出现（条件显示避免常态噪音），点击回到包含今天的视图 -->
      <button v-if="showToday" class="today-toggle" title="回到今天" @click="emit('today')">今</button>
    </div>
    <div class="calendar-toolbar__side calendar-toolbar__side--right">
      <!-- 新增日程（显式入口；拖选时段仍是快捷路径） -->
      <button class="toolbar-add" title="新增日程" @click="emit('create')">
        <Plus :size="20" />
      </button>
      <!-- 月视图 toggle：激活时选择器切换为月选择器（网页端常驻） -->
      <button class="month-toggle" :class="{ active: pickerMode === 'month' }" @click="emit('toggleMonth')" title="月视图">
        月
      </button>
      <!-- 待办面板开关（原待办头部"收起待办栏"按钮移此，双端统一）：web 收/展侧栏 -->
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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore, useUIStore } from '../stores'
import MobileAppBar from './MobileAppBar.vue'
import { PanelRight, PanelRightClose, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'

const props = defineProps<{ pickerMode: 'range' | 'month' }>()
const selectedRange = defineModel<[Date, Date]>('selectedRange', { required: true })
const selectedMonth = defineModel<Date>('selectedMonth', { required: true })
const emit = defineEmits<{
  shift: [dir: 1 | -1]
  rangeChange: [range: [Date, Date] | null]
  monthPick: [d: Date | null]
  toggleMonth: []
  today: []
  create: []
}>()

// 「今天」按钮显隐：当前视图不包含今天才出现（避免常态噪音）
const showToday = computed(() => {
  const now = new Date()
  if (props.pickerMode === 'month') {
    const m = selectedMonth.value
    return m.getFullYear() !== now.getFullYear() || m.getMonth() !== now.getMonth()
  }
  const [s, e] = selectedRange.value
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return d0 < new Date(s.getFullYear(), s.getMonth(), s.getDate()) ||
    d0 > new Date(e.getFullYear(), e.getMonth(), e.getDate())
})

const { settings } = storeToRefs(useSettingsStore())
const uiStore = useUIStore()
const { isMobile, todoVisible, navRailCollapsed } = storeToRefs(uiStore)
const { setTodoVisible, setNavRailCollapsed } = uiStore

const pickerRef = ref<{ handleClose?: () => void } | null>(null)
const closePicker = () => pickerRef.value?.handleClose?.()
// 原序保持：emit 同步触发父组件应用区间，随后收起弹层
const onRangeChange = (range: [Date, Date] | null) => {
  emit('rangeChange', range)
  closePicker()
}
const onMonthPick = (d: Date | null) => {
  emit('monthPick', d)
  closePicker()
}
</script>

<style>
/* ===== 移动端 daterange 面板收窄为单月（popper 传送至 body，需全局样式）=====
   EP 范围面板双月并排 ~646px 溢出手机屏；unlink-panels 使左面板自带前进箭头，
   隐藏右侧面板后仍是可完整导航的单月范围选择。
   左面板定宽 322px（同 EP 单日期面板）；日期单元格实测 41×30px
   （EP 表格行高 30px，未达 44px 触控标准——已知取舍，改行高需动 EP 内部表格布局）；
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

/* ===== 顶部工具条（桌面分支；移动端由 MobileAppBar 渲染同构灰带）===== */

/* 左右等宽占位 + 中央选择器，保证 picker 始终水平居中；右侧承载待办开关。
   与待办头部（TodoSidebar .sidebar-header）/移动端顶条（MobileAppBar）同构的灰带：
   12px 灰顶边 + 44 内容 + 1px 底边，三处用同一 calc 定高（子元素不撑高）几何严格相等；
   底边直接贴 FC 网格（无间距） */
.calendar-toolbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: calc(44px + var(--space-md) + 1px); /* 桌面恒 57（本类桌面分支专用） */

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

/* 工具条按钮统一形态：32×32 透明底、无边框、hover 灰底 + 主题色。
   period-nav / month / nav 开关 / 新增 / todo 开关五者共用一组规则；
   month / todo / today 在移动端经 MobileAppBar 插槽渲染，需并列 .mobile-app-bar
   上下文（本块非 scoped 全局样式，插槽内容可命中） */
.calendar-toolbar .period-nav,
.calendar-toolbar .month-toggle,
.calendar-toolbar .toolbar-nav-toggle,
.calendar-toolbar .toolbar-add,
.calendar-toolbar .todo-toggle,
.calendar-toolbar .today-toggle,
.mobile-app-bar .month-toggle,
.mobile-app-bar .todo-toggle,
.mobile-app-bar .today-toggle {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

/* 移动端触控热区：热区与视觉尺寸解耦——图标仍 20px，命中区抬到 44px 标准
   （灰带内容行恰 44px，按钮贴行高不溢出；桌面维持 32px 视觉） */
html.platform-mobile .mobile-app-bar .month-toggle,
html.platform-mobile .mobile-app-bar .todo-toggle,
html.platform-mobile .mobile-app-bar .today-toggle {
  width: var(--touch-target);
  height: var(--touch-target);
}

/* 文字按钮（月 / 今）：统一形态内的文字排版（字号与 20px 图标视觉等重） */
.calendar-toolbar .month-toggle,
.calendar-toolbar .today-toggle,
.mobile-app-bar .month-toggle,
.mobile-app-bar .today-toggle {
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
  line-height: 1;
}

.calendar-toolbar .period-nav:hover,
.calendar-toolbar .month-toggle:hover,
.calendar-toolbar .toolbar-nav-toggle:hover,
.calendar-toolbar .toolbar-add:hover,
.calendar-toolbar .todo-toggle:hover,
.calendar-toolbar .today-toggle:hover,
.mobile-app-bar .month-toggle:hover,
.mobile-app-bar .todo-toggle:hover,
.mobile-app-bar .today-toggle:hover {
  background: var(--el-fill-color); /* 工具条灰带上 hover 需更深一档可见 */
  color: var(--el-color-primary);
}

.calendar-toolbar .month-toggle.active,
.mobile-app-bar .month-toggle.active {
  background: var(--color-primary);
  color: #fff;
}

/* 宽度与高度：daterange 根元素带内联 --el-date-editor-width 变量 + 组件单类 width 规则，
   须用「祖先+双类」高优先级选择器 + 直接 width 声明才能覆盖。
   .calendar-wrapper 祖先由父组件渲染，选择器原样保留即与拆分前特异性一致 */
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

/* 日期文本：大号加粗居中（font-md 1.1rem，与 42% 定宽注释联动） */
.calendar-title-picker .el-range-input {
  background: transparent;
  font-size: var(--font-md);
  font-weight: var(--weight-semibold);
  color: var(--el-text-color-primary);
  cursor: pointer;
  text-align: center;
}

/* 两个日期框 EP 默认 39% 定宽；移动端胶囊收窄 20px 后按 42% 回补，
   保证最长 "12月31日"（font-md 1.1rem×5 字 ≈ 89px）不贴边截字 */
html.platform-mobile .calendar-title-picker .el-range-input {
  width: 42%;
}

/* 清除按钮隐藏态仍占 14px、破坏胶囊内对称，隐藏；左侧日历图标保留（主题色点缀） */
.calendar-title-picker .el-range__close-icon {
  display: none;
}

/* 日历图标：主题色，调大一档（18px）与 font-md 粗体日期文字视觉等重 */
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
</style>
