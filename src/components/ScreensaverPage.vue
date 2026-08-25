<template>
  <div ref="pageEl" class="screensaver-page">
    <!-- 工具条：hover 显现（hover 门控），触屏常显低透明度；全屏沉浸不打扰 -->
    <div class="screensaver-toolbar">
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
  if (!isFullscreen.value) unlockOrientation()
}

const toggleHour12 = () => {
  hour12.value = !hour12.value
  localStorage.setItem(LS_HOUR12, hour12.value ? '1' : '0')
}

onMounted(() => document.addEventListener('fullscreenchange', onFsChange))
onUnmounted(() => document.removeEventListener('fullscreenchange', onFsChange))
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
  opacity: 0.45; /* 触屏无 hover，常显低透明度兜底 */
  transition: opacity var(--duration-base) ease;
}

/* 纯 hover 显现效果用 hover 门控，规避触屏 sticky-hover */
@media (hover: hover) {
  .screensaver-toolbar {
    opacity: 0;
  }

  .screensaver-toolbar:hover {
    opacity: 1;
  }
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
