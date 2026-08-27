import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { SystemBars } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { isNativeShell } from '../services/apiClient'

/**
 * 全屏组合式函数：收敛 Web/安卓壳双路径，页面侧拿到 web 式的极简接口
 * （isFullscreen + toggleFullscreen），平台差异全部退到本文件一个分支里。
 *
 * 安卓壳不走 Web Fullscreen API——WebView 元素全屏依赖
 * WebChromeClient.onShowCustomView，官方文档明言宿主不显示该 view 则全屏
 * 不被兑现；Capacitor 的 BridgeWebChromeClient 覆写了但刻意拒绝（立即
 * callback.onCustomViewHidden() 打发回去），requestFullscreen 被 reject 且
 * fullscreenchange 不触发，故壳内改用本地状态驱动官方 SystemBars 插件
 * （core 8 内置，原生端随 Bridge 自动注册）隐藏/恢复系统栏；锁横走
 * @capacitor/screen-orientation（WebView 的 JS 锁不生效）。
 * Web 路径走元素 requestFullscreen + fullscreenchange 事件同步状态。
 */
export function useFullscreen(el: Ref<HTMLElement | undefined>) {
  const isFullscreen = ref(false)
  /** 壳内视觉态：无 fullscreenElement，全屏事实只存在于本地状态 */
  const isNativeFs = computed(() => isNativeShell && isFullscreen.value)

  /** 解锁横屏：壳内走原生（与 lock 同一通道）；Web 走 JS API（本就未锁则静默） */
  const unlockOrientation = () => {
    if (isNativeShell) {
      void ScreenOrientation.unlock().catch(() => {})
      return
    }
    try {
      screen.orientation.unlock()
    } catch {
      /* 本就未锁（桌面/竖屏设备） */
    }
  }

  /** 锁横：壳内走原生 setRequestedOrientation；Web 维持 JS 锁横（降级语义不变） */
  const lockLandscape = async () => {
    if (isNativeShell) {
      await ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {
        /* 壳内锁横异常降级竖屏 */
      })
      return
    }
    try {
      await screen.orientation.lock('landscape')
    } catch {
      /* 降级：保持竖屏全屏 */
    }
  }

  /**
   * 全屏切换（移动端顺带锁横屏——床头钟形态）。
   * 锁横依赖全屏态：Android Chrome/Electron 完整支持；iOS Safari 与系统竖屏锁定
   * 会 reject → 降级为竖屏全屏，内容照常显示，无新增破坏面。
   */
  const toggleFullscreen = async () => {
    if (isNativeShell) {
      if (isFullscreen.value) {
        isFullscreen.value = false
        void SystemBars.show().catch(() => {})
        unlockOrientation()
        void releaseWakeLock()
      } else {
        isFullscreen.value = true
        void SystemBars.hide().catch(() => {})
        await lockLandscape()
        void requestWakeLock()
      }
      return
    }
    try {
      if (document.fullscreenElement) {
        unlockOrientation()
        await document.exitFullscreen()
      } else {
        await el.value?.requestFullscreen()
        await lockLandscape()
      }
    } catch {
      /* 全屏被浏览器策略拒绝时静默降级（内容正常显示） */
    }
  }

  const onFsChange = () => {
    isFullscreen.value = !!document.fullscreenElement
    // 手势/系统键退出全屏时补解锁，防系统仍停留横屏锁定（纯 web 路径；
    // 壳内不触发 fullscreenchange，退出走 toggleFullscreen 壳分支）
    if (!isFullscreen.value) {
      unlockOrientation()
      void releaseWakeLock()
    } else {
      void requestWakeLock()
    }
  }

  // ===== 屏幕唤醒锁定（Wake Lock）：仅全屏时持有——全屏=明确的展示意图 =====
  // 平台约束：Firefox 与非安全上下文（局域网 http 部署）无此 API → 探测后静默降级；
  // 页面隐藏时 sentinel 被系统自动释放且不自动恢复，回前台若仍全屏须重新请求。
  // 注意全屏本身不阻止系统休眠（无媒体播放时 Chromium 无隐式豁免），此锁是唯一手段
  let wakeLock: WakeLockSentinel | null = null

  const requestWakeLock = async () => {
    // 双前置：当前在全屏 + 平台支持（narrow 探测兼顾旧类型定义）。
    // 壳内不走 Web Fullscreen API（无 fullscreenElement），以本地状态为准
    const fs = isNativeShell ? isFullscreen.value : !!document.fullscreenElement
    if (!fs || !('wakeLock' in navigator)) return
    try {
      wakeLock = await navigator.wakeLock.request('screen')
    } catch {
      /* 系统拒绝（低电量省电模式等）——静默降级，内容照常 */
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

  // 回前台：hidden 期间 wake lock 已被系统回收，若仍全屏则重新持有
  const onVisForWakeLock = () => {
    if (!document.hidden) void requestWakeLock()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisForWakeLock)
    document.addEventListener('fullscreenchange', onFsChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisForWakeLock)
    document.removeEventListener('fullscreenchange', onFsChange)
    // 全屏态直接路由离开：壳内无 fullscreenchange 事件，系统栏在此兜底恢复
    // （验收项：退出后其他页面系统栏无残留）
    if (isNativeShell && isFullscreen.value) {
      void SystemBars.show().catch(() => {})
      unlockOrientation()
    }
    void releaseWakeLock()
  })

  return { isFullscreen, isNativeFs, toggleFullscreen }
}
