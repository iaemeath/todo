/**
 * 桌面壳桥类型（electron/preload.cjs 经 contextBridge 注入为 window.shiguang）。
 * 网页端（http/https）无此对象——所有访问处必须判空，语义为"降级为无桌面能力"。
 */
export interface DesktopBridge {
  /** 弹系统通知（主进程 Notification）+ 任务栏闪烁；点击回推 onLocate */
  notify(payload: { title: string; body: string; scheduleId: string; date: string }): void
  /** 订阅通知点击定位（回推日程 id 与日期，渲染层负责跳转） */
  onLocate(cb: (payload: { scheduleId: string; date: string }) => void): void
  /** 订阅系统唤醒/解锁（主进程 powerMonitor 转发，调度器补扫描用） */
  onWake(cb: () => void): void
  /** 同步"关闭按钮驻留托盘"设置到主进程（close 拦截行为由主进程持有） */
  setCloseToTray(v: boolean): void
}

declare global {
  interface Window {
    shiguang?: DesktopBridge
  }
}

export {}
