<template>
  <div class="settings-page" :class="{ 'is-mobile': isMobile }">
    <!-- 桌面：左侧菜单栏 -->
    <el-menu v-if="!isMobile" :default-active="activeTab" class="settings-menu" @select="(i) => activeTab = i as typeof activeTab">
      <el-menu-item index="view">
        <el-icon><Monitor /></el-icon>
        <span>视觉与外观</span>
      </el-menu-item>
      <el-menu-item index="ai">
        <el-icon><ChatDotRound /></el-icon>
        <span>AI 助理配置</span>
      </el-menu-item>
      <el-menu-item index="usage">
        <el-icon><DataLine /></el-icon>
        <span>API 消耗记录</span>
      </el-menu-item>
      <el-menu-item index="data">
        <el-icon><FolderOpened /></el-icon>
        <span>数据管理</span>
      </el-menu-item>
      <el-menu-item index="guide">
        <el-icon><QuestionFilled /></el-icon>
        <span>使用指南</span>
      </el-menu-item>
    </el-menu>

    <!-- 移动端：列表入口 -->
    <div v-if="isMobile && settingsSection === 'list'" class="mobile-list">
      <div class="mobile-item" @click="enterMobile('view')">
        <el-icon><Monitor /></el-icon>
        <span>视觉与外观</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="mobile-item" @click="enterMobile('ai')">
        <el-icon><ChatDotRound /></el-icon>
        <span>AI 助理配置</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="mobile-item" @click="enterMobile('usage')">
        <el-icon><DataLine /></el-icon>
        <span>API 消耗记录</span>
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
      <AiSettingsTab v-show="currentTab === 'ai'" :form="form" :active="currentTab === 'ai'" />
      <UsageTab v-show="currentTab === 'usage'" />
      <DataManageTab v-show="currentTab === 'data'" />
      <GuideTab v-show="currentTab === 'guide'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Monitor, ChatDotRound, DataLine, ArrowRight, FolderOpened, QuestionFilled } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore, useUIStore } from '../stores'
import ViewSettingsTab from './ViewSettingsTab.vue'
import AiSettingsTab from './AiSettingsTab.vue'
import UsageTab from './UsageTab.vue'
import DataManageTab from './DataManageTab.vue'
import GuideTab from './GuideTab.vue'

const activeTab = ref<'view' | 'ai' | 'usage' | 'data' | 'guide'>('view')
const uiStore = useUIStore()
const { isMobile, settingsSection } = storeToRefs(uiStore) // state → storeToRefs
const { setSettingsSection } = uiStore // action 直接解构
// 桌面用 activeTab，移动端用 settingsSection（'list'=选项列表），content 统一读 currentTab
const currentTab = computed(() => isMobile.value
  ? (settingsSection.value === 'list' ? 'view' : settingsSection.value as 'view' | 'ai' | 'usage' | 'data' | 'guide')
  : activeTab.value)
const enterMobile = (tab: 'view' | 'ai' | 'usage' | 'data' | 'guide') => { setSettingsSection(tab) }
const settingsStore = useSettingsStore()
const { settings } = storeToRefs(settingsStore) // state → storeToRefs
const { updateSettings } = settingsStore // action 直接解构

// form 是 settings 的编辑缓冲；子组件通过 props 变异其字段，下面的 watch 即时回写
const form = ref({ ...settings.value })

// 即时预览：外观类设置改动立即回写 settings（日历/主题色等实时响应）
watch(
  () => [
    form.value.slotDuration, form.value.slotHeight,
    form.value.majorLineWidth, form.value.majorLineOpacity,
    form.value.showMinorLines, form.value.minorLineWidth, form.value.minorLineOpacity,
    form.value.startHour, form.value.endHour,
    form.value.primaryColor,
    form.value.nowIndicatorColor, form.value.nowIndicatorHeight
  ],
  () => {
    updateSettings({
      slotDuration: form.value.slotDuration, slotHeight: form.value.slotHeight,
      majorLineWidth: form.value.majorLineWidth, majorLineOpacity: form.value.majorLineOpacity,
      showMinorLines: form.value.showMinorLines, minorLineWidth: form.value.minorLineWidth,
      minorLineOpacity: form.value.minorLineOpacity,
      startHour: form.value.startHour, endHour: form.value.endHour,
      primaryColor: form.value.primaryColor,
      nowIndicatorColor: form.value.nowIndicatorColor,
      nowIndicatorHeight: form.value.nowIndicatorHeight
    })
  }
)
</script>

<style>
.settings-page {
  height: 100%;
  min-height: 0;
}
/* 桌面：左右布局（菜单 + 内容） */
.settings-page:not(.is-mobile) {
  display: flex;
}
/* 移动端：纵向流 */
.settings-page.is-mobile {
  display: flex;
  flex-direction: column;
}

/* 左侧菜单栏（桌面） */
.settings-menu {
  flex-shrink: 0;
  width: 200px;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.settings-menu:not(.el-menu--collapse) {
  width: 200px;
}

/* 内容区域（桌面 + 移动端共用） */
.settings-content {
  flex: 1;
  padding: 20px 32px;
  overflow-y: auto;
  min-width: 0;
}
.settings-page.is-mobile .settings-content {
  padding: 16px;
}

/* 移动端：列表入口 */
.mobile-list {
  display: flex;
  flex-direction: column;
}
.mobile-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-primary);
  transition: background 0.2s;
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

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-card {
  border-radius: 10px;
}

.setting-card :deep(.el-card__header) {
  padding: 12px 16px;
}

.card-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.setting-desc {
  font-size: 0.8rem;
  color: var(--el-text-color-secondary);
}

.dual-input {
  display: flex;
  align-items: center;
  gap: 12px;
}

.range-sep {
  color: var(--el-text-color-secondary);
}

.engine-radio-group {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.form-hint {
  font-size: 0.8rem;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.5;
}

.model-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.model-list-scroll {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 0 8px;
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background 0.15s ease;
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
  gap: 4px;
}

.model-name {
  font-weight: 600;
  font-size: 0.88rem;
}

.model-size {
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--el-text-color-secondary);
}

.model-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.download-progress {
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.progress-text {
  font-size: 0.72rem;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usage-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.pane-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--el-text-color-primary);
}

.pane-desc {
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.usage-stats {
  margin-bottom: 20px;
}

.usage-stats :deep(.stat-card-body) {
  padding: 16px;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.stat-value.primary {
  color: var(--el-color-primary);
}

.usage-details {
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-title {
  font-weight: 600;
  font-size: 0.82rem;
  color: var(--el-text-color-secondary);
}

.detail-text {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.json-view {
  font-family: var(--font-mono);
  background: var(--el-fill-color-light);
  padding: 8px 12px;
  border-radius: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.text-secondary {
  color: var(--el-text-color-secondary);
}

.text-primary-bold {
  font-weight: 600;
  color: var(--el-color-primary);
}
</style>
