<template>
  <header class="app-navbar">
    <div class="nav-logo">
      <el-icon class="logo-icon"><Calendar /></el-icon>
      <span class="logo-text">Antigravity</span>
    </div>

    <nav class="nav-tabs">
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
      <button
        class="nav-tab"
        :class="{ active: currentView === 'settings' }"
        @click="switchView('settings')"
        title="设置"
      >
        <el-icon class="tab-icon"><Setting /></el-icon>
        <span>设置</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Calendar, List, Clock, Setting } from '@element-plus/icons-vue'
import { useUI, type AppView } from '../composables/useUI'

const { currentView, switchView } = useUI()

const tabs: { key: AppView; label: string; icon: any }[] = [
  { key: 'home', label: '主页', icon: Calendar },
  { key: 'task', label: '任务管理', icon: List },
  { key: 'schedule', label: '日程管理', icon: Clock }
]
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
</style>
