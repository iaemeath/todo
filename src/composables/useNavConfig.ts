/**
 * 导航配置与标题映射（AppSidebar / MobileNavDrawer 共用）：
 * 主导航项、设置子项（含 admin 条件项）、账号显示名、同步状态文案、
 * 移动端返回条标题。纯派生配置，无副作用。
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  List, Clock, Timer, AlarmClock, Monitor, ChatDotRound, FolderOpened, QuestionFilled, User, InfoFilled
} from '@element-plus/icons-vue'
import { useUIStore, type AppView, type SettingsSection } from '../stores'
import { useAuthStore } from '../stores/auth'
import { syncState } from '../services/syncManager'

/** 同步状态点文案（点击进数据管理页做手动操作） */
export const SYNC_TEXT: Record<string, string> = {
  off: '未登录',
  idle: '待同步（自动进行）',
  syncing: '同步中…',
  synced: '已同步',
  offline: '离线，联网后自动同步',
  error: '同步失败，点击查看'
}

export function useNavConfig() {
  const authStore = useAuthStore()
  const uiStore = useUIStore()
  const { currentView, settingsSection } = storeToRefs(uiStore)

  const displayName = computed(() => authStore.user?.username || authStore.user?.email || '')
  const syncTitle = computed(() => SYNC_TEXT[syncState.value] || syncState.value)

  // 导航分组（「时间管理」= 主页，默认入口放首位；核心管理工作区紧随其后，
  // 「屏保」是时钟的闲置展示形态（低频）排管理组之后；logo 只负责隐藏导航不再返回主页）
  const mainItems: { key: AppView; label: string; icon: any }[] = [
    { key: 'home', label: '时间管理', icon: Timer },
    { key: 'task', label: '任务管理', icon: List },
    { key: 'schedule', label: '日程管理', icon: Clock },
    { key: 'screensaver', label: '屏保', icon: AlarmClock }
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

  return { displayName, syncTitle, mainItems, settingItems, settingsTitle, navTitle }
}
