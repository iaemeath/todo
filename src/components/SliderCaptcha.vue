<script setup lang="ts">
/**
 * 滑块拼图人机验证（注册/忘记密码取邮箱验证码前必过）。
 * 流程：挂载即取挑战（背景+拼图 PNG）→ 拖动滑块（轨迹采样）→ 松手 verify
 * → 成功 emit 一次性 sliderToken（v-model），失败抖动后自动换图重来。
 * 宽度固定 280px 与服务端背景 1:1 像素对位（拖动位移即提交坐标，无缩放换算）。
 */
import { ref, computed, onMounted } from 'vue'
import { ChevronsRight, RefreshCw, CircleCheck } from 'lucide-vue-next'
import { api } from '../services/apiClient'

interface Challenge {
  id: string
  bg: string
  piece: string
  pieceY: number
}

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

/** 供父组件重置（token 已被业务接口消费后调） */
async function reset(): Promise<void> {
  emit('update:modelValue', null)
  sliderX.value = 0
  status.value = 'loading'
  await load()
}
defineExpose({ reset })

const BG_W = 280
const THUMB_W = 44
const MAX_X = BG_W - THUMB_W // 236

const challenge = ref<Challenge | null>(null)
const status = ref<'loading' | 'ready' | 'dragging' | 'verifying' | 'success' | 'fail'>('loading')
const sliderX = ref(0)

const statusClass = computed(() => `is-${status.value}`)
const tipText = computed(() => {
  if (status.value === 'success') return ''
  if (status.value === 'fail') return '验证失败，请重试'
  if (status.value === 'verifying') return '验证中…'
  return '按住滑块拖动，拼合缺口'
})

const load = async () => {
  status.value = 'loading'
  try {
    challenge.value = await api<Challenge>('/auth/slider/challenge')
    sliderX.value = 0
    status.value = 'ready'
    emit('update:modelValue', null)
  } catch {
    // 取图失败（离线/频控）：留在 loading，提示文案常驻
    challenge.value = null
  }
}
onMounted(load)

// ===== 拖动与轨迹采样 =====
let dragStartX = 0
let dragT0 = 0
let track: { t: number; x: number }[] = []

const onDown = (e: PointerEvent) => {
  if (status.value !== 'ready' || !challenge.value) return
  status.value = 'dragging'
  dragStartX = e.clientX
  dragT0 = performance.now()
  track = [{ t: 0, x: 0 }]
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

const onMove = (e: PointerEvent) => {
  if (status.value !== 'dragging') return
  const x = Math.min(MAX_X, Math.max(0, e.clientX - dragStartX))
  sliderX.value = x
  track.push({ t: Math.round(performance.now() - dragT0), x: Math.round(x) })
}

const onUp = async () => {
  if (status.value !== 'dragging' || !challenge.value) return
  status.value = 'verifying'
  try {
    const r = await api<{ token: string }>('/auth/slider/verify', {
      method: 'POST',
      body: { id: challenge.value.id, x: Math.round(sliderX.value), track }
    })
    status.value = 'success'
    emit('update:modelValue', r.token)
  } catch {
    // 未通过/已失效：短暂展示失败态后换图重来
    status.value = 'fail'
    window.setTimeout(() => void reset(), 900)
  }
}
</script>

<template>
  <div class="slider-captcha" :class="statusClass">
    <div v-if="challenge" class="sc-stage">
      <img class="sc-bg" :src="challenge.bg" draggable="false" alt="" />
      <img
        class="sc-piece"
        :src="challenge.piece"
        :style="{ top: `${challenge.pieceY}px`, transform: `translateX(${sliderX}px)` }"
        draggable="false"
        alt=""
      />
      <button
        class="sc-refresh"
        type="button"
        title="换一张"
        :disabled="status === 'verifying' || status === 'success'"
        @click="load"
      >
        <RefreshCw class="sc-icon" />
      </button>
    </div>
    <div v-else class="sc-stage sc-stage--loading">加载中…</div>

    <div class="sc-track">
      <div class="sc-fill" :style="{ width: `${sliderX + THUMB_W / 2}px` }"></div>
      <span class="sc-tip" :class="{ 'sc-tip--hidden': status === 'dragging' }">{{ tipText }}</span>
      <div
        class="sc-thumb"
        :style="{ transform: `translateX(${sliderX}px)` }"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <CircleCheck v-if="status === 'success'" class="sc-icon" />
        <ChevronsRight v-else class="sc-icon" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.slider-captcha {
  width: 280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  user-select: none;
}

/* 舞台：背景图 + 浮动拼图块 + 刷新钮（固定 280px 与服务端坐标 1:1） */
.sc-stage {
  position: relative;
  width: 280px;
  height: 160px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.sc-stage--loading {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.sc-bg {
  display: block;
  width: 280px;
  height: 160px;
}

.sc-piece {
  position: absolute;
  left: 0;
  width: 44px;
  height: 50px;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 35%));
  pointer-events: none;
}

.sc-refresh {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: rgb(15 18 34 / 45%);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--duration-fast) ease;
}

.sc-refresh:hover:not(:disabled) {
  background: rgb(15 18 34 / 65%);
}

.sc-refresh:disabled {
  opacity: 0.4;
  cursor: default;
}

/* 轨道：滑块位移 = 拼图位移（提交坐标），fill 跟随制造拖动反馈 */
.sc-track {
  position: relative;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
  overflow: hidden;
}

.sc-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--color-primary-alpha, rgb(64 128 255 / 15%));
  transition: none;
}

.is-success .sc-fill {
  background: rgb(103 194 58 / 22%);
}

.sc-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  color: var(--text-muted);
  pointer-events: none;
}

.sc-tip--hidden {
  opacity: 0;
}

.is-fail .sc-tip {
  color: var(--color-danger);
}

.sc-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 44px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  box-shadow: var(--shadow-sm);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none; /* 移动端：pointer 拖动优先于页面滚动 */
}

.sc-thumb:active {
  cursor: grabbing;
}

.is-success .sc-thumb {
  color: var(--el-color-success);
  border-color: var(--el-color-success);
  cursor: default;
}

.is-fail .sc-thumb {
  animation: sc-shake 0.4s ease;
}

.sc-icon {
  width: 20px;
  height: 20px;
}

@keyframes sc-shake {
  0%, 100% { margin-left: 0; }
  25% { margin-left: -6px; }
  75% { margin-left: 6px; }
}
</style>
