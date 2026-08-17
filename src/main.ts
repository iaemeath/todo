import { createApp } from 'vue'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import 'dayjs/locale/zh-cn'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 命令式组件（ElMessage / ElMessageBox）不经模板渲染，按需引入插件不会带上样式，须手动引入
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

// dayjs 全局中文 locale：周一起始（与 FullCalendar firstDay:1 对齐，否则周选择器算出的周起始是周日）
dayjs.locale('zh-cn')

// SW 静默更新会让用户一直跑旧版本（此前只能硬刷新）：定期检查 + 新版本就绪时提示刷新
registerSW({
  immediate: true,
  onRegisteredSW(_url: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) return
    setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          ElMessage({ message: '新版本已就绪，刷新页面后生效', type: 'success', duration: 0, showClose: true })
        }
      })
    })
  }
})

createApp(App).use(createPinia()).mount('#app')
