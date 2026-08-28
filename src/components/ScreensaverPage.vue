<template>
  <div
    ref="pageEl"
    class="screensaver-page"
    :class="{ 'is-native-fs': isNativeFs, 'scv-light': theme === 'light' }"
  >
    <!-- 工具条：闲置 3s 淡出、任意指针活动唤出（屏保沉浸 + 全端可达，替代触屏常显/hover 门控双分支） -->
    <div class="screensaver-toolbar" :class="{ 'is-idle': !toolbarVisible }">
      <button class="scv-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
        <el-icon :size="18"><FullScreen /></el-icon>
      </button>
      <!-- 配色切换：图标指向点击后的去向（深色屏显太阳=切白底，反之月亮），与主流暗色开关惯例一致 -->
      <button
        class="scv-btn"
        :title="theme === 'dark' ? '切换白底黑字' : '切换黑底白字'"
        @click="toggleTheme"
      >
        <el-icon :size="18">
          <Sunny v-if="theme === 'dark'" />
          <Moon v-else />
        </el-icon>
      </button>
      <button class="scv-btn scv-btn--text" title="切换 12/24 小时制" @click="toggleHour12">
        {{ hour12 ? '12H' : '24H' }}
      </button>
    </div>

    <div class="screensaver-stage">
      <FlipClock :hour12="hour12" :timeline="timeline" :lane-limit="laneLimit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'
import { FullScreen, Moon, Sunny } from '@element-plus/icons-vue'
import FlipClock from './FlipClock.vue'
import { useFullscreen } from '../composables/useFullscreen'
import { useTaskStore, useThemeStore, useUIStore } from '../stores'
import { colorScheme } from '../constants/colors'

/**
 * 屏保页（Fliqlo 风翻页时钟）。
 * 配色双变体：dark=经典黑底白字 / light=白底黑字。默认变体跟随全局明暗主题
 * （与全局背景同步）；工具条按钮手动切换后持久化覆盖（screensaver_theme）。
 * 板值由本页 --scv-* 变量单点定义、级联给 FlipClock/FlipCard，不随全局令牌走
 * （手动选定的变体必须稳定呈现）。全屏/锁横/唤醒锁走 useFullscreen（Web/安卓壳双路径收敛）。
 */
const LS_HOUR12 = 'screensaver_hour12'
const LS_THEME = 'screensaver_theme'

/** 屏保配色变体 */
type ScvTheme = 'dark' | 'light'

const readStoredTheme = (): ScvTheme | null => {
  const v = localStorage.getItem(LS_THEME)
  return v === 'light' || v === 'dark' ? v : null
}

const storedTheme = ref<ScvTheme | null>(readStoredTheme())
const themeStore = useThemeStore()

// 未手动切换过：响应式跟随全局明暗（设置页换主题屏保即跟随）；切换后存储值恒胜出
const theme = computed<ScvTheme>(() => storedTheme.value ?? (themeStore.isDark ? 'dark' : 'light'))

const toggleTheme = () => {
  const next: ScvTheme = theme.value === 'dark' ? 'light' : 'dark'
  storedTheme.value = next
  localStorage.setItem(LS_THEME, next)
}

const pageEl = ref<HTMLElement>()
const { isFullscreen, isNativeFs, toggleFullscreen } = useFullscreen(pageEl)
const hour12 = ref(localStorage.getItem(LS_HOUR12) === '1')

// ===== 分钟级时钟：驱动时间带窗口滚动与"进行中"判定（15s 粒度兜住日程切换的及时性）=====
const taskStore = useTaskStore()
const nowTs = ref(Date.now())
let nowTimer = 0

// ===== 3 小时时间带：窗口恒为 now±90min（now 恒在 50% 中线），任务卡已融入其中——
// 块即任务卡：上方标题/下方描述（无描述回落时段），日程色左→右按经过进度染色。
// 日程块按起止时间换算 left/width（与窗口求交集裁剪）；重叠日程贪心错行（每场占一行）。
// 用绝对时间戳求交：窗口跨零点时昨日尾段日程不丢（date==='今天' 过滤会漏）。
// 颜色与 FC 事件同源（colorScheme fill/stroke）。
const TL_WIN_MS = 90 * 60000

// 可见行数上限：移动端 2 行（竖屏纵向紧张），Web 3 行（大屏富余少滚动）——超出进滚动
const uiStore = useUIStore()
const laneLimit = computed(() => (uiStore.isMobile ? 2 : 3))

const timeline = computed<{
  blocks: {
    title: string
    description: string
    time: string
    progress: number
    fill: string
    stroke: string
    left: number
    width: number
    lane: number
  }[]
  ticks: { pct: number; label: string }[]
  lanes: number
}>(() => {
  const wStart = nowTs.value - TL_WIN_MS
  const span = TL_WIN_MS * 2
  const inWindow = taskStore.schedules
    .filter((s) => !s.deletedAt && s.title)
    .map((s) => ({
      s,
      start: dayjs(`${s.date} ${s.startTime}`).valueOf(),
      end: dayjs(`${s.date} ${s.endTime}`).valueOf()
    }))
    .filter((x) => x.start < wStart + span && x.end > wStart)
    .sort((a, b) => a.start - b.start)

  const laneEnds: number[] = []
  const blocks = inWindow.map(({ s, start, end }) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    const l = Math.max(start, wStart)
    const r = Math.min(end, wStart + span)
    const scheme = colorScheme(s.color)
    return {
      title: s.title,
      description: (s.description ?? '').trim(),
      time: `${s.startTime} – ${s.endTime}`,
      // 经过进度按日程完整时段算（不受窗口裁剪影响）：已过场=1 满染、未来场=0 不染
      progress: end > start ? Math.min(1, Math.max(0, (nowTs.value - start) / (end - start))) : 0,
      fill: scheme.fill,
      stroke: scheme.stroke,
      left: ((l - wStart) / span) * 100,
      width: Math.max(((r - l) / span) * 100, 0.8), // 极短日程最小可见宽度兜底
      lane
    }
  })

  // 整点刻度：窗口内每个整点（+59min 再取整点，窗口起点恰为整点时不漏当点）
  const ticks: { pct: number; label: string }[] = []
  for (let t = dayjs(wStart).add(59, 'minute').startOf('hour'); t.valueOf() <= wStart + span; t = t.add(1, 'hour')) {
    ticks.push({ pct: ((t.valueOf() - wStart) / span) * 100, label: t.format('HH:mm') })
  }

  return { blocks, ticks, lanes: laneEnds.length }
})

// 全屏态上提 store：App 层据此 v-show 隐藏语音球（壳内 CSS 伪装全屏盖不住
// z 更高的球）。Web 经 fullscreenchange、壳内经 toggle，均落回本 watch 同步
watch(isFullscreen, (v) => uiStore.setScreensaverFullscreen(v))

// ===== 工具条闲置隐藏：无操作 3s 淡出，任意指针活动唤出并重新计时 =====
// 触屏无 hover（常显会破坏沉浸）、鼠标 hover 门控可发现性为零——统一交互动线两端通吃。
// 隐藏后 pointer-events: none：首次点击唤出、第二次才触发按钮（视频播放器同款惯例）
const IDLE_HIDE_MS = 3000
const toolbarVisible = ref(true)
let idleTimer = 0
let lastActivity = 0

const scheduleIdleHide = () => {
  toolbarVisible.value = true
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    toolbarVisible.value = false
  }, IDLE_HIDE_MS)
}

// pointermove 高频（高刷鼠标可达 1000Hz）：100ms 节流，timer 重排开销归零
const onPointerActivity = () => {
  const now = performance.now()
  if (now - lastActivity < 100) return
  lastActivity = now
  scheduleIdleHide()
}

const onVisForToolbar = () => {
  if (document.hidden) {
    window.clearTimeout(idleTimer)
  } else {
    scheduleIdleHide()
  }
}

onMounted(() => {
  scheduleIdleHide()
  nowTimer = window.setInterval(() => {
    nowTs.value = Date.now()
  }, 15000)
  window.addEventListener('pointermove', onPointerActivity, { passive: true })
  window.addEventListener('pointerdown', onPointerActivity, { passive: true })
  document.addEventListener('visibilitychange', onVisForToolbar)
})

onUnmounted(() => {
  window.clearTimeout(idleTimer)
  window.clearInterval(nowTimer)
  window.removeEventListener('pointermove', onPointerActivity)
  window.removeEventListener('pointerdown', onPointerActivity)
  document.removeEventListener('visibilitychange', onVisForToolbar)
  // 全屏态直接路由离开（安卓系统返回键）：watch 已随组件销毁，兜底复位，
  // 否则语音球在其他页面永久隐藏
  uiStore.setScreensaverFullscreen(false)
})

const toggleHour12 = () => {
  hour12.value = !hour12.value
  localStorage.setItem(LS_HOUR12, hour12.value ? '1' : '0')
}
</script>

<style scoped>
.screensaver-page {
  /* 屏保双配色板：页面级单一定义点，子组件（FlipClock/FlipCard）经 var 级联消费。
     不用全局主题令牌——手动选定的变体必须稳定呈现，不能随 data-theme 移动；
     「与全局同步」体现在默认变体的选择上（theme computed 跟随全局明暗） */
  --scv-bg: #050507;
  --scv-ink: #f5f5f0;
  --scv-card-top: #232326;
  --scv-card-bottom: #17171a;
  --scv-seam: rgb(255 255 255 / 14%);
  --scv-card-shadow: rgb(0 0 0 / 45%);
  position: relative;
  height: 100%;
  background: var(--scv-bg);
  border-radius: var(--radius-lg); /* 桌面浮岛：content-area 12px 内边距下的圆角观感 */
  overflow: hidden;
  display: flex;
  transition: background var(--duration-slow) ease; /* 黑白切换柔和过渡（大面积变更走 slow 档） */
}

/* 白底黑字变体：只换色板，布局零分叉。底色取应用浅色页底同值，观感与全局一致 */
.screensaver-page.scv-light {
  --scv-bg: #f2f3f5;
  --scv-ink: #1a1c20;
  --scv-card-top: #ffffff;
  --scv-card-bottom: #e9eaec;
  --scv-seam: rgb(0 0 0 / 14%);
  --scv-card-shadow: rgb(15 23 42 / 12%);
}

/* 自身进入全屏：铺满视口、直角（壳内 Web Fullscreen API 不可用，用本地状态类等价驱动） */
.screensaver-page:fullscreen,
.screensaver-page.is-native-fs {
  border-radius: 0;
}

/* 壳内全屏铺满：锁横后 innerWidth>768 会让 app 误判桌面布局——content-area 的
   12px 浮岛 padding 露出页面灰白底（真机"四周白边"根因）。fixed 脱离布局
   盖满 WebView 视口，不依赖 isMobile 判定；语音球不经 z 压制，由 ui store
   的屏保全屏态在 App 层 v-show 隐藏（抬 z 会盖住 ElNotification 等弹层） */
.screensaver-page.is-native-fs {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.screensaver-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.screensaver-toolbar {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  z-index: 1;
  display: flex;
  gap: var(--space-xs);
  transition: opacity var(--duration-base) ease;
}

/* 闲置淡出：pointer-events 归零防误占位（首次点击唤出、第二次才触发按钮） */
.screensaver-toolbar.is-idle {
  opacity: 0;
  pointer-events: none;
}

/* 按钮配色跟随屏保变体：以墨色 color-mix 出半透明底/描边，深浅两板自适应 */
.scv-btn {
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--scv-ink) 20%, transparent);
  border-radius: 9999px; /* 圆钮（规则允许的胶囊特例值） */
  background: color-mix(in srgb, var(--scv-ink) 6%, transparent);
  color: var(--scv-ink);
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: background var(--duration-fast) ease;
}

.scv-btn:hover {
  background: color-mix(in srgb, var(--scv-ink) 14%, transparent);
}
</style>
