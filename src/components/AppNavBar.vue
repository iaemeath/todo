<template>
  <header class="app-navbar">
    <div class="nav-logo">
      <el-icon class="logo-icon"><Calendar /></el-icon>
      <span class="logo-text">Antigravity</span>
    </div>

    <!-- 桌面端：中间 tabs -->
    <nav v-if="!isMobile" class="nav-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="nav-tab"
        :class="{ active: currentView === tab.key }"
        @click="switchView(tab.key)"
      >
        <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <div class="nav-actions">
      <!-- 桌面端：设置按钮 -->
      <button
        v-if="!isMobile"
        class="nav-tab"
        :class="{ active: currentView === 'settings' }"
        @click="switchView('settings')"
        title="设置"
      >
        <el-icon class="tab-icon"><Setting /></el-icon>
        <span>设置</span>
      </button>

      <!-- 移动端：汉堡按钮 -->
      <button
        v-if="isMobile"
        class="nav-tab hamburger"
        :class="{ active: drawerOpen }"
        @click="toggleDrawer"
        title="菜单"
      >
        <el-icon class="tab-icon"><Menu /></el-icon>
      </button>
    </div>
  </header>

  <!-- 移动端：左滑抽屉菜单 -->
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="isMobile && drawerOpen" class="drawer-overlay" @click.self="closeDrawer">
        <aside class="app-drawer">
          <button
            v-for="item in drawerItems"
            :key="item.key"
            class="drawer-item"
            :class="{ active: currentView === item.key }"
            @click="switchView(item.key)"
          >
            <el-icon class="drawer-icon"><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Calendar, List, Clock, Setting, Menu } from '@element-plus/icons-vue'
import { useUI, type AppView } from '../composables/useUI'

const { currentView, switchView, isMobile, drawerOpen, toggleDrawer, closeDrawer } = useUI()

const navItems: { key: AppView; label: string; icon: any }[] = [
  { key: 'home', label: '主页', icon: Calendar },
  { key: 'task', label: '任务管理', icon: List },
  { key: 'schedule', label: '日程管理', icon: Clock },
  { key: 'settings', label: '设置', icon: Setting }
]

// 桌面 tabs = 前 3 项（设置单独放右侧）；抽屉 = 全部 4 项
const tabs = navItems.slice(0, 3)
const drawerItems = navItems
</script>

<style scoped>
.app-navbar {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 24px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
  gap: 32px;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
}

.logo-icon {
  font-size: 1.3rem;
  color: var(--el-color-primary);
}

.nav-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-tab:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.nav-tab.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.tab-icon {
  font-size: 1.05rem;
}

.nav-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 移动端：navbar 收紧内边距 */
@media (max-width: 768px) {
  .app-navbar {
    padding: 0 16px;
    gap: 12px;
  }
  .logo-text {
    font-size: 1rem;
  }
  .hamburger {
    padding: 8px 10px;
  }
}

/* ===== 移动端抽屉 ===== */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--z-overlay);
  display: flex;
  align-items: stretch;
}

.app-drawer {
  width: 260px;
  max-width: 80vw;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.drawer-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 1rem;
  font-weight: 500;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.drawer-item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.drawer-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.drawer-icon {
  font-size: 1.2rem;
}

/* 抽屉滑入/滑出过渡：遮罩淡入 + 面板从左滑入 */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-slide-enter-active .app-drawer,
.drawer-slide-leave-active .app-drawer {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}

.drawer-slide-enter-from .app-drawer,
.drawer-slide-leave-to .app-drawer {
  transform: translateX(-100%);
}
</style>
