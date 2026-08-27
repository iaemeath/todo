<template>
  <div class="flip-clock">
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
    <div class="flip-clock__date">{{ dateText }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import FlipCard from './FlipCard.vue'

/**
 * 时:分 翻页时钟（4 卡 + 冒号 + 日期行，分钟翻页节奏）。
 * 冒号圆点保留秒级滴答——分钟模式下它是页面唯一的呼吸信号。
 * 时间驱动：墙钟对齐 setTimeout（对齐到下一整秒 +20ms 缓冲），
 * 不用裸 setInterval——后者会漂移且后台节流积压；
 * 页面隐藏时停表，回前台立即校准到真实时间。
 */
const props = withDefaults(defineProps<{ hour12?: boolean }>(), { hour12: false })

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

onMounted(() => {
  schedule()
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  window.clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})

const pad = (n: number) => String(n).padStart(2, '0')

// 时/分 两组（分钟翻页节奏）；tick 仍每秒对齐——保证整分翻转时刻精准，兼供冒号滴答
const groups = computed(() => {
  const h = props.hour12 ? now.value.getHours() % 12 || 12 : now.value.getHours()
  const t = `${pad(h)}${pad(now.value.getMinutes())}`
  return [[t[0], t[1]], [t[2], t[3]]]
})

const meridiem = computed(() => (now.value.getHours() < 12 ? 'AM' : 'PM'))

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
  --clock-ink: #f5f5f0; /* 屏保固定白字，同 FlipCard 色板语义 */
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

/* 全屏放大（宽屏/横屏）：264px 侧栏预算归零（全屏时侧栏随文档流留在原页面），
   26vh 封顶放宽到 29vh——手机横屏 +12%、桌面全屏 +11%。
   双闸门：:fullscreen 保证非全屏（含 ≥769 的桌面宽窗口）不变；
   769 宽度闸挡住竖屏全屏（22vw 项超过行内系数 4.78 会横向溢出，竖屏回落基础公式 15vw 安全档） */
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
</style>
