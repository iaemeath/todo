<template>
  <div class="flip-clock">
    <!-- 年月日在上、翻牌在下（2026-08 验收调整）：日期作表头，时间作主体 -->
    <div class="flip-clock__date">{{ dateText }}</div>
    <div class="flip-clock__row">
      <template v-for="(g, gi) in groups" :key="gi">
        <!-- 组间冒号：两颗圆点随秒奇偶明暗（滴答感，与 tick 同源零漂移） -->
        <div v-if="gi > 0" class="flip-clock__colon" :class="{ tick: now.getSeconds() % 2 === 0 }">
          <span></span>
          <span></span>
        </div>
        <FlipCard v-for="(d, di) in g" :key="`${gi}-${di}`" :value="d" />
      </template>
      <!-- 12 制角标（Fliqlo 式小字 AM/PM） -->
      <span v-if="hour12" class="flip-clock__meridiem">{{ meridiem }}</span>
    </div>
    <!-- 3 小时时间带（数据由 ScreensaverPage 供给）：now 恒在中线，任务卡融入带中——
         块=任务卡（日程色按经过进度左→右染色，上标题/下描述），按起止时间定位错行；
         整点刻度在行区上方（钟下）、只留刻度线不带文字；>2 行限高滚动并预滚半行 -->
    <div v-if="timeline" class="flip-clock__timeline">
      <div class="flip-clock__tl-axis">
        <span
          v-for="t in timeline.ticks"
          :key="t.label"
          class="flip-clock__tl-tick"
          :style="{ left: `${t.pct}%` }"
        ></span>
      </div>
      <div
        ref="tlLanesEl"
        class="flip-clock__tl-lanes"
        :class="{ 'is-overflow': timeline.lanes > laneLimit }"
        :style="{ height: `calc(${Math.min(timeline.lanes, laneLimit)} * var(--tl-lane-h))` }"
      >
        <div
          v-for="(b, i) in timeline.blocks"
          :key="i"
          class="flip-clock__tl-block"
          :style="{
            left: `${b.left}%`,
            width: `${b.width}%`,
            top: `calc(${b.lane} * var(--tl-lane-h))`,
            '--tl-fill': b.fill,
            '--tl-stroke': b.stroke
          }"
        >
          <div class="flip-clock__tl-block-progress" :style="{ width: `${Math.round(b.progress * 100)}%` }"></div>
          <div class="flip-clock__tl-block-body">
            <div class="flip-clock__tl-block-title">{{ b.title }}</div>
            <div class="flip-clock__tl-block-desc">{{ b.description || b.time }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import FlipCard from './FlipCard.vue'

/**
 * 时:分 翻页时钟（日期行 + 4 卡翻牌 + 3 小时时间带，分钟翻页节奏）。
 * 冒号圆点保留秒级滴答——分钟模式下它是页面唯一的呼吸信号。
 * 配色：墨色消费屏保页注入的 --scv-ink（双变体跟随页面切换），fallback 兜独立使用。
 * 时间驱动：墙钟对齐 setTimeout（对齐到下一整秒 +20ms 缓冲），
 * 不用裸 setInterval——后者会漂移且后台节流积压；
 * 页面隐藏时停表，回前台立即校准到真实时间。
 */
const props = withDefaults(
  defineProps<{
    hour12?: boolean
    /** 3 小时时间带（窗口 now±90min，now 恒在 50%）：块即任务卡（上标题/下描述、按经过进度染色），
     *  blocks 按百分比定位错行，ticks 整点刻度；lanes=错行总数 */
    timeline?: {
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
      ticks: { pct: number; label: string }[] // label 不再渲染，仅作刻度 key 保持元素跨刷新复用
      lanes: number
    } | null
    /** 可见行数上限：移动端 2 行 / Web 3 行（ScreensaverPage 按 isMobile 同源断点传入），超出限高滚动 */
    laneLimit?: number
  }>(),
  { hour12: false, timeline: null, laneLimit: 2 }
)

const now = ref(new Date())
let timer = 0

const schedule = () => {
  timer = window.setTimeout(() => {
    now.value = new Date()
    schedule()
  }, 1000 - (Date.now() % 1000) + 20)
}

const onVisibility = () => {
  if (document.hidden) {
    window.clearTimeout(timer)
  } else {
    now.value = new Date()
    schedule()
  }
}

const onResizeForLayout = () => {
  void syncTimeline()
}

onMounted(() => {
  schedule()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('resize', onResizeForLayout, { passive: true })
})

onUnmounted(() => {
  window.clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', onResizeForLayout)
})

const pad = (n: number) => String(n).padStart(2, '0')

// 时/分 两组（分钟翻页节奏）；tick 仍每秒对齐——保证整分翻转时刻精准，兼供冒号滴答
const groups = computed(() => {
  const h = props.hour12 ? now.value.getHours() % 12 || 12 : now.value.getHours()
  const t = `${pad(h)}${pad(now.value.getMinutes())}`
  return [[t[0], t[1]], [t[2], t[3]]]
})

const meridiem = computed(() => (now.value.getHours() < 12 ? 'AM' : 'PM'))

// ===== 时间带限高滚动：>2 行时容器被 inline 高度限为两行，初始下滚半行露出下缘（"还有更多"的物理暗示）=====
// 行高（--tl-lane-h）= 实测首块自然高（含边框）+ 行距，运行时写入供块 top/容器高度共用——
// 字号有响应式下限，CSS 静态定高会在窄屏裁字；块内容首帧自然高度渲染，同步后统一为行高。
// 滚动条隐藏保沉浸（滚轮/触摸仍可滚）；resize 后行高随 --flip-w 变化，重算一次
const tlLanesEl = ref<HTMLElement>()

const syncTimeline = async () => {
  await nextTick()
  const el = tlLanesEl.value
  if (!el) return
  const block = el.querySelector('.flip-clock__tl-block') as HTMLElement | null
  if (!block) return
  // 块高被样式表的 --tl-lane-h 公式约束（offsetHeight 会被压小），临时解除约束量自然高，
  // 量完还原——否则循环测量把行高锁死在旧值、视口/字号变化时内容溢出裁字
  block.style.height = 'auto'
  const natural = block.getBoundingClientRect().height // 亚像素精度，offsetHeight 会取整丢 1~2px
  block.style.height = ''
  if (!natural) return
  const laneStep = natural + (parseFloat(getComputedStyle(el).getPropertyValue('--space-xs')) || 4)
  el.style.setProperty('--tl-lane-h', `${laneStep}px`)
  el.scrollTop = el.classList.contains('is-overflow') ? laneStep / 2 : 0
}

watch([() => props.timeline?.lanes, () => props.laneLimit], syncTimeline, { immediate: true })

const dateText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now.value)
)
</script>

<style scoped>
.flip-clock {
  /* 卡宽一次定义（FlipCard 消费）。
     移动端：15vw 驱动、26vh 封顶（横屏防溢出）、下限 60px 尽量撑满；
     桌面增强：再叠加内容区约束（视口 - 侧栏 240 - 内容区左右 padding 24）——
     264 与 AppSidebar 的 .app-navbar--side width、App.vue 的 .content-area padding 联动，
     4.9 = 行内宽度系数（4 卡 + 冒号 0.3 + 间距 0.6），保证 Pad 竖屏窄内容区不裁切。
     大屏无固定上限，26vh 令 1K/2K/4K 占比恒定 ~72%，不再逐级缩水 */
  --flip-w: max(60px, min(15vw, 26vh));
  /* 墨色跟随屏保变体（ScreensaverPage 注入 --scv-*，dark/light 一处切换），fallback 兜独立使用 */
  --clock-ink: var(--scv-ink, #f5f5f0);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  color: var(--clock-ink);
}

@media (width >= 769px) {
  .flip-clock {
    /* vw 17：Pad 档（vw 主导）占比 88%→~94%；1K/2K 仍由 26vh 主导不变。
       5.1 = 行内系数 4.78（4 卡+冒号 0.3+间距 4×0.12）+ ~6% 呼吸余量 */
    --flip-w: min(17vw, 26vh, calc((100vw - 264px) / 5.1));
  }
}

/* 全屏放大：侧栏预算归零；非全屏不变，<769 竖屏回落基础公式（防溢出） */
@media (width >= 769px) {
  .screensaver-page:fullscreen .flip-clock {
    --flip-w: min(22vw, 29vh, calc(100vw / 3));
  }
}

.flip-clock__row {
  position: relative; /* 锚定 12 制角标 */
  display: flex;
  align-items: center;
  gap: calc(var(--flip-w) * 0.12);
}

/* 冒号列：两颗圆点竖排占满卡高 */
.flip-clock__colon {
  width: calc(var(--flip-w) * 0.3);
  height: calc(var(--flip-w) * 1.18);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(var(--flip-w) * 0.22);
}

.flip-clock__colon span {
  width: calc(var(--flip-w) * 0.16);
  height: calc(var(--flip-w) * 0.16);
  margin: 0 auto;
  border-radius: 9999px; /* 圆点（规则允许的胶囊特例值） */
  background: var(--clock-ink);
  opacity: 0.92;
  transition: opacity var(--duration-fast) ease;
}

.flip-clock__colon.tick span {
  opacity: 0.22;
}

/* 12 制 AM/PM 角标：绝对定位挂行右上（Fliqlo 式上角标）——不占行宽，极窄屏不撑溢出 */
.flip-clock__meridiem {
  position: absolute;
  top: calc(var(--flip-w) * -0.34);
  right: 0;
  font-size: calc(var(--flip-w) * 0.2);
  font-weight: var(--weight-medium);
  letter-spacing: 0.08em;
  line-height: 1;
  opacity: 0.68;
}

.flip-clock__date {
  /* 字号挂卡宽比例：大屏随时钟同步跟涨；下限 0.875rem 保移动端可读 */
  font-size: max(0.875rem, calc(var(--flip-w) * 0.1));
  font-weight: var(--weight-medium);
  letter-spacing: 0.12em;
  opacity: 0.65;
}

/* ===== 3 小时时间带：now±90min，now 恒在中线；任务卡融入带中（块=任务卡）===== */
.flip-clock__timeline {
  width: calc(var(--flip-w) * 4.8);
}

/* 行区：块为绝对定位，高度 = min(行数,2) × 行高（inline style）；>2 行限两行滚动。
   --tl-lane-h 由 syncTimeline 实测首块高写入，fallback 兜首帧渲染。
   （原底部基线已上移为刻度轴 border-top，2026-08 验收调整） */
.flip-clock__tl-lanes {
  position: relative;
}

.flip-clock__tl-lanes.is-overflow {
  overflow-y: auto;
  overscroll-behavior: contain; /* 滚到边界不连带页面回弹 */
  scrollbar-width: none; /* Firefox */
}

.flip-clock__tl-lanes.is-overflow::-webkit-scrollbar {
  display: none; /* WebKit */
}

/* 日程块（即任务卡）：内容上标题/下描述，日程色左→右按经过进度染色。
   flex:none 禁收缩：容器限高后块保持自然高度溢出滚动（默认 shrink 会把块压扁，
   令 scrollHeight 恒等于 clientHeight，滚动永不触发）。
   left/width 随 15s 刷新线性补间平滑左移——15s 无对应动效令牌（slow 档 0.4s），特例豁免 */
.flip-clock__tl-block {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  height: calc(var(--tl-lane-h, 44px) - var(--space-xs));
  padding: var(--space-xs) var(--space-sm);
  overflow: hidden;
  background: var(--tl-fill);
  border: 1px solid var(--tl-stroke);
  border-radius: var(--radius-sm);
  transition: left 15s linear, width 15s linear; /* stylelint-disable-line declaration-property-unit-disallowed-list -- 与 15s 刷新同节奏，无令牌可依 */
}

/* 染色进度层：块底已是 FC fill（rgba 12%），进度层降为描边色的 40% 混合（有效 ~20%），
   与 FC 事件透明度观感一致、又足以区分已过/未过 */
.flip-clock__tl-block-progress {
  position: absolute;
  inset: 0 auto 0 0;
  background: color-mix(in srgb, var(--tl-stroke) 40%, transparent);
  transition: width 15s linear; /* stylelint-disable-line declaration-property-unit-disallowed-list -- 与 15s 刷新同节奏，无令牌可依 */
}

.flip-clock__tl-block-body {
  position: relative; /* 叠于染色层之上 */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  max-width: 100%;
  text-align: center;
}

.flip-clock__tl-block-title {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: max(0.75rem, calc(var(--flip-w) * 0.07));
  font-weight: var(--weight-bold);
  line-height: 1.2;
  opacity: 0.92;
}

.flip-clock__tl-block-desc {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: max(0.6875rem, calc(var(--flip-w) * 0.06));
  line-height: 1.3;
  opacity: 0.6;
}

/* 整点刻度：行区上方（钟下）的标尺——横线在上，短刻度从横线垂下，无文字标签。
   位置仍按整点换算（2026-08 验收：横线移到刻度上方） */
.flip-clock__tl-axis {
  position: relative;
  height: var(--space-sm);
  border-top: 1px solid color-mix(in srgb, var(--scv-ink) 14%, transparent);
}

.flip-clock__tl-tick {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  transform: translateX(-50%);
  background: var(--scv-ink);
  opacity: 0.35;
}
</style>
