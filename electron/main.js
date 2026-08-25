/**
 * Electron 主进程（ESM，package.json "type":"module"）。
 * 加载本地构建产物 dist/index.html —— 断网可完整运行（本地优先架构），
 * 云同步走远程服务器（apiClient 在 file:// 协议下自动切换绝对地址）。
 *
 * 桌面常驻能力（v4.7 提醒功能配套）：
 * - 托盘：单击恢复窗口；菜单【显示主窗口 / 开机自启(--hidden 静默) / 退出】
 * - 关窗驻留：点 ✕ 默认 hide 到托盘（设置可关），托盘菜单才真退出
 * - 系统通知：渲染层 remind:notify（sandbox 下无 node 集成，只经 preload IPC）
 *   → Notification toast + flashFrame 任务栏闪烁；点击通知回推 remind:locate 定位日程
 * - 单实例：二次启动唤起已有窗口
 * - 唤醒转发：powerMonitor resume/unlock-screen → remind:wake（渲染层调度器补扫描）
 */
import { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, powerMonitor, shell, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// CJS 包的 ESM 默认导入（rolldown 打包后同为 CJS require）
import electronUpdaterPkg from 'electron-updater'

const { autoUpdater } = electronUpdaterPkg
const __dirname = dirname(fileURLToPath(import.meta.url))

// Windows toast 发件人归属：打包态用 appId（与 NSIS 快捷方式一致），
// dev 态用 execPath——否则通知显示为 electron.app.Electron 甚至静默失败
app.setAppUserModelId(app.isPackaged ? 'pub.ylh.shiguang' : process.execPath)

// 开机自启的静默参数：登录后只有托盘不弹窗
const startHidden = process.argv.includes('--hidden')

let win = null
let tray = null
let quitting = false
// 「关闭按钮驻留托盘」设置（渲染层经 IPC 同步，默认开）；托盘不可用时强制直关以防藏死
let closeToTray = true

const showMain = () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: '拾光',
    autoHideMenuBar: true, // 藏菜单栏但保留默认菜单（F12 调试可用），Alt 可唤出
    show: false,
    webPreferences: {
      contextIsolation: true, // 纯 Web 应用：无 node 集成，只靠 fetch 走 HTTP
      sandbox: true,
      preload: join(__dirname, 'preload.cjs'),
      // 托盘驻留态计时器不节流——渲染层提醒调度依赖精确定时
      backgroundThrottling: false
    }
  })

  // 白屏闪烁优化：就绪后再显示（--hidden 开机自启时只驻托盘不弹窗）
  win.once('ready-to-show', () => {
    if (!startHidden) win.show()
  })

  // 关窗驻留：真退出只走托盘菜单/quit 路径（before-quit 置 quitting）
  win.on('close', (e) => {
    if (!quitting && closeToTray && tray) {
      e.preventDefault()
      win.hide()
    }
  })
  // 用户看过了：停任务栏闪烁（微信/钉钉式"读了就不闪"）
  win.on('focus', () => win.flashFrame(false))

  // dev 便捷入口：ELECTRON_START_URL=http://localhost:5173 electron electron/main.js
  if (process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL)
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  // 外部链接（target=_blank 等）交给系统浏览器，不在应用内开新窗
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function createTray() {
  // 图标缺失（首次构建前）不建托盘：关窗驻留随之失效，宁可直关不可藏死
  const icon = nativeImage.createFromPath(join(__dirname, 'tray.png'))
  if (icon.isEmpty()) {
    console.warn('[shiguang] tray.png 缺失，托盘/关窗驻留未启用（先跑 scripts/gen-icons.mjs）')
    return
  }
  tray = new Tray(icon)
  tray.setToolTip('拾光')
  tray.on('click', showMain)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主窗口', click: showMain },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] })
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        quitting = true
        app.quit()
      }
    }
  ]))
}

function setupIpc() {
  // 提醒通知：toast + 任务栏闪烁；点击 → 置前窗口并回推定位
  ipcMain.handle('remind:notify', (_e, payload) => {
    if (!Notification.isSupported() || !payload || typeof payload !== 'object') return { ok: false }
    const n = new Notification({ title: String(payload.title || '日程提醒'), body: String(payload.body || '') })
    n.on('click', () => {
      showMain()
      win?.webContents.send('remind:locate', { scheduleId: payload.scheduleId, date: payload.date })
    })
    n.show()
    win?.flashFrame(true)
    return { ok: true }
  })

  ipcMain.handle('shell:close-to-tray', (_e, v) => {
    closeToTray = v !== false
    return { ok: true }
  })
}

/**
 * 自动更新（electron-updater，仅打包态启用——dev 的 isPackaged=false 天然关闭）。
 * feed 地址来自 package.json build.publish（electron-builder 据此生成 app-update.yml）：
 * 服务器 https://域名/updates/ 放 NSIS 安装包 + latest.yml（electron:build 产物直接上传）。
 * 流程：启动+每 6 小时静默检查 → 后台下载 → 就绪弹窗询问重启（选"稍后"则退出时自动装）。
 */
function setupAutoUpdate() {
  if (!app.isPackaged) return
  autoUpdater.logger = console
  autoUpdater.on('update-downloaded', (info) => {
    void dialog.showMessageBox({
      type: 'info',
      title: '更新就绪',
      message: `新版本 ${info.version} 已下载完成，重启后即可完成安装。`,
      buttons: ['立即重启', '稍后'],
      defaultId: 0
    }).then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall() })
  })
  // 网络不可达/feed 未部署等一律容忍（自用工具更新失败绝不打扰使用）
  autoUpdater.on('error', (e) => console.warn('[autoUpdater]', e?.message || e))
  void autoUpdater.checkForUpdates()
  setInterval(() => void autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000)
}

// 单实例：二次启动唤起已有窗口（QQ/微信式），本进程随即退出
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMain)

  app.whenReady().then(() => {
    createWindow()
    createTray()
    setupIpc()
    setupAutoUpdate()
    // 系统睡眠唤醒/解锁：转发渲染层补扫描（睡眠期间定时器冻结是精确定时的唯一盲区）
    powerMonitor.on('resume', () => win?.webContents.send('remind:wake'))
    powerMonitor.on('unlock-screen', () => win?.webContents.send('remind:wake'))
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // 真退出前置标志：closeToTray=false 直关或托盘菜单退出都走这里
  app.on('before-quit', () => {
    quitting = true
  })

  app.on('window-all-closed', () => {
    // 关窗驻留时窗口只是 hide，不触达此事件；直关模式保持桌面惯例退出
    if (process.platform !== 'darwin') app.quit()
  })
}
