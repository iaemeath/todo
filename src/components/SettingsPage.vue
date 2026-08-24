<template>
  <div class="settings-page" :class="{ 'is-mobile': isMobile }">
    <!-- 桌面：子页导航已上移至应用侧栏（openSettingsSection 直达），此处仅内容区 -->

    <!-- 移动端：列表入口（屏小保留二级列表模式） -->
    <div v-if="isMobile && settingsSection === 'list'" class="mobile-list">
      <div class="mobile-item" @click="enterMobile('view')">
        <el-icon><Monitor /></el-icon>
        <span>视觉与外观</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="mobile-item" @click="enterMobile('ai')">
        <el-icon><ChatDotRound /></el-icon>
        <span>AI 助理</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="mobile-item" @click="enterMobile('data')">
        <el-icon><FolderOpened /></el-icon>
        <span>数据管理</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="mobile-item" @click="enterMobile('guide')">
        <el-icon><QuestionFilled /></el-icon>
        <span>使用指南</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
    </div>

    <!-- 内容区域（桌面 + 移动端共用） -->
    <div class="settings-content" v-show="!isMobile || settingsSection !== 'list'">
      <ViewSettingsTab v-show="currentTab === 'view'" :form="form" />
      <!-- AI 助理页 = 配置 + API 消耗记录 两块纵向合并 -->
      <div v-show="currentTab === 'ai'" class="ai-combined">
        <AiSettingsTab :form="form" :active="currentTab === 'ai'" />
        <UsageTab />
      </div>
      <DataManageTab v-show="currentTab === 'data'" />
      <GuideTab v-show="currentTab === 'guide'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, ChatDotRound, ArrowRight, FolderOpened, QuestionFilled } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore, useUIStore } from '../stores'
import ViewSettingsTab from './ViewSettingsTab.vue'
import AiSettingsTab from './AiSettingsTab.vue'
import UsageTab from './UsageTab.vue'
import DataManageTab from './DataManageTab.vue'
import GuideTab from './GuideTab.vue'

const uiStore = useUIStore()
const { isMobile, settingsSection } = storeToRefs(uiStore) // state → storeToRefs
const { setSettingsSection } = uiStore // action 直接解构
// 子页统一由 settingsSection 驱动：桌面侧栏直达必带具体 section；
// 若经 switchView('settings') 进入（section 复位为 list，仅移动端列表路径），
// 桌面兜底显示视觉与外观。移动端 list 时内容区隐藏（模板 v-show）。
const currentTab = computed(() => {
  const s = settingsSection.value
  return s === 'list' ? 'view' : s
})
const enterMobile = (tab: 'view' | 'ai' | 'data' | 'guide') => { setSettingsSection(tab) }
const settingsStore = useSettingsStore()
// form 直接引用 store 的 settings（子 tab 通过 props 变异其字段，即时生效并持久化）。
// 不再用挂载时快照：数据导入等外部更新必须实时反映，否则旧值会在下次调节时被回写覆盖。
const { settings: form } = storeToRefs(settingsStore)
</script>

<style>
.settings-page {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

/* 移动端 content-area 零内边距（日历贴屏惯例），页面自补；
   web 端不补——由 content-area 的浮岛 padding 统一提供（避免双重） */
html.platform-mobile .settings-page {
  padding: var(--space-md) var(--space-lg);
}

/* 桌面：单列内容区（子页导航在应用侧栏） */
.settings-page:not(.is-mobile) {
  display: flex;
}

/* 移动端：纵向流 */
.settings-page.is-mobile {
  display: flex;
  flex-direction: column;
}

/* 内容区域（桌面 + 移动端共用） */
.settings-content {
  flex: 1;
  padding: var(--space-lg); /* 桌面 16 / 移动 12（令牌双值） */
  overflow-y: auto;
  min-width: 0;
}

/* 移动端：列表入口 */
.mobile-list {
  display: flex;
  flex-direction: column;
}

.mobile-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: var(--font-base);
  color: var(--el-text-color-primary);
  transition: background var(--duration-fast);
}

.mobile-item:hover {
  background: var(--el-fill-color-light);
}

.mobile-item .arrow {
  margin-left: auto;
  color: var(--el-text-color-secondary);
}

/* 控件宽度约束：slider / select / input 不要全宽 */
.control-width {
  width: 100%;
  max-width: 400px;
}

/* AI 助理页：配置 + API 消耗记录 纵向合并的容器间距 */
.ai-combined {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.setting-card {
  border-radius: var(--radius-md);
}

.setting-card :deep(.el-card__header) {
  padding: var(--space-md) var(--space-lg);
}

.card-title {
  font-weight: var(--weight-semibold);
  font-size: var(--font-base);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 亚刻度微间距特例 */
}

.setting-name {
  font-weight: var(--weight-medium);
  font-size: var(--font-sm);
}

.setting-desc {
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
}

.dual-input {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.range-sep {
  color: var(--el-text-color-secondary);
}

.engine-radio-group {
  display: flex;
  flex-direction: row;
  gap: var(--space-md);
}

.form-hint {
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.5;
}

.model-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: 12px;
}

.model-list-scroll {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  padding: 0 var(--space-sm);
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-sm);
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background var(--duration-fast) ease;
}

.model-item:last-child {
  border-bottom: none;
}

.model-item:hover {
  background: var(--el-fill-color-light);
}

.model-item.is-active {
  background: var(--el-color-primary-light-9);
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.model-name {
  font-weight: var(--weight-semibold);
  font-size: var(--font-sm);
}

.model-size {
  font-weight: var(--weight-regular);
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
}

.model-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.download-progress {
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 2px; /* stylelint-disable-line declaration-property-value-disallowed-list -- 亚刻度微间距特例 */
}

.progress-text {
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usage-stats {
  margin-bottom: var(--space-xl);
}

.usage-stats :deep(.stat-card-body) {
  padding: var(--space-lg);
}

.stat-label {
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: var(--weight-bold);
  color: var(--el-text-color-primary);
}

.stat-value.primary {
  color: var(--el-color-primary);
}

.usage-details {
  padding: var(--space-sm) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.detail-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.detail-title {
  font-weight: var(--weight-semibold);
  font-size: var(--font-sm);
  color: var(--el-text-color-secondary);
}

.detail-text {
  font-size: var(--font-sm);
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.json-view {
  font-family: var(--font-mono);
  background: var(--el-fill-color-light);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  max-height: 160px;
  overflow-y: auto;
}

.text-secondary {
  color: var(--el-text-color-secondary);
}

.text-primary-bold {
  font-weight: var(--weight-semibold);
  color: var(--el-color-primary);
}
</style>
