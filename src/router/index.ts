import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * hash 路由：URL 是视图状态的唯一真相源（刷新保持位置、浏览器返回键自然工作）。
 *
 * 模式选择依据：hash 变化不发服务器请求——nginx 静态部署零配置，
 * Electron file:// 加载（History API 在 file 协议下不可用）天然工作。
 *
 * 桥接式设计：视图渲染仍由 App.vue 的 v-if 分支承担（不用 router-view），
 * ui store 从路由派生 currentView/settingsSection，组件层零改动。
 */
// 视图渲染由 App.vue 的 v-if 分支承担，路由记录仅承载 URL 状态（空渲染占位满足类型）
const EmptyView = { render: () => null }

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: EmptyView },
    { path: '/task', name: 'task', component: EmptyView },
    { path: '/schedule', name: 'schedule', component: EmptyView },
    { path: '/settings/:section', name: 'settings', component: EmptyView },
    { path: '/auth', name: 'auth', component: EmptyView },
    // 未匹配路径兜底回主页
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
