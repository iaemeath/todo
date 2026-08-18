<template>
  <header class="app-navbar">
    <!-- 左侧：移动端非主页显示「‹ 标题」返回按钮；否则 logo（点击回主页） -->
    <button
      v-if="isMobile && currentView !== 'home'"
      class="nav-back"
      @click="switchView('home')"
    >
      <el-icon><ArrowLeft /></el-icon>
      <span>{{ navTitle }}</span>
    </button>
    <div v-else class="nav-logo" @click="switchView('home')" title="返回主页">
      <el-icon class="logo-icon"><Calendar /></el-icon>
      <span class="logo-text">拾光</span>
    </div>

    <!-- 桌面端：任务/日程/设置 toggle（再点一次当前页 → 回主页；主页由 logo 充当） -->
    <nav v-if="!isMobile" class="nav-tabs">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="nav-tab"
        :class="{ active: currentView === item.key }"
        @click="toggleView(item.key)"
      >
        <el-icon class="tab-icon"><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <!-- 移动端：主页时显示 任务/日程/设置 图标（任务/日程可在设置中隐藏） -->
    <div class="nav-actions">
      <template v-if="isMobile && currentView === 'home'">
        <button v-if="showTaskManage" class="nav-tab icon-only" @click="switchView('task')" title="任务管理">
          <el-icon><List /></el-icon>
        </button>
        <button v-if="showScheduleManage" class="nav-tab icon-only" @click="switchView('schedule')" title="日程管理">
          <el-icon><Clock /></el-icon>
        </button>
        <button class="nav-tab icon-only" @click="switchView('settings')" title="设置">
          <el-icon><Setting /></el-icon>
        </button>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, List, Clock, Setting, ArrowLeft } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useUIStore, useSettingsStore, type AppView } from '../stores'

const uiStore = useUIStore()
const { currentView, isMobile, settingsSection } = storeToRefs(uiStore) // state → storeToRefs
const { switchView } = uiStore // action 直接解构
const { settings } = storeToRefs(useSettingsStore())

// 桌面端导航项（主页由 logo 充当，故只列 任务/日程/设置；网页端三项常驻，
// 设置中的开关只管移动端显隐）
const navItems: { key: AppView; label: string; icon: any }[] = [
  { key: 'task', label: '任务管理', icon: List },
  { key: 'schedule', label: '日程管理', icon: Clock },
  { key: 'settings', label: '设置', icon: Setting }
]

// 移动端任务/日程入口可见性（设置中可关；默认隐藏，网页端不受影响）
const showTaskManage = computed(() => settings.value.showTaskManage)
const showScheduleManage = computed(() => settings.value.showScheduleManage)

// toggle 导航：再点一次当前页 → 回主页
const toggleView = (view: AppView) => {
  switchView(currentView.value === view ? 'home' : view)
}

// 移动端非主页返回按钮标题
const settingsTitle = computed(() => {
  const map: Record<string, string> = { list: '设置', view: '视觉与外观', ai: 'AI 助理配置', usage: 'API 消耗记录', data: '数据管理', guide: '使用指南' }
  return map[settingsSection.value] || '设置'
})
const navTitle = computed(() => {
  if (currentView.value === 'settings') return settingsTitle.value
  if (currentView.value === 'task') return '任务管理'
  if (currentView.value === 'schedule') return '日程管理'
  return ''
})
</script>

<style scoped>
/* 移动优先：基础样式 = 移动端（紧凑 padding / 纯图标入口），桌面增强在 min-width 断点 */
.app-navbar {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 var(--space-lg); /* 桌面 16 / 移动 12（令牌双值） */
  gap: var(--space-sm);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: var(--weight-bold);
  font-size: 1rem;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
  cursor: pointer;
  transition: color var(--duration-fast) ease;
}

.nav-logo:hover {
  color: var(--el-color-primary);
}

.logo-icon {
  font-size: 1.3rem;
  color: var(--el-color-primary);
}

/* 移动端非主页：返回按钮（触控目标达标） */
.nav-back {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: transparent;
  border: none;
  color: var(--el-text-color-primary);
  font-size: var(--font-base);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  padding: var(--space-sm) 0;
  min-height: var(--touch-target);
}

.nav-tabs {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  flex: 1;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
  margin-left: auto;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.nav-tab:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.nav-tab.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: var(--weight-semibold);
}

.tab-icon {
  font-size: 1.05rem;
}

/* 移动端：纯图标按钮，热区满足触控目标令牌 */
.nav-tab.icon-only {
  padding: var(--space-sm);
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  font-size: 1.25rem;
}

/* 桌面增强：logo 放大一档 */
@media (width >= 769px) {
  .logo-text {
    font-size: var(--font-md);
  }
}
</style>
