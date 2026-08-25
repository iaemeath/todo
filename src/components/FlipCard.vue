<template>
  <div class="flip-card" :class="{ flipping }">
    <!-- 静态底层：上半=目标数字（翻页终点可见）、下半=当前数字（翻页起点可见） -->
    <div class="flip-card__half">
      <span class="flip-card__digit">{{ upcoming }}</span>
    </div>
    <div class="flip-card__half flip-card__half--bottom">
      <span class="flip-card__digit">{{ shown }}</span>
    </div>
    <!-- 动画页·上：当前数字上半，绕中线向前翻倒（先动） -->
    <div class="flip-card__leaf flip-card__leaf--top">
      <span class="flip-card__digit">{{ shown }}</span>
    </div>
    <!-- 动画页·下：目标数字下半，从中线展平盖下（半程跟上） -->
    <div class="flip-card__leaf flip-card__leaf--bottom">
      <span class="flip-card__digit">{{ upcoming }}</span>
    </div>
    <!-- 中线亮缝 -->
    <div class="flip-card__seam"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * 单数字机械翻牌（split-flap 三明治结构）：
 * 静态上半(目标)+静态下半(当前)打底，双动画页绕中线旋转完成过渡——
 * 上页 rotateX 0°→-90° 先倒，下页 90°→0° 延迟半程展平盖下。
 * 尺寸由父级注入 --flip-w（卡片宽），数字上下半共用同一整卡排版坐标系（clip 裁切对位）。
 */
const props = defineProps<{ value: string | number }>()

// shown=稳定显示值；upcoming=翻页目标。值变化触发一次翻转
const shown = ref(String(props.value))
const upcoming = ref(String(props.value))
const flipping = ref(false)

// 收尾时长与 CSS 侧令牌对应：--flip-dur(=duration-base 300ms) + --flip-delay(=dur/2 150ms) + 50ms 缓冲
const FLIP_TOTAL_MS = 500
let flipTimer = 0

const startFlip = () => {
  flipping.value = true
  window.clearTimeout(flipTimer)
  flipTimer = window.setTimeout(() => {
    shown.value = upcoming.value
    flipping.value = false
    // 收尾间隙又来新值（极端连跳）→ 以最新目标再翻一次
    if (shown.value !== String(props.value)) {
      upcoming.value = String(props.value)
      startFlip()
    }
  }, FLIP_TOTAL_MS)
}

watch(
  () => props.value,
  (v) => {
    const next = String(v)
    if (next === upcoming.value) return
    upcoming.value = next
    if (!flipping.value) startFlip()
  }
)
</script>

<style scoped>
/* 屏保专属固定深色板：黑底白字是 Fliqlo 风屏保语义的一部分，恒定不随主题令牌切换 */
.flip-card {
  --flip-face-top: #232326; /* 上半受顶光 */
  --flip-face-bottom: #17171a; /* 下半背光更暗 */
  --flip-ink: #f5f5f0;
  --flip-seam: rgb(255 255 255 / 14%);
  --flip-dur: var(--duration-base); /* 翻转时长与 JS 侧 FLIP_TOTAL_MS 对应 */
  --flip-delay: calc(var(--flip-dur) / 2); /* 下页半程跟上 */
  position: relative;
  width: var(--flip-w);
  height: calc(var(--flip-w) * 1.18);
  border-radius: var(--radius-sm);
  perspective: calc(var(--flip-w) * 3);
  box-shadow: 0 3px 12px rgb(0 0 0 / 45%);
}

/* 数字铺满整卡坐标系（上下半各裁一半）：衬线粗体贴近 Fliqlo 的窄长字感 */
.flip-card__digit {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 200%; /* 相对半高容器 = 整卡高，上下半共用同一排版，翻转时严格对位 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Cambria, 'Times New Roman', Georgia, serif;
  font-size: calc(var(--flip-w) * 1.02);
  font-weight: var(--weight-bold);
  line-height: 1;
  color: var(--flip-ink);
  user-select: none;
}

/* ===== 静态底层 ===== */
.flip-card__half {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50%;
  overflow: hidden;
  background: linear-gradient(180deg, var(--flip-face-top), color-mix(in srgb, var(--flip-face-top), black 12%));
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.flip-card__half--bottom {
  top: 50%;
  background: linear-gradient(180deg, var(--flip-face-bottom), color-mix(in srgb, var(--flip-face-bottom), black 22%));
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

/* 下半的数字上移半卡高 → 显示整卡排版的下半 */
.flip-card__half--bottom .flip-card__digit,
.flip-card__leaf--bottom .flip-card__digit {
  top: -100%;
}

/* ===== 动画页（铰链都在中线） ===== */
.flip-card__leaf {
  position: absolute;
  left: 0;
  width: 100%;
  height: 50%;
  overflow: hidden;
  z-index: 1;
  backface-visibility: hidden;
}

.flip-card__leaf--top {
  top: 0;
  transform-origin: center bottom; /* 铰链=卡中线 */
  background: linear-gradient(180deg, var(--flip-face-top), color-mix(in srgb, var(--flip-face-top), black 12%));
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.flip-card__leaf--bottom {
  top: 50%;
  transform-origin: center top; /* 铰链=卡中线 */
  transform: rotateX(90deg); /* 平放待命，正视不可见 */
  background: linear-gradient(180deg, var(--flip-face-bottom), color-mix(in srgb, var(--flip-face-bottom), black 22%));
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

/* 翻转时序全令牌组合（duration-base + 半程 delay），无手写秒数 */
.flip-card.flipping .flip-card__leaf--top {
  animation: flip-leaf-top var(--flip-dur) var(--ease-standard) forwards;
}

.flip-card.flipping .flip-card__leaf--bottom {
  animation: flip-leaf-bottom var(--flip-dur) var(--ease-standard) var(--flip-delay) forwards;
}

@keyframes flip-leaf-top {
  to {
    transform: rotateX(-90deg);
  }
}

@keyframes flip-leaf-bottom {
  from {
    transform: rotateX(90deg);
  }

  to {
    transform: rotateX(0deg);
  }
}

/* 中线亮缝（机械翻牌的分割线） */
.flip-card__seam {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  transform: translateY(-50%);
  background: var(--flip-seam);
  z-index: 2;
  pointer-events: none;
}

/* 减少动效偏好：跳过翻页直接换数字 */
@media (prefers-reduced-motion: reduce) {
  .flip-card__leaf {
    display: none;
  }
}
</style>
