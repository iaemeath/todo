<template>
  <!-- 桌面：左侧标准侧边栏 240px（logo 顶部 + 导航纵向列表）常驻——主页与管理/设置页
       共用同一布局（左导航 + 右内容区）。logo 点击隐藏侧栏（恢复走工具条左端开关，
       ui store navRailCollapsed 持久化）；「时间管理」是主页入口 -->
  <header v-if="!isMobile && !navRailCollapsed" class="app-navbar app-navbar--side">
    <div class="nav-logo" @click="setNavRailCollapsed(true)" title="隐藏导航栏">
      <el-icon class="logo-icon"><Calendar /></el-icon>
      <span class="logo-text">拾光</span>
    </div>
    <nav class="nav-tabs">
      <button
        v-for="item in mainItems"
        :key="item.key"
        class="nav-tab"
        :class="{ active: currentView === item.key }"
        :title="currentView === item.key && item.key !== 'home' ? `${item.label}（再点一次返回主页）` : item.label"
        @click="toggleView(item.key)"
      >
        <el-icon class="tab-icon"><component :is="item.icon" /></el-icon>
        <span class="tab-label">{{ item.label }}</span>
      </button>

      <!-- 设置组：原设置页二级菜单提升为一级（EP 文档站式分组扁平导航） -->
      <div class="nav-group-label">设置</div>
      <button
        v-for="item in settingItems"
        :key="item.key"
        class="nav-tab"
        :class="{ active: currentView === 'settings' && settingsSection === item.key }"
        @click="openSettingsSection(item.key)"
      >
        <el-icon class="tab-icon"><component :is="item.icon" /></el-icon>
        <span class="tab-label">{{ item.label }}</span>
      </button>
    </nav>

    <!-- 账号区（沉底）：游客显示登录入口；登录后点击账号行向上弹菜单（改密/退出） -->
    <div class="nav-footer">
      <button v-if="!authStore.isLoggedIn" class="nav-tab" title="登录开启多设备云同步" @click="openLogin">
        <el-icon class="tab-icon"><Lock /></el-icon>
        <span class="tab-label">登录</span>
      </button>
      <el-dropdown v-else placement="top-start" trigger="click" @command="handleCommand">
        <div class="nav-user" :title="syncTitle">
          <SyncDot />
          <span class="tab-label nav-user-name">{{ displayName }}</span>
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
  </header>

  <!-- 移动端二级页：统一顶条 MobileAppBar（左端汉堡开导航抽屉 + 居中页面标题，
       中/右插槽预留后续设计）；主页不渲染此条——同一 MobileAppBar 由
       CalendarToolbar 渲染（中=时间选择器，右=月/待办开关），日历不多占一行 -->
  <MobileAppBar v-else-if="isMobile && currentView !== 'home'" :title="navTitle" />

  <!-- 桌面侧栏收起 + 非主页：悬浮展开钮（修复困死陷阱——收起入口在全局侧栏 logo，
       而原恢复入口只在主页工具条，非主页收起后无路可回；主页仍用工具条开关不重复放） -->
  <button
    v-else-if="!isMobile && currentView !== 'home'"
    class="nav-restore-fab"
    title="展开导航栏"
    @click="setNavRailCollapsed(false)"
  >
    <el-icon><Expand /></el-icon>
  </button>

  <!-- 移动端导航抽屉（backdrop/滑入动画/账号区在组件内；改密/登出事件回传根级处理） -->
  <MobileNavDrawer v-if="isMobile" @logout="handleLogout" @password="pwdDialogVisible = true" />

  <!-- 修改密码弹窗（账号菜单入口；根级渲染避免移动端条件块吞掉；append-to-body 不受侧栏/抽屉裁剪） -->
  <ChangePasswordDialog v-model:visible="pwdDialogVisible" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Calendar, Expand, Lock, SwitchButton } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { confirmAction } from '../utils/confirm'
import { useUIStore, type AppView } from '../stores'
import { useAuthStore } from '../stores/auth'
import { useNavConfig } from '../composables/useNavConfig'
import ChangePasswordDialog from './ChangePasswordDialog.vue'
import MobileAppBar from './MobileAppBar.vue'
import MobileNavDrawer from './MobileNavDrawer.vue'
import SyncDot from './SyncDot.vue'

const uiStore = useUIStore()
const authStore = useAuthStore()
const { currentView, isMobile, settingsSection, navRailCollapsed } = storeToRefs(uiStore) // state → storeToRefs
const { switchView, openSettingsSection, setNavDrawerOpen, setNavRailCollapsed } = uiStore // action 直接解构

const { displayName, syncTitle, mainItems, settingItems, navTitle } = useNavConfig()

const pwdDialogVisible = ref(false)

const openLogin = () => {
  setNavDrawerOpen(false)
  uiStore.openAuth()
}

// 登出即清本机数据（账号隔离）：确认弹窗给出导出提示，防误退出丢本机未同步数据
const handleLogout = async () => {
  await confirmAction({
    message: '退出将清除本机的任务、日程与用量数据（云端数据不受影响，重新登录后会从云端恢复）。如需保留本机未同步的数据，请先到「设置 · 数据管理」导出备份。',
    title: '退出登录',
    confirmText: '退出并清除',
    action: () => {
      authStore.logout()
      setNavDrawerOpen(false)
    },
    success: '已退出登录，本机数据已清除'
  })
}

// ===== 账号菜单：改密码（弹窗）/ 退出 =====

const handleCommand = (cmd: string) => {
  setNavDrawerOpen(false)
  if (cmd === 'logout') return handleLogout()
  if (cmd === 'password') {
    pwdDialogVisible.value = true
  }
}

// toggle 导航：再点一次当前页 → 回主页（点「时间管理」在主页时停留，无副作用）
const toggleView = (view: AppView) => {
  switchView(currentView.value === view ? 'home' : view)
}
</script>

<style scoped>
/* 侧栏基座（本类现仅桌面 rail 形态使用——移动端二级页顶条已由统一 MobileAppBar 承担，
   横条形态样式随之移除；此处只保留桌面块未覆盖的公共属性） */
.app-navbar {
  display: flex;
  flex-shrink: 0;
  background: var(--el-bg-color);
}

/* 桌面侧栏收起后的悬浮展开钮（非主页；fixed 不吃 .app-layout 的 safe-area
   padding 需自行让位）。层级低于伪全屏/抽屉/EP 弹窗，高于页面内容 */
.nav-restore-fab {
  position: fixed;
  top: calc(var(--safe-area-inset-top) + var(--space-md));
  left: calc(var(--safe-area-inset-left) + var(--space-md));
  z-index: calc(var(--z-fake-fullscreen) - 100);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-md);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 1.1rem;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) ease;
}

.nav-restore-fab:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}

.logo-icon {
  font-size: var(--font-lg);
  color: var(--el-color-primary);
}

/* ===== 桌面侧栏账号区（沉底） ===== */
.nav-footer {
  margin-top: auto; /* 侧栏 flex column 下推到底 */
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* 下拉包裹层撑满：账号行整行可点击弹出菜单 */
.nav-footer :deep(.el-dropdown) {
  display: block;
  width: 100%;
}

.nav-user {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-md);
  color: var(--el-text-color-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.nav-user:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.nav-user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 桌面侧边栏：240px 标准宽度，logo 顶部 + 导航纵向列表（图标+全名横排）。
   与移动端抽屉同为 AppSidebar 双形态（对称于右侧待办：web 常驻侧栏/移动浮层同组件），
   日历换得 +56px 垂直空间 ===== */
@media (width >= 769px) {
  .app-navbar--side {
    flex-direction: column;
    align-items: stretch;
    width: 240px;
    height: auto; /* app-layout row 下由 stretch 撑满整列 */
    padding: var(--space-md);
    gap: var(--space-lg);
    border-bottom: none;
    border-right: 1px solid var(--el-border-color-light);
  }

  .nav-logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
    cursor: pointer;
    font-weight: var(--weight-medium); /* 品牌位保留层次但降一档（bold 经两轮降至 medium） */
    color: var(--el-text-color-primary);
    padding: var(--space-xs) var(--space-sm);
    transition: color var(--duration-fast) ease;
  }

  .nav-logo:hover {
    color: var(--el-color-primary);
  }

  .logo-text {
    font-size: var(--font-md);
  }

  .nav-tabs {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 0;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--el-text-color-regular);
    font-size: var(--font-sm);
    font-weight: var(--weight-medium); /* 覆盖全局 button 规则的 semibold，整体降一档 */
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
    font-weight: var(--weight-regular); /* EP menu 风格：主色标识即可，不加粗 */
  }

  /* 设置分组标题（EP el-menu-group 式小灰字） */
  .nav-group-label {
    margin-top: var(--space-md);
    padding: 0 var(--space-md);
    font-size: var(--font-xs);
    font-weight: var(--weight-regular);
    color: var(--el-text-color-secondary);
    letter-spacing: 0.05em;
  }

  .tab-icon {
    font-size: 1rem;
  }
}
</style>
