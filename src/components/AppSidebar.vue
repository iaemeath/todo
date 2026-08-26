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
          <span class="sync-dot" :class="syncState"></span>
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

  <!-- 移动端二级页：返回条（左端汉堡开导航抽屉 + 逐级返回）；
       主页无顶条（汉堡在日历工具条，日历多得 56px） -->
  <header v-else-if="isMobile && currentView !== 'home'" class="app-navbar">
    <button class="nav-burger" @click="setNavDrawerOpen(true)" title="导航菜单">
      <el-icon><Menu /></el-icon>
    </button>
    <button class="nav-back" @click="handleBack">
      <el-icon><ArrowLeft /></el-icon>
      <span>{{ navTitle }}</span>
    </button>
  </header>

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

        <!-- 账号区（沉底，与桌面侧栏同语义：点账号行向上弹菜单） -->
        <div class="nav-drawer__footer">
          <button v-if="!authStore.isLoggedIn" class="nav-drawer__item" @click="openLogin">
            <el-icon><Lock /></el-icon>
            <span>登录 / 注册</span>
          </button>
          <el-dropdown v-else placement="top-start" trigger="click" @command="handleCommand">
            <div class="nav-drawer__user" :title="syncTitle">
              <span class="sync-dot" :class="syncState"></span>
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

  <!-- 修改密码弹窗（账号菜单入口；根级渲染避免移动端条件块吞掉；append-to-body 不受侧栏/抽屉裁剪） -->
  <el-dialog
    v-model="pwdDialogVisible"
    title="修改密码"
    :width="isMobile ? '92vw' : '420px'"
    append-to-body
  >
    <div class="pwd-dialog-form">
      <el-input v-model="pwdForm.oldPassword" type="password" placeholder="原密码" show-password />
      <el-input
        v-model="pwdForm.newPassword"
        type="password"
        placeholder="新密码（8~64 位，含字母和数字）"
        show-password
        @blur="checkPwd"
      />
      <div v-if="pwdHint" class="pwd-hint">{{ pwdHint }}</div>
      <el-input
        v-model="pwdForm.confirmPassword"
        type="password"
        placeholder="确认新密码（再输入一遍）"
        show-password
        @keyup.enter="submitPassword"
      />
    </div>
    <template #footer>
      <el-button @click="pwdDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingPwd" @click="submitPassword">修改密码</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { Calendar, List, Clock, ArrowLeft, Menu, Timer, Lock, SwitchButton, Monitor, ChatDotRound, FolderOpened, QuestionFilled, User, AlarmClock, InfoFilled } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { confirmAction } from '../utils/confirm'
import { useUIStore, type AppView, type SettingsSection } from '../stores'
import { useAuthStore } from '../stores/auth'
import { syncState } from '../services/syncManager'
import { api, ApiError } from '../services/apiClient'
import { validatePassword } from '../types/password'

const uiStore = useUIStore()
const authStore = useAuthStore()
const { currentView, isMobile, settingsSection, navDrawerOpen, navRailCollapsed } = storeToRefs(uiStore) // state → storeToRefs
const { switchView, openSettingsSection, setNavDrawerOpen, setNavRailCollapsed } = uiStore // action 直接解构

const displayName = computed(() => authStore.user?.username || authStore.user?.email || '')

// 同步状态点文案（点击进数据管理页做手动操作）
const SYNC_TEXT: Record<string, string> = {
  off: '未登录',
  idle: '待同步（自动进行）',
  syncing: '同步中…',
  synced: '已同步',
  offline: '离线，联网后自动同步',
  error: '同步失败，点击查看'
}
const syncTitle = computed(() => SYNC_TEXT[syncState.value] || syncState.value)

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

/** 修改密码弹窗：原密码 + 新密码×2（前后端共享弱口令策略） */
const pwdDialogVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const savingPwd = ref(false)
const pwdHint = ref('')

const checkPwd = () => {
  const r = validatePassword(pwdForm.newPassword, authStore.user?.email || '')
  pwdHint.value = pwdForm.newPassword && !r.ok ? r.reason : ''
}

const submitPassword = async () => {
  if (!pwdForm.oldPassword) { ElMessage.warning('请输入原密码'); return }
  const check = validatePassword(pwdForm.newPassword, authStore.user?.email || '')
  if (!check.ok) { ElMessage.warning(check.reason); return }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  if (pwdForm.newPassword === pwdForm.oldPassword) {
    ElMessage.warning('新密码不能与原密码相同')
    return
  }
  savingPwd.value = true
  try {
    const r = await api<{ token: string }>('/auth/password', {
      method: 'PUT',
      body: { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }
    })
    // 改密 bump token_ver（其他设备旧 token 即时失效）；本设备换新 token 无缝续期
    authStore.updateToken(r.token)
    ElMessage.success('密码已修改，其他设备已退出登录')
    pwdDialogVisible.value = false
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
    pwdHint.value = ''
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试')
  } finally {
    savingPwd.value = false
  }
}

// 移动端逐级返回：登录页 → 来源页；其余（任务/日程/设置子页）单级，直接回主页
const handleBack = () => {
  if (currentView.value === 'auth') {
    uiStore.closeAuth()
  } else {
    switchView('home')
  }
}

// 导航分组（「时间管理」= 主页，默认入口放首位；「屏保」是时钟的闲置展示形态，紧随其后；
// logo 只负责隐藏导航不再返回主页）
const mainItems: { key: AppView; label: string; icon: any }[] = [
  { key: 'home', label: '时间管理', icon: Timer },
  { key: 'screensaver', label: '屏保', icon: AlarmClock },
  { key: 'task', label: '任务管理', icon: List },
  { key: 'schedule', label: '日程管理', icon: Clock }
]

// 设置子项直达（桌面一级导航；移动端同样直达）；
// 用户管理仅管理员可见（features.admin 由服务端 ADMIN_USERS 邮箱白名单下发，显隐非安全边界）；
// 「关于」收尾 = 产品说明 + 三端下载分发入口（游客可达）
const settingItems = computed(() => {
  const items: { key: SettingsSection; label: string; icon: any }[] = [
    { key: 'view', label: '视觉与外观', icon: Monitor },
    { key: 'ai', label: 'AI 助理', icon: ChatDotRound },
    { key: 'data', label: '数据管理', icon: FolderOpened },
    { key: 'guide', label: '使用指南', icon: QuestionFilled }
  ]
  if (authStore.features.admin) items.push({ key: 'users', label: '用户管理', icon: User })
  items.push({ key: 'about', label: '关于', icon: InfoFilled })
  return items
})

// toggle 导航：再点一次当前页 → 回主页（点「时间管理」在主页时停留，无副作用）
const toggleView = (view: AppView) => {
  switchView(currentView.value === view ? 'home' : view)
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

// 移动端非主页返回按钮标题
const settingsTitle = computed(() => {
  const map: Record<string, string> = { view: '视觉与外观', ai: 'AI 助理', data: '数据管理', guide: '使用指南', users: '用户管理', about: '关于' }
  return map[settingsSection.value] || '设置'
})
const navTitle = computed(() => {
  if (currentView.value === 'auth') return '登录 / 注册'
  if (currentView.value === 'settings') return settingsTitle.value
  if (currentView.value === 'task') return '任务管理'
  if (currentView.value === 'schedule') return '日程管理'
  if (currentView.value === 'screensaver') return '屏保'
  return ''
})
</script>

<style scoped>
/* 修改密码弹窗表单：纵向排列 */
.pwd-dialog-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.pwd-hint {
  margin-top: calc(var(--space-xs) * -0.5);
  font-size: var(--font-xs);
  color: var(--el-color-danger);
  line-height: 1.4;
}
/* 移动优先：基础样式 = 移动端二级页返回条（横条），桌面 rail 形态在 min-width 断点增强 */
.app-navbar {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 var(--space-md) 0 var(--space-sm);
  gap: var(--space-sm);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}

/* 返回条左端汉堡（与右侧待办浮层入口同语义：拉出导航抽屉），触控目标达标 */
.nav-burger {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  font-size: 1.25rem;
  color: var(--el-text-color-regular);
}

.nav-back {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: transparent;
  border: none;
  color: var(--el-text-color-primary);
  font-size: var(--font-base);
  font-weight: var(--weight-medium);
  cursor: pointer;
  padding: var(--space-sm) 0;
  min-height: var(--touch-target);
}

.logo-icon {
  font-size: 1.3rem;
  color: var(--el-color-primary);
}

/* ===== 同步状态点（桌面侧栏/移动抽屉共用） ===== */
.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.sync-dot.syncing {
  background: var(--el-color-primary);
  animation: sync-pulse 1s ease-in-out infinite;
}

.sync-dot.synced {
  background: var(--el-color-success);
}

.sync-dot.offline {
  background: var(--el-color-warning);
}

.sync-dot.error {
  background: var(--el-color-danger);
}

@keyframes sync-pulse {
  50% {
    opacity: 0.35;
  }
}

/* ===== 桌面侧栏账号区（沉底） ===== */
.nav-footer {
  margin-top: auto; /* 侧栏 flex column 下推到底 */
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* 下拉包裹层撑满：账号行整行可点击弹出菜单 */
.nav-footer :deep(.el-dropdown),
.nav-drawer__footer :deep(.el-dropdown) {
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

/* ===== 移动端导航抽屉（fixed 挂视口，与右侧待办浮层对称的左滑交互） ===== */
.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1099; /* 高于日历伪全屏（999）与待办浮层（1001），低于 EP 弹窗 */
}

.nav-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
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
