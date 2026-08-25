/**
 * Electron 主进程（ESM，package.json "type":"module"）。
 * 加载本地构建产物 dist/index.html —— 断网可完整运行（本地优先架构），
 * 云同步走远程服务器（apiClient 在 file:// 协议下自动切换绝对地址）。
 */
import { app, BrowserWindow, shell, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// CJS 包的 ESM 默认导入（rolldown 打包后同为 CJS require）
import electronUpdaterPkg from 'electron-updater'

const { autoUpdater } = electronUpdaterPkg
const __dirname = dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: '拾光',
    autoHideMenuBar: true, // 藏菜单栏但保留默认菜单（F12 调试可用），Alt 可唤出
    show: false,
    webPreferences: {
      contextIsolation: true, // 纯 Web 应用：无 node 集成，只靠 fetch 走 HTTP
      sandbox: true
    }
  })

  // 白屏闪烁优化：就绪后再显示
  win.once('ready-to-show', () => win.show())

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

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdate()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
