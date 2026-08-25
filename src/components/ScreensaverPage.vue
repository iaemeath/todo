<template>
  <div ref="pageEl" class="screensaver-page">
    <!-- 工具条：闲置 3s 淡出、任意指针活动唤出（屏保沉浸 + 全端可达，替代触屏常显/hover 门控双分支） -->
    <div class="screensaver-toolbar" :class="{ 'is-idle': !toolbarVisible }">
      <button class="scv-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
        <el-icon :size="18"><FullScreen /></el-icon>
      </button>
      <button class="scv-btn scv-btn--text" title="切换 12/24 小时制" @click="toggleHour12">
        {{ hour12 ? '12H' : '24H' }}
      </button>
    </div>

    <div class="screensaver-stage">
      <FlipClock :hour12="hour12" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { FullScreen } from '@element-plus/icons-vue'
import FlipClock from './FlipClock.vue'

/**
 * 屏保页（Fliqlo 风翻页时钟）。
 * 固定纯黑是屏保语义的一部分（黑底白字机械翻牌），不随应用主题令牌切换；
 * 全屏对页面元素自身 requestFullscreen——侧栏随文档流留在原页面，天然沉浸；
 * 移动端全屏顺带锁横屏（床头钟形态），不支持的平台降级竖屏全屏（见 toggleFullscreen）。
 */
const LS_HOUR12 = 'screensaver_hour12'

const pageEl = ref<HTMLElement>()
const isFullscreen = ref(false)
const hour12 = ref(localStorage.getItem(LS_HOUR12) === '1')

/**
 * 全屏切换（移动端顺带锁横屏——床头钟形态）。
 * 锁横依赖全屏态：Android Chrome/Electron 完整支持；iOS Safari 与系统竖屏锁定
 * 会 reject → 降级为竖屏全屏，时钟照常显示，无新增破坏面。
 */
const unlockOrientation = () => {
  try {
    screen.orientation.unlock()
  } catch {
    /* 本就未锁（桌面/竖屏设备） */
  }
}

const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      unlockOrientation()
      await document.exitFullscreen()
    } else {
      await pageEl.value?.requestFullscreen()
      try {
        await screen.orientation.lock('landscape')
      } catch {
        /* 降级：保持竖屏全屏 */
      }
    }
  } catch {
    /* 全屏被浏览器策略拒绝时静默降级（时钟正常显示） */
  }
}

const onFsChange = () => {
  isFullscreen.value = !!document.fullscreenElement
  // 手势/系统键退出全屏时补解锁，防系统仍停留横屏锁定
  if (!isFullscreen.value) {
    unlockOrientation()
    void releaseWakeLock()
  } else {
    void requestWakeLock()
  }
}

// ===== 屏幕唤醒锁定（Wake Lock）：仅全屏时持有——全屏=明确的展示意图（床头钟/挂钟） =====
// 平台约束：Firefox 与非安全上下文（局域网 http 部署）无此 API → 探测后静默降级；
// 页面隐藏时 sentinel 被系统自动释放且不自动恢复，回前台若仍全屏须重新请求。
// 注意全屏本身不阻止系统休眠（无媒体播放时 Chromium 无隐式豁免），此锁是唯一手段
let wakeLock: WakeLockSentinel | null = null

const requestWakeLock = async () => {
  // 双前置：当前在全屏 + 平台支持（narrow 探测兼顾旧类型定义）
  if (!document.fullscreenElement || !('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    /* 系统拒绝（低电量省电模式等）——静默降级，时钟照常 */
  }
}

const releaseWakeLock = async () => {
  try {
    await wakeLock?.release()
  } catch {
    /* 已被系统释放——no-op */
  }
  wakeLock = null
}

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
    // hidden 期间 wake lock 已被系统回收，回前台若仍全屏则重新持有
    void requestWakeLock()
  }
}

onMounted(() => {
  scheduleIdleHide()
  window.addEventListener('pointermove', onPointerActivity, { passive: true })
  window.addEventListener('pointerdown', onPointerActivity, { passive: true })
  document.addEventListener('visibilitychange', onVisForToolbar)
  document.addEventListener('fullscreenchange', onFsChange)
})

onUnmounted(() => {
  window.clearTimeout(idleTimer)
  window.removeEventListener('pointermove', onPointerActivity)
  window.removeEventListener('pointerdown', onPointerActivity)
  document.removeEventListener('visibilitychange', onVisForToolbar)
  document.removeEventListener('fullscreenchange', onFsChange)
  void releaseWakeLock()
})

const toggleHour12 = () => {
  hour12.value = !hour12.value
  localStorage.setItem(LS_HOUR12, hour12.value ? '1' : '0')
}
</script>

<style scoped>
.screensaver-page {
  position: relative;
  height: 100%;
  background: #050507; /* 屏保固定纯黑（Fliqlo 语义），特例不走主题令牌 */
  border-radius: var(--radius-lg); /* 桌面浮岛：content-area 12px 内边距下的圆角观感 */
  overflow: hidden;
  display: flex;
}

/* 自身进入全屏：铺满视口、直角 */
.screensaver-page:fullscreen {
  border-radius: 0;
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

.scv-btn {
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-sm);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 9999px; /* 圆钮（规则允许的胶囊特例值） */
  background: rgb(255 255 255 / 6%);
  color: #f5f5f0;
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: background var(--duration-fast) ease;
}

.scv-btn:hover {
  background: rgb(255 255 255 / 14%);
}
</style>
