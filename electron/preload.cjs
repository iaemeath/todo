/**
 * 渲染进程 ↔ 主进程桥（sandbox + contextIsolation 下唯一通道）。
 * 注入为 window.shiguang，网页端（http/https）无此对象——渲染层访问前必判空。
 * CJS 扩展名：package.json "type":"module" 下 .js 会按 ESM 解析，require 必崩。
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shiguang', {
  // 弹系统通知 + 任务栏闪烁；点击通知由主进程回推 onLocate
  notify: (payload) => ipcRenderer.invoke('remind:notify', payload),
  onLocate: (cb) => ipcRenderer.on('remind:locate', (_e, payload) => cb(payload)),
  // 系统唤醒/解锁（powerMonitor 转发，提醒调度器补扫描用）
  onWake: (cb) => ipcRenderer.on('remind:wake', () => cb()),
  // 同步"关闭按钮驻留托盘"设置（close 拦截行为由主进程持有）
  setCloseToTray: (v) => ipcRenderer.invoke('shell:close-to-tray', v)
})
