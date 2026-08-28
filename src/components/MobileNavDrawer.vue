<template>
  <!-- 移动端：导航抽屉（左滑入 + 底罩，与右侧待办浮层对称）。
       z 分层：抽屉 1100 / 底罩 1099，高于待办浮层（20）与底罩（19），
       低于 EP 弹窗（~2000+）与语音球（--z-overlay 10000） -->
  <template v-if="isMobile && navDrawerOpen">
    <div class="nav-backdrop" @click="setNavDrawerOpen(false)"></div>
    <Transition name="nav-slide">
      <div class="nav-drawer">
        <!-- logo 纯标识：点击关闭抽屉（与桌面 logo 隐藏导航同语义） -->
        <div class="nav-drawer__logo" @click="setNavDrawerOpen(false)">
          <el-icon class="logo-icon"><Calendar /></el-icon>
          <span class="logo-text">拾光</span>
        </div>
        <button class="nav-drawer__item" :class="{ active: currentView === 'home' }" @click="go('home')">
          <el-icon><Timer /></el-icon>
          <span>时间管理</span>
        </button>
        <button class="nav-drawer__item" :class="{ active: currentView === 'screensaver' }" @click="go('screensaver')">
          <el-icon><AlarmClock /></el-icon>
          <span>屏保</span>
        </button>
        <button class="nav-drawer__item" :class="{ active: currentView === 'task' }" @click="go('task')">
          <el-icon><List /></el-icon>
          <span>任务管理</span>
        </button>
        <button class="nav-drawer__item" :class="{ active: currentView === 'schedule' }" @click="go('schedule')">
          <el-icon><Clock /></el-icon>
          <span>日程管理</span>
        </button>

        <!-- 设置组：与桌面侧栏同构（移动端同样直达子页，无列表二级） -->
        <div class="nav-drawer__group-label">设置</div>
        <button
          v-for="item in settingItems"
          :key="item.key"
          class="nav-drawer__item"
          :class="{ active: currentView === 'settings' && settingsSection === item.key }"
          @click="goSettings(item.key)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>

        <!-- 账号区（沉底，与桌面侧栏同语义：点账号行向上弹菜单）。
             改密/登出向父组件发事件——改密弹窗须根级渲染，不能随抽屉卸载 -->
        <div class="nav-drawer__footer">
          <button v-if="!authStore.isLoggedIn" class="nav-drawer__item" @click="openLogin">
            <el-icon><Lock /></el-icon>
            <span>登录 / 注册</span>
          </button>
          <el-dropdown v-else placement="top-start" trigger="click" @command="onCommand">
            <div class="nav-drawer__user" :title="syncTitle">
              <SyncDot />
              <span>{{ displayName }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">
                  <el-icon><Lock /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </Transition>
  </template>
</template>

<script setup lang="ts">
/** 移动端导航抽屉：导航项直连 store，改密/登出向父组件发事件（AppSidebar 根级处理）。 */
import { storeToRefs } from 'pinia'
import { Calendar, List, Clock, Timer, AlarmClock, Lock, SwitchButton } from '@element-plus/icons-vue'
import { useUIStore, type AppView, type SettingsSection } from '../stores'
import { useAuthStore } from '../stores/auth'
import { useNavConfig } from '../composables/useNavConfig'
import SyncDot from './SyncDot.vue'

const emit = defineEmits<{ logout: []; password: [] }>()

const uiStore = useUIStore()
const authStore = useAuthStore()
const { currentView, isMobile, settingsSection, navDrawerOpen } = storeToRefs(uiStore)
const { switchView, openSettingsSection, setNavDrawerOpen } = uiStore

const { displayName, syncTitle, settingItems } = useNavConfig()

const openLogin = () => {
  setNavDrawerOpen(false)
  uiStore.openAuth()
}

// 抽屉导航：跳转即关抽屉
const go = (view: AppView) => {
  setNavDrawerOpen(false)
  switchView(view)
}

// 抽屉设置子项：直达并关抽屉
const goSettings = (section: SettingsSection) => {
  setNavDrawerOpen(false)
  openSettingsSection(section)
}

const onCommand = (cmd: string) => {
  setNavDrawerOpen(false)
  if (cmd === 'logout') emit('logout')
  else if (cmd === 'password') emit('password')
}
</script>

<style scoped>
.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1099; /* 高于日历伪全屏（999）与待办浮层（1001），低于 EP 弹窗 */
}

.nav-drawer {
  position: fixed;

  /* fixed 挂视口，不吃 .app-layout 的 safe-area padding，需自行让位系统栏/挖孔 */
  top: var(--safe-area-inset-top);
  bottom: var(--safe-area-inset-bottom);
  left: var(--safe-area-inset-left);
  width: 200px;
  z-index: 1100;
  background: var(--el-bg-color);
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0; /* 贴左缘：右缘圆角 + 大阴影的浮层感 */
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md) var(--space-sm);
}

.nav-drawer__logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-xs);
  margin-bottom: var(--space-sm);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: var(--font-md);
  font-weight: var(--weight-semibold);
  color: var(--el-text-color-primary);
  cursor: pointer;
}

.nav-drawer__logo .logo-text {
  font-size: var(--font-md);
}

.nav-drawer__item {
  display: flex;
  align-items: center;
  justify-content: flex-start; /* 覆盖全局 button:not(.el-button) 的居中，与桌面侧栏一致左对齐 */
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: var(--font-base);
  font-weight: var(--weight-medium); /* 覆盖全局 button 规则的 semibold，与桌面侧栏同步降档 */
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.nav-drawer__item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.nav-drawer__item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: var(--weight-medium);
}

/* 抽屉账号区（沉底，与桌面侧栏同语义） */
.nav-drawer__footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: var(--space-sm);
}

/* 抽屉设置分组标题（与桌面 nav-group-label 同语义，移动端作用域） */
.nav-drawer__group-label {
  margin-top: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-xs);
  font-weight: var(--weight-regular);
  color: var(--el-text-color-secondary);
  letter-spacing: 0.05em;
}

.nav-drawer__user {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  border-radius: var(--radius-md);
  color: var(--el-text-color-secondary);
  font-size: var(--font-base);
  cursor: pointer;
}

.nav-drawer__user:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

/* 下拉包裹层撑满：账号行整行可点击弹出菜单 */
.nav-drawer__footer :deep(.el-dropdown) {
  display: block;
  width: 100%;
}

/* 抽屉从左侧滑入/滑出（对称复用待办浮层的招牌弹性曲线，方向相反） */
.nav-slide-enter-active,
.nav-slide-leave-active {
  transition: transform var(--duration-base) var(--ease-spring), opacity var(--duration-base) ease;
}

.nav-slide-enter-from,
.nav-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
</style>
