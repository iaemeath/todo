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
    </div>

    <!-- 内容区域（桌面 + 移动端共用） -->
    <div class="settings-content" v-show="!isMobile || settingsSection !== 'list'">

      <!-- ========== 视觉与外观 ========== -->
      <div v-show="currentTab === 'view'">
          <el-form label-position="top" class="settings-form">
            <!-- 界面主题 -->
            <el-card shadow="never" class="setting-card">
              <template #header><span class="card-title">界面主题</span></template>
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-name">暗黑模式</span>
                  <span class="setting-desc">切换深色 / 浅色主题</span>
                </div>
                <el-switch
                  :model-value="isDark"
                  @change="toggleTheme"
                  :active-icon="Moon"
                  :inactive-icon="Sunny"
                  size="large"
                />
              </div>
            </el-card>

            <!-- 主题色 -->
            <el-card shadow="never" class="setting-card">
              <template #header><span class="card-title">主题色</span></template>
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-name">主题色</span>
                  <span class="setting-desc">自定义应用主色调（按钮 / 高亮 / 菜单等）</span>
                </div>
                <el-color-picker v-model="form.primaryColor" />
              </div>
            </el-card>

            <!-- 日历画布与密度 -->
            <el-card shadow="never" class="setting-card">
              <template #header><span class="card-title">日历画布与密度</span></template>
              <el-form-item label="时间范围（小时）">
                <div class="dual-input">
                  <el-input-number v-model="form.startHour" :min="0" :max="23" controls-position="right" />
                  <span class="range-sep">~</span>
                  <el-input-number v-model="form.endHour" :min="1" :max="24" controls-position="right" />
                </div>
              </el-form-item>
              <el-form-item label="时行数（一个小时划分为几行）">
                <el-select v-model="form.slotDuration" class="control-width">
                  <el-option label="1 行 / 小时 (每行 60 分钟)" value="01:00:00" />
                  <el-option label="2 行 / 小时 (每行 30 分钟)" value="00:30:00" />
                  <el-option label="3 行 / 小时 (每行 20 分钟)" value="00:20:00" />
                  <el-option label="4 行 / 小时 (每行 15 分钟)" value="00:15:00" />
                  <el-option label="6 行 / 小时 (每行 10 分钟)" value="00:10:00" />
                </el-select>
              </el-form-item>
              <el-form-item :label="`行高度（单格高度）: ${form.slotHeight}px`">
                <el-slider v-model="form.slotHeight" :min="20" :max="120" :step="2" class="control-width" />
              </el-form-item>
            </el-card>

            <!-- 整点网格控制 -->
            <el-card shadow="never" class="setting-card">
              <template #header><span class="card-title">网格控制（整点）</span></template>
              <el-form-item :label="`整点分割线粗细: ${form.majorLineWidth}px`">
                <el-slider v-model="form.majorLineWidth" :min="0.5" :max="4" :step="0.5" class="control-width" />
              </el-form-item>
              <el-form-item :label="`整点分割线颜色深度: ${Math.round(form.majorLineOpacity * 100)}%`">
                <el-slider v-model="form.majorLineOpacity" :min="0.05" :max="1" :step="0.05" class="control-width" />
              </el-form-item>
            </el-card>

            <!-- 辅助网格控制 -->
            <el-card shadow="never" class="setting-card">
              <template #header><span class="card-title">辅助网格控制（非整点）</span></template>
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-name">显示非整点辅助细线</span>
                  <span class="setting-desc">关闭后网格将呈现极简的纯小时块</span>
                </div>
                <el-switch v-model="form.showMinorLines" />
              </div>
              <template v-if="form.showMinorLines">
                <el-divider />
                <el-form-item :label="`辅助细线粗细: ${form.minorLineWidth}px`">
                  <el-slider v-model="form.minorLineWidth" :min="0.5" :max="3" :step="0.5" class="control-width" />
                </el-form-item>
                <el-form-item :label="`辅助细线颜色深度: ${Math.round(form.minorLineOpacity * 100)}%`">
                  <el-slider v-model="form.minorLineOpacity" :min="0.05" :max="1" :step="0.05" class="control-width" />
                </el-form-item>
              </template>
            </el-card>

            <!-- 当前时刻指示线 -->
            <el-card shadow="never" class="setting-card">
              <template #header><span class="card-title">当前时刻指示线</span></template>
              <el-form-item label="线条颜色">
                <el-color-picker v-model="form.nowIndicatorColor" show-alpha color-format="rgb" />
              </el-form-item>
              <el-form-item :label="`线条粗细: ${form.nowIndicatorHeight}px`">
                <el-slider v-model="form.nowIndicatorHeight" :min="1" :max="6" :step="0.5" class="control-width" />
              </el-form-item>
            </el-card>
          </el-form>
        </div>

        <!-- ========== AI 助理配置 ========== -->
        <div v-show="currentTab === 'ai'">
          <el-form label-position="top" class="settings-form">
            <!-- 引擎模式 -->
            <el-card shadow="never" class="setting-card">
              <template #header><span class="card-title">引擎模式选择</span></template>
              <el-radio-group v-model="form.aiMode" class="engine-radio-group">
                <el-radio value="cloud" size="large">云端 API（速度快，兼容全平台）</el-radio>
                <el-radio value="local" size="large">本地 WebLLM（断网可用，仅限高配电脑）</el-radio>
              </el-radio-group>
            </el-card>

            <!-- 本地模型库 -->
            <el-card v-if="form.aiMode === 'local'" shadow="never" class="setting-card">
              <template #header><span class="card-title">本地模型资源库</span></template>
              <div class="model-toolbar">
                <el-input
                  v-model="searchQuery"
                  :prefix-icon="Search"
                  placeholder="搜索模型 (例如 qwen, llama...)"
                  clearable
                  style="flex: 1;"
                />
                <el-checkbox v-model="showOnlyDownloaded">只看已缓存</el-checkbox>
              </div>
              <el-scrollbar height="360px" class="model-list-scroll">
                <div
                  v-for="model in filteredModels"
                  :key="model.model_id"
                  class="model-item"
                  :class="{ 'is-active': form.localModelName === model.model_id }"
                >
                  <div class="model-info">
                    <span class="model-name">
                      {{ model.model_id }}
                      <span v-if="model.vram_required_MB" class="model-size">
                        (~{{ (model.vram_required_MB / 1024).toFixed(1) }} GB)
                      </span>
                    </span>
                    <el-tag v-if="downloadedModels[model.model_id]" type="success" size="small" :icon="CircleCheckFilled">
                      已缓存
                    </el-tag>
                  </div>
                  <div class="model-actions">
                    <el-button
                      v-if="downloadedModels[model.model_id] && !downloadingModels[model.model_id]"
                      type="danger"
                      text
                      :icon="Delete"
                      @click="deleteModelCache(model.model_id)"
                    >
                      释放空间
                    </el-button>

                    <div v-if="downloadingModels[model.model_id]" class="download-progress">
                      <el-progress
                        :percentage="Math.round(downloadingModels[model.model_id].progress * 100)"
                        :stroke-width="14"
                        striped
                        striped-flow
                      />
                      <span class="progress-text">{{ downloadingModels[model.model_id].text }}</span>
                    </div>

                    <el-button
                      v-else-if="!downloadedModels[model.model_id]"
                      type="primary"
                      plain
                      :icon="Download"
                      @click="startDownload(model.model_id)"
                    >
                      下载缓存
                    </el-button>

                    <el-button
                      v-else-if="form.localModelName === model.model_id"
                      type="success"
                      disabled
                    >
                      当前默认
                    </el-button>

                    <el-button
                      v-else
                      type="primary"
                      plain
                      @click="selectModel(model.model_id)"
                    >
                      设为默认
                    </el-button>
                  </div>
                </div>
                <el-empty v-if="filteredModels.length === 0" description="没有找到匹配的模型" />
              </el-scrollbar>
            </el-card>

            <!-- 云端 API 配置 -->
            <el-card v-if="form.aiMode === 'cloud'" shadow="never" class="setting-card">
              <template #header><span class="card-title">API 核心参数（云端模式）</span></template>
              <el-form label-position="top">
                <el-form-item label="API Base URL">
                  <el-input v-model="form.apiBaseUrl" placeholder="例如: https://api.deepseek.com/v1" class="control-width" />
                </el-form-item>
                <el-form-item label="模型名称 (Model)">
                  <el-input v-model="form.modelName" placeholder="例如: deepseek-chat 或 gpt-4o-mini" class="control-width" />
                </el-form-item>
                <el-form-item label="API Key">
                  <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." class="control-width" />
                  <div class="form-hint">安全提示：您的 API 密钥仅保存在本地浏览器中，绝不会被上传至任何其他服务器。</div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="save">保存 API 配置</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-form>
        </div>

        <!-- ========== API 消耗记录 ========== -->
        <div v-show="currentTab === 'usage'">
          <div class="usage-header">
            <div>
              <h3 class="pane-title">API 消耗记录</h3>
              <p class="pane-desc">追踪云端大模型的 Token 消耗量。</p>
            </div>
            <el-button type="danger" plain :icon="Delete" @click="handleClearHistory">清空记录</el-button>
          </div>

          <el-row :gutter="16" class="usage-stats">
            <el-col :span="12">
              <el-card shadow="hover" body-class="stat-card-body">
                <div class="stat-label">总计 Token 消耗</div>
                <div class="stat-value primary">{{ totalTokensAllTime.toLocaleString() }}</div>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="hover" body-class="stat-card-body">
                <div class="stat-label">请求总次数</div>
                <div class="stat-value">{{ usageHistory.length }}</div>
              </el-card>
            </el-col>
          </el-row>

          <el-table :data="usageHistory" stripe style="width: 100%;" empty-text="暂无消耗记录">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="usage-details">
                  <div class="detail-block">
                    <div class="detail-title">🗣️ 语音指令 (User)</div>
                    <div class="detail-text">{{ row.requestContent || '无' }}</div>
                  </div>
                  <div class="detail-block">
                    <div class="detail-title">📝 原始报文 (Raw Prompt)</div>
                    <pre class="detail-text json-view">{{ row.rawPrompt || '无' }}</pre>
                  </div>
                  <div class="detail-block">
                    <div class="detail-title">🤖 AI 解析结果 (Assistant)</div>
                    <pre class="detail-text json-view">{{ row.responseContent || '无' }}</pre>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="调用时间" width="130">
              <template #default="{ row }">{{ formatDate(row.date) }}</template>
            </el-table-column>
            <el-table-column prop="model" label="模型名称" min-width="160" />
            <el-table-column label="Prompt / Completion" min-width="160">
              <template #default="{ row }">
                <span class="text-secondary">{{ row.promptTokens }} / {{ row.completionTokens }}</span>
              </template>
            </el-table-column>
            <el-table-column label="总 Tokens" width="120">
              <template #default="{ row }">
                <span class="text-primary-bold">{{ row.totalTokens }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { Monitor, ChatDotRound, DataLine, Delete, Search, Download, CircleCheckFilled, Moon, Sunny, ArrowRight } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { prebuiltAppConfig, hasModelInCache, deleteModelAllInfoInCache, CreateMLCEngine } from '@mlc-ai/web-llm'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'
import { useUsage } from '../composables/useUsage'
import { useUI } from '../composables/useUI'

const activeTab = ref<'view' | 'ai' | 'usage'>('view')
const { isMobile, settingsSection, setSettingsSection } = useUI()
// 桌面用 activeTab，移动端用 settingsSection（'list'=选项列表），content 统一读 currentTab
const currentTab = computed(() => isMobile.value
  ? (settingsSection.value === 'list' ? 'view' : settingsSection.value as 'view' | 'ai' | 'usage')
  : activeTab.value)
const enterMobile = (tab: 'view' | 'ai' | 'usage') => { setSettingsSection(tab) }
const { settings, updateSettings } = useSettings()
const { isDark, toggleTheme } = useTheme()
const { usageHistory, clearHistory } = useUsage()

const totalTokensAllTime = computed(() => {
  return usageHistory.value.reduce((acc, curr) => acc + curr.totalTokens, 0)
})

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const form = ref({ ...settings.value })

// --- WebLLM Model Manager Logic ---
const searchQuery = ref('')
const showOnlyDownloaded = ref(false)
const downloadedModels = ref<Record<string, boolean>>({})
const allModels = prebuiltAppConfig.model_list

const filteredModels = computed(() => {
  let list = allModels
  if (showOnlyDownloaded.value) {
    list = list.filter(m => downloadedModels.value[m.model_id])
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(m => m.model_id.toLowerCase().includes(q))
  }
  return list.slice().sort((a, b) => {
    const aD = downloadedModels.value[a.model_id] ? 1 : 0
    const bD = downloadedModels.value[b.model_id] ? 1 : 0
    if (aD !== bD) return bD - aD
    const aS = form.value.localModelName === a.model_id ? 1 : 0
    const bS = form.value.localModelName === b.model_id ? 1 : 0
    return bS - aS
  }).slice(0, 50)
})

const checkCaches = async () => {
  for (const model of allModels) {
    hasModelInCache(model.model_id).then(has => {
      if (has) downloadedModels.value[model.model_id] = true
    }).catch(() => {})
  }
}

watch(currentTab, (newVal) => {
  if (newVal === 'ai') checkCaches()
})

onMounted(() => {
  if (currentTab.value === 'ai') checkCaches()
})

const deleteModelCache = async (modelId: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要从浏览器存储中彻底删除模型 [${modelId}] 的文件缓存吗？这可以释放大量磁盘空间。`,
      '删除模型缓存',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await deleteModelAllInfoInCache(modelId)
    downloadedModels.value[modelId] = false
    ElMessage.success('模型缓存已删除')
  } catch (action) {
    if (action !== 'cancel' && action !== 'close') {
      console.error(action)
      ElMessage.error('删除失败，可能没有权限或被占用')
    }
  }
}

const selectModel = (modelId: string) => {
  form.value.localModelName = modelId
  updateSettings({ localModelName: modelId })
}

const downloadingModels = ref<Record<string, { progress: number, text: string }>>({})

const startDownload = async (modelId: string) => {
  if (downloadingModels.value[modelId]) return
  downloadingModels.value[modelId] = { progress: 0, text: 'Preparing...' }
  try {
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        downloadingModels.value[modelId] = { progress: report.progress, text: report.text }
      }
    })
    await engine.unload()
    downloadedModels.value[modelId] = true
    ElMessage.success(`模型 ${modelId} 下载完成`)
  } catch (e: any) {
    console.error('Failed to download model', e)
    ElMessage.error(`下载模型失败: ${e.message}`)
  } finally {
    delete downloadingModels.value[modelId]
  }
}

// Instant preview for UI settings
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

const handleClearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有 API 消耗记录吗？此操作不可撤销。', '清空记录', {
      type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消'
    })
    clearHistory()
    ElMessage.success('消耗记录已清空')
  } catch {
    // cancelled
  }
}

const save = () => {
  updateSettings({ ...form.value })
  ElMessage.success('已保存')
}
</script>

<style scoped>
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
