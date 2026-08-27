import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * hash 路由：URL 是视图状态的唯一真相源（刷新保持位置、浏览器返回键自然工作）。
 *
 * 模式选择依据：hash 变化不发服务器请求——nginx 静态部署零配置，
 * Electron file:// 加载（History API 在 file 协议下不可用）天然工作。
 *
 * 桥接式设计：视图渲染仍由 App.vue 的 v-if 分支承担（不用 router-view），
 * ui store 从路由派生 currentView/settingsSection，组件层零改动。
 *
 * 设置域页面为一级直达路由（/view /ai /data /guide /users，v4.6 扁平化——
 * 侧栏一级导航与 URL 对齐，SettingsPage 仍是统一渲染容器）。
 */
// 视图渲染由 App.vue 的 v-if 分支承担，路由记录仅承载 URL 状态（空渲染占位满足类型）
const EmptyView = { render: () => null }

export const SETTINGS_PATHS = ['view', 'ai', 'data', 'guide', 'users', 'about'] as const

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: EmptyView },
    { path: '/task', name: 'task', component: EmptyView },
    { path: '/schedule', name: 'schedule', component: EmptyView },
    { path: '/screensaver', name: 'screensaver', component: EmptyView },
    ...SETTINGS_PATHS.map(s => ({ path: `/${s}`, name: `settings-${s}`, component: EmptyView })),
    { path: '/auth', name: 'auth', component: EmptyView }
  ]
})

// 冷启动特判：屏保是展示态而非工作位置——上次会话停在屏保页时，浏览器/壳恢复
// hash 会让"初次进入"直接落进只剩时钟的屏保视图（移动端侧栏抽屉/待办浮层
// 均收起）。首导航是屏保则回主页；屏保内刷新同理回主页（临时态不保持位置，
// "刷新保持位置"特性对其余视图照旧）。应用内正常跳转不受影响（标志只拦首次）
let firstNav = true
router.beforeEach((to) => {
  if (!firstNav) return true
  firstNav = false
  if (to.path === '/screensaver') return { path: '/' }
  return true
})

