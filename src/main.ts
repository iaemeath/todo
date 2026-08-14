import { createApp } from 'vue'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import 'dayjs/locale/zh-cn'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 命令式组件（ElMessage / ElMessageBox）不经模板渲染，按需引入插件不会带上样式，须手动引入
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

// dayjs 全局中文 locale：周一起始（与 FullCalendar firstDay:1 对齐，否则周选择器算出的周起始是周日）
dayjs.locale('zh-cn')

registerSW({ immediate: true })

createApp(App).use(createPinia()).mount('#app')
