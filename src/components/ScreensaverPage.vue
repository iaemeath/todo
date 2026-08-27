<template>
  <div ref="pageEl" class="screensaver-page" :class="{ 'is-native-fs': isNativeFs }">
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
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { FullScreen } from '@element-plus/icons-vue'
import FlipClock from './FlipClock.vue'
import { useFullscreen } from '../composables/useFullscreen'
import { useUIStore } from '../stores'

/**
 * 屏保页（Fliqlo 风翻页时钟）。
 * 固定纯黑是屏保语义的一部分（黑底白字机械翻牌），不随应用主题令牌切换；
 * 全屏/锁横/唤醒锁走 useFullscreen（Web/安卓壳双路径收敛，见其文件头说明）。
 */
const LS_HOUR12 = 'screensaver_hour12'

const pageEl = ref<HTMLElement>()
const { isFullscreen, isNativeFs, toggleFullscreen } = useFullscreen(pageEl)
const hour12 = ref(localStorage.getItem(LS_HOUR12) === '1')

// 全屏态上提 store：App 层据此 v-show 隐藏语音球（壳内 CSS 伪装全屏盖不住
// z 更高的球）。Web 经 fullscreenchange、壳内经 toggle，均落回本 watch 同步
const uiStore = useUIStore()
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
  window.addEventListener('pointermove', onPointerActivity, { passive: true })
  window.addEventListener('pointerdown', onPointerActivity, { passive: true })
  document.addEventListener('visibilitychange', onVisForToolbar)
})

onUnmounted(() => {
  window.clearTimeout(idleTimer)
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
  position: relative;
  height: 100%;
  background: #050507; /* 屏保固定纯黑（Fliqlo 语义），特例不走主题令牌 */
  border-radius: var(--radius-lg); /* 桌面浮岛：content-area 12px 内边距下的圆角观感 */
  overflow: hidden;
  display: flex;
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
