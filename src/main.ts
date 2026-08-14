import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import 'element-plus/theme-chalk/dark/css-vars.css'

registerSW({ immediate: true })

createApp(App).use(createPinia()).mount('#app')
