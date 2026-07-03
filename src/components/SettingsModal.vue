<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-content flat-panel" ref="modalContentRef" :class="{ 'is-mobile': isMobile }">
          
          <button class="btn-close" :class="{ 'is-mobile': isMobile }" @click="close">
            <X class="icon-sm" />
          </button>

          <div class="layout-split" :class="{ 'is-mobile': isMobile }">
            <!-- Sidebar -->
            <aside class="settings-sidebar" :class="{ 'is-mobile': isMobile }" :style="isMobile ? {} : { width: sidebarWidth + 'px' }">
              <h2 class="sidebar-title" :class="{ 'is-mobile': isMobile }">
                <SettingsIcon class="icon-sm" />
                全局设置
              </h2>
              <nav class="settings-nav" :class="{ 'is-mobile': isMobile }">
                <button 
                  :class="['nav-item', { active: activeTab === 'view', 'is-mobile': isMobile }]"
                  @click="activeTab = 'view'"
                >
                  <Monitor class="icon-sm" />
                  视觉与外观
                </button>
                <button 
                  :class="['nav-item', { active: activeTab === 'ai', 'is-mobile': isMobile }]"
                  @click="activeTab = 'ai'"
                >
                  <Bot class="icon-sm" />
                  AI 助理配置
                </button>
                <button 
                  :class="['nav-item', { active: activeTab === 'usage', 'is-mobile': isMobile }]"
                  @click="activeTab = 'usage'"
                >
                  <Activity class="icon-sm" />
                  API 消耗记录
                </button>
              </nav>
            </aside>
            
            <!-- Resizer -->
            <div v-if="!isMobile" class="resize-handle" :class="{ 'is-resizing': isResizing }" @mousedown.prevent="startResize"></div>

            <!-- Main Content -->
            <main class="settings-body" :class="{ 'is-mobile': isMobile }">
              <!-- View Settings Tab -->
            <div v-if="activeTab === 'view'" class="tab-pane">
              <div class="pane-header">
                <h3 class="pane-title">视觉与外观</h3>
                <p class="pane-desc">定制专属的日历工作区界面。所有的修改即刻生效，无需保存。</p>
              </div>
              
              <section class="setting-section">
                <h4 class="section-title">界面主题</h4>
                <div class="setting-card form-layout">
                  <div class="form-group theme-group">
                    <div class="setting-item">
                      <div class="setting-info">
                        <label>暗黑模式</label>
                        <span class="setting-desc">切换深色/浅色主题</span>
                      </div>
                      <button class="theme-toggle-btn" @click="toggleTheme" :title="isDark ? '切换到浅色模式' : '切换到深色模式'">
                        <Moon v-if="!isDark" class="icon-sm" />
                        <Sun v-else class="icon-sm text-amber" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section class="setting-section">
                <h4 class="section-title">日历画布与密度</h4>
                <div class="setting-card form-layout">
                  <div class="form-group flex-row" style="gap: 16px;">
                    <div style="flex: 1;">
                      <label>起始时间 (时)</label>
                      <input type="number" v-model.number="form.startHour" min="0" max="23" class="glass-input" style="margin-top: 8px;" />
                    </div>
                    <div style="flex: 1;">
                      <label>结束时间 (时)</label>
                      <input type="number" v-model.number="form.endHour" min="1" max="24" class="glass-input" style="margin-top: 8px;" />
                    </div>
                  </div>

                  <div class="form-group">
                    <label>时行数 (一个小时划分为几行)</label>
                    <select v-model="form.slotDuration" class="glass-input">
                      <option value="01:00:00">1 行 / 小时 (每行 60 分钟)</option>
                      <option value="00:30:00">2 行 / 小时 (每行 30 分钟)</option>
                      <option value="00:20:00">3 行 / 小时 (每行 20 分钟)</option>
                      <option value="00:15:00">4 行 / 小时 (每行 15 分钟)</option>
                      <option value="00:10:00">6 行 / 小时 (每行 10 分钟)</option>
                    </select>
                  </div>

                  <div class="form-group slider-group">
                    <label>行高度 (单个单元格高度): {{ form.slotHeight }}px</label>
                    <input 
                      type="range" 
                      v-model.number="form.slotHeight" 
                      min="20" max="120" step="2" 
                      class="glass-slider"
                    />
                  </div>
                </div>
              </section>

              <section class="setting-section">
                <h4 class="section-title">网格控制 (整点)</h4>
                <div class="setting-card form-layout">
                  <div class="form-group slider-group" style="margin-top:0;">
                    <label>整点分割线粗细: {{ form.majorLineWidth }}px</label>
                    <input 
                      type="range" 
                      v-model.number="form.majorLineWidth" 
                      min="0.5" max="4" step="0.5" 
                      class="glass-slider"
                    />
                  </div>
                  <div class="form-group slider-group">
                    <label>整点分割线颜色深度: {{ Math.round(form.majorLineOpacity * 100) }}%</label>
                    <input 
                      type="range" 
                      v-model.number="form.majorLineOpacity" 
                      min="0.05" max="1" step="0.05" 
                      class="glass-slider"
                    />
                  </div>
                </div>
              </section>

              <section class="setting-section">
                <h4 class="section-title">辅助网格控制 (非整点)</h4>
                <div class="setting-card form-layout">
                  <div class="form-group flex-row">
                    <div class="label-desc">
                      <label>显示非整点辅助细线</label>
                      <span class="hint-text" style="margin-top:4px;">关闭后网格将呈现极简的纯小时块</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" v-model="form.showMinorLines" />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div v-if="form.showMinorLines" class="form-group slider-group sub-group">
                    <label>辅助细线粗细: {{ form.minorLineWidth }}px</label>
                    <input 
                      type="range" 
                      v-model.number="form.minorLineWidth" 
                      min="0.5" max="3" step="0.5" 
                      class="glass-slider"
                    />
                  </div>

                  <div v-if="form.showMinorLines" class="form-group slider-group sub-group">
                    <label>辅助细线颜色深度: {{ Math.round(form.minorLineOpacity * 100) }}%</label>
                    <input 
                      type="range" 
                      v-model.number="form.minorLineOpacity" 
                      min="0.05" max="1" step="0.05" 
                      class="glass-slider"
                    />
                  </div>
                </div>
              </section>
            </div>

            <!-- AI Settings Tab -->
            <div v-if="activeTab === 'ai'" class="tab-pane">
              <div class="pane-header">
                <h3 class="pane-title">AI 助理配置</h3>
                <p class="pane-desc">配置用来解析语音指令的大模型。支持云端极速 API 或 100% 本地离线引擎。</p>
              </div>

              <section class="setting-section">
                <h4 class="section-title">引擎模式选择</h4>
                <div class="setting-card form-layout">
                  <div class="form-group flex-row">
                    <label style="display:flex; align-items:center; gap:8px;">
                      <input type="radio" v-model="form.aiMode" value="cloud" />
                      云端 API (速度快，兼容全平台)
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; margin-left: 16px;">
                      <input type="radio" v-model="form.aiMode" value="local" />
                      本地 WebLLM (断网可用，仅限高配电脑)
                    </label>
                  </div>
                  
                  <div v-if="form.aiMode === 'local'" class="form-group" style="margin-top: 16px;">
                    <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                      本地模型资源库
                    </label>
                    <div class="model-manager-container">
                      <div class="search-box" style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                        <Search class="icon-sm" style="color:var(--text-secondary);" />
                        <input v-model="searchQuery" class="glass-input" style="flex:1;" placeholder="搜索模型 (例如 qwen, llama...)" />
                        <label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; cursor:pointer; color:var(--text-secondary); white-space:nowrap; padding:4px 8px; background:var(--bg-primary); border-radius:4px; border:1px solid var(--border-color);">
                          <input type="checkbox" v-model="showOnlyDownloaded" />
                          只看已缓存
                        </label>
                      </div>
                      <div class="model-list">
                        <div v-for="model in filteredModels" :key="model.model_id" class="model-item" :class="{ 'is-active': form.localModelName === model.model_id }">
                          <div class="model-item-info">
                            <span class="model-name">
                              {{ model.model_id }}
                              <span v-if="model.vram_required_MB" class="model-size">
                                (~{{ (model.vram_required_MB / 1024).toFixed(1) }} GB)
                              </span>
                            </span>
                            <span v-if="downloadedModels[model.model_id]" class="badge-downloaded"><CheckCircle2 class="icon-xs" style="margin-right:4px;"/> 已缓存</span>
                          </div>
                          <div class="model-item-actions">
                            <button v-if="downloadedModels[model.model_id] && !downloadingModels[model.model_id]" class="btn-cancel btn-icon-only" title="释放磁盘空间" @click.stop="deleteModelCache(model.model_id)">
                              <Trash2 class="icon-sm" style="color:var(--color-danger);"/>
                            </button>
                            
                            <!-- Downloading State -->
                            <div v-if="downloadingModels[model.model_id]" class="inline-progress">
                              <div class="progress-bar-bg">
                                <div class="progress-bar-fill" :style="{ width: downloadingModels[model.model_id].progress * 100 + '%' }"></div>
                              </div>
                              <span class="progress-text">{{ downloadingModels[model.model_id].text }}</span>
                            </div>

                            <!-- Not Downloaded -->
                            <button 
                              v-else-if="!downloadedModels[model.model_id]"
                              class="btn-sm btn-outline" 
                              @click="startDownload(model.model_id)"
                            >
                              <DownloadCloud class="icon-xs" style="margin-right:4px;" />
                              下载缓存
                            </button>

                            <!-- Downloaded and Current -->
                            <button 
                              v-else-if="form.localModelName === model.model_id"
                              class="btn-sm btn-primary" 
                              disabled
                              style="opacity:1;"
                            >
                              ✅ 当前默认
                            </button>

                            <!-- Downloaded but Not Current -->
                            <button 
                              v-else
                              class="btn-sm btn-outline" 
                              @click="selectModel(model.model_id)"
                            >
                              设为默认
                            </button>
                          </div>
                        </div>
                        <div v-if="filteredModels.length === 0" class="empty-state" style="padding: 20px; text-align:center;">没有找到匹配的模型</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="setting-section" v-if="form.aiMode === 'cloud'">
                <h4 class="section-title">API 核心参数 (云端模式)</h4>
                <form @submit.prevent="save" class="setting-card form-layout">
                  <div class="form-group">
                    <label>API Base URL</label>
                    <input 
                      v-model="form.apiBaseUrl" 
                      type="url" 
                      class="glass-input" 
                      placeholder="例如: https://api.deepseek.com/v1"
                      required
                    />
                  </div>
                  
                  <div class="form-group">
                    <label>模型名称 (Model)</label>
                    <input 
                      v-model="form.modelName" 
                      type="text" 
                      class="glass-input" 
                      placeholder="例如: deepseek-chat 或 gpt-4o-mini"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>API Key</label>
                    <input 
                      v-model="form.apiKey" 
                      type="password" 
                      class="glass-input" 
                      placeholder="sk-..."
                      required
                    />
                    <span class="hint-text">安全提示：您的 API 密钥仅保存在本地浏览器中，绝不会被上传至任何其他服务器。</span>
                  </div>

                  <div class="form-actions" style="margin-top:16px;">
                    <button type="button" class="btn-cancel" @click="close">取消</button>
                    <button type="submit" class="btn-primary">保存 API 配置</button>
                  </div>
                </form>
              </section>
            </div>

            <!-- API Usage Tab -->
            <div v-if="activeTab === 'usage'" class="tab-pane" style="display:flex; flex-direction:column; height:100%;">
              <div class="pane-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                  <h3 class="pane-title">API 消耗记录</h3>
                  <p class="pane-desc">追踪云端大模型的 Token 消耗量。</p>
                </div>
                <button class="btn-cancel" @click="clearHistory" style="display:flex; align-items:center; gap:6px;">
                  <Trash2 class="icon-sm" /> 清空记录
                </button>
              </div>

              <section class="setting-section" style="margin-bottom:16px;">
                <div class="usage-stats-grid">
                  <div class="stat-card" style="border:1px solid var(--border-color);">
                    <span class="stat-label">总计 Token 消耗</span>
                    <span class="stat-value text-accent">{{ totalTokensAllTime.toLocaleString() }}</span>
                  </div>
                  <div class="stat-card" style="border:1px solid var(--border-color);">
                    <span class="stat-label">请求总次数</span>
                    <span class="stat-value">{{ usageHistory.length }}</span>
                  </div>
                </div>
              </section>

              <section class="setting-section" style="flex:1; overflow:hidden; display:flex; flex-direction:column; margin-bottom:0;">
                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>调用时间</th>
                        <th>模型名称</th>
                        <th>Prompt / Completion</th>
                        <th>总 Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="usageHistory.length === 0">
                        <td colspan="4" class="empty-state" style="text-align:center; padding:32px; color:var(--text-secondary);">暂无消耗记录</td>
                      </tr>
                      <template v-for="record in usageHistory" :key="record.id">
                        <tr class="usage-row" @click="toggleRecord(record.id)">
                          <td>{{ formatDate(record.date) }}</td>
                          <td>{{ record.model }}</td>
                          <td style="color:var(--text-secondary);">{{ record.promptTokens }} / {{ record.completionTokens }}</td>
                          <td style="font-weight:600; color:var(--color-primary);">{{ record.totalTokens }}</td>
                        </tr>
                        <tr v-if="expandedRecords[record.id]" class="detail-row">
                          <td colspan="4">
                            <div class="usage-details">
                              <div class="detail-block">
                                <div class="detail-title">🗣️ 语音指令 (User)</div>
                                <div class="detail-text">{{ record.requestContent || '无' }}</div>
                              </div>
                              <div class="detail-block">
                                <div class="detail-title">📝 原始报文 (Raw Prompt)</div>
                                <pre class="detail-text json-view" style="max-height: 120px; overflow-y: auto;">{{ record.rawPrompt || '无' }}</pre>
                              </div>
                              <div class="detail-block">
                                <div class="detail-title">🤖 AI 解析结果 (Assistant)</div>
                                <pre class="detail-text json-view">{{ record.responseContent || '无' }}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </main>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { X, Settings as SettingsIcon, Sun, Moon, Monitor, Bot, Activity, Trash2, Search, DownloadCloud, CheckCircle2 } from 'lucide-vue-next'
import { prebuiltAppConfig, hasModelInCache, deleteModelAllInfoInCache, CreateMLCEngine } from '@mlc-ai/web-llm'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'
import { useUsage } from '../composables/useUsage'
import { useMobile } from '../composables/useMobile'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const activeTab = ref<'view' | 'ai' | 'usage'>('view')
const { settings, updateSettings } = useSettings()
const { isDark, toggleTheme } = useTheme()
const { usageHistory, clearHistory } = useUsage()
const { isMobile } = useMobile()

const modalContentRef = ref<HTMLElement | null>(null)
const sidebarWidth = ref(220)
const isResizing = ref(false)

const startResize = () => {
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
}

const onResize = (e: MouseEvent) => {
  if (!isResizing.value || !modalContentRef.value) return
  const rect = modalContentRef.value.getBoundingClientRect()
  const newWidth = e.clientX - rect.left
  if (newWidth >= 150 && newWidth <= 400) {
    sidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
}

const expandedRecords = ref<Record<string, boolean>>({})

const toggleRecord = (id: string) => {
  expandedRecords.value[id] = !expandedRecords.value[id]
}

const totalTokensAllTime = computed(() => {
  return usageHistory.value.reduce((acc, curr) => acc + curr.totalTokens, 0)
})

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const form = ref({ ...settings.value })

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { ...settings.value }
  }
})

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
    // 1. Downloaded to the top
    const aD = downloadedModels.value[a.model_id] ? 1 : 0
    const bD = downloadedModels.value[b.model_id] ? 1 : 0
    if (aD !== bD) return bD - aD
    // 2. Currently selected
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

watch(() => activeTab.value, (newVal) => {
  if (newVal === 'ai') checkCaches()
})

onMounted(() => {
  if (activeTab.value === 'ai') checkCaches()
})

const deleteModelCache = async (modelId: string) => {
  if (confirm(`确定要从浏览器存储中彻底删除模型 [${modelId}] 的文件缓存吗？这可以释放大量磁盘空间。`)) {
    try {
      await deleteModelAllInfoInCache(modelId)
      downloadedModels.value[modelId] = false
    } catch(e) {
      console.error(e)
      alert('删除失败，可能没有权限或被占用')
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
        downloadingModels.value[modelId] = {
          progress: report.progress,
          text: report.text
        }
      }
    })
    
    // Unload immediately after it has been fully fetched into cache
    // This releases the VRAM allocated during engine creation
    await engine.unload()
    
    // Mark as successfully downloaded
    downloadedModels.value[modelId] = true
  } catch (e: any) {
    console.error('Failed to download model', e)
    alert(`下载模型失败: ${e.message}`)
  } finally {
    delete downloadingModels.value[modelId]
  }
}
// --- End Model Manager ---

// Instant preview for UI settings
watch(
  () => [
    form.value.slotDuration, 
    form.value.slotHeight, 
    form.value.majorLineWidth, 
    form.value.majorLineOpacity,
    form.value.showMinorLines,
    form.value.minorLineWidth,
    form.value.minorLineOpacity,
    form.value.startHour,
    form.value.endHour
  ],
  () => {
    updateSettings({
      slotDuration: form.value.slotDuration,
      slotHeight: form.value.slotHeight,
      majorLineWidth: form.value.majorLineWidth,
      majorLineOpacity: form.value.majorLineOpacity,
      showMinorLines: form.value.showMinorLines,
      minorLineWidth: form.value.minorLineWidth,
      minorLineOpacity: form.value.minorLineOpacity,
      startHour: form.value.startHour,
      endHour: form.value.endHour
    })
  }
)

const close = () => {
  emit('close')
}

const save = () => {
  updateSettings({ ...form.value })
  close()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  /* Define solid colors for flat design */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-card: #f1f5f9;
  --border-color: #e2e8f0;
  --card-hover-bg: #e2e8f0;

  width: 95%;
  max-width: 1200px;
  height: 90vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary);
}

html.dark .modal-content {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-card: #010409;
  --border-color: #30363d;
  --card-hover-bg: #21262d;
}

.layout-split {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.settings-sidebar {
  background: var(--bg-secondary);
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex-shrink: 0;
}
html.dark .settings-sidebar {
  background: rgba(255, 255, 255, 0.02);
}

.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: var(--border-color);
  transition: background 0.2s;
  z-index: 10;
}
.resize-handle:hover, .resize-handle.is-resizing {
  background: var(--color-primary);
}

.sidebar-title {
  margin: 0;
  padding: 0 16px;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.text-primary { color: inherit; }

.settings-nav {
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.1s ease;
  text-align: left;
}

.nav-item:hover {
  background: rgba(128,128,128,0.1);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(128,128,128,0.15);
  color: var(--text-primary);
  border-left: 3px solid var(--color-primary);
  padding-left: 13px; /* offset border */
}

.settings-body {
  flex: 1;
  padding: 20px 32px;
  background: var(--bg-primary);
  overflow-y: auto;
}

/* Custom Scrollbar for Settings Body */
.settings-body::-webkit-scrollbar {
  width: 8px;
}
.settings-body::-webkit-scrollbar-track {
  background: transparent;
}
.settings-body::-webkit-scrollbar-thumb {
  background: var(--border-glass);
  border-radius: 4px;
}
.settings-body::-webkit-scrollbar-thumb:hover {
  background: var(--border-glass-subtle);
}

/* Mobile Adjustments */
.modal-content.is-mobile {
  width: 100%;
  height: 100%;
  max-width: 100%;
  border-radius: 0;
  border: none;
}

.layout-split.is-mobile {
  flex-direction: column;
}

.settings-sidebar.is-mobile {
  width: 100% !important;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-title.is-mobile {
  display: none;
}

.settings-nav.is-mobile {
  flex-direction: row;
  overflow-x: auto;
  gap: 8px;
  -webkit-overflow-scrolling: touch;
}

.settings-nav.is-mobile::-webkit-scrollbar {
  display: none;
}

.nav-item.is-mobile {
  white-space: nowrap;
  padding: 8px 12px;
  border-left: none;
  border-bottom: 2px solid transparent;
  border-radius: 6px;
}

.nav-item.is-mobile.active {
  border-left: none;
  border-bottom: none;
  background: var(--color-primary-alpha);
  color: var(--color-primary);
  padding-left: 12px;
}

.settings-body.is-mobile {
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.btn-close.is-mobile {
  top: 10px;
  right: 10px;
  z-index: 50;
  background: var(--bg-card);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.pane-header {
  margin-bottom: 24px;
}
.pane-title {
  margin: 0 0 8px 0;
  font-size: 1.4rem;
  font-weight: normal;
  color: var(--text-primary);
}
.pane-desc {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.setting-section {
  margin-bottom: 24px;
}
.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
}

.setting-card {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Override glass inputs for flat design */
.settings-body input.glass-input,
.settings-body select.glass-input {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 6px 10px;
  box-shadow: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  backdrop-filter: none;
}
.settings-body input.glass-input:focus {
  border-color: var(--color-primary);
  outline: 1px solid var(--color-primary);
}

.local-model-section p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 8px;
  line-height: 1.5;
}

/* Model Manager Styles */
.model-manager-container {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 12px;
}
.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
  border-radius: 6px;
}
.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: all 0.2s ease;
}
.model-item:hover {
  background: var(--bg-secondary);
  border-color: var(--color-primary-alpha);
}
.model-item.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-alpha);
}
.model-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.model-name {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}
.model-size {
  margin-left: 8px;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-secondary);
}
.badge-downloaded {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  color: var(--color-success);
  font-weight: 600;
}
.model-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 0.8rem;
  border-radius: 4px;
}
.btn-icon-only {
  padding: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
}
.btn-icon-only:hover {
  background: rgba(239, 68, 68, 0.1);
}

.inline-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 140px;
}
.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
  transition: width 0.1s linear;
}
.progress-text {
  font-size: 0.65rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* API Usage Styles */
.usage-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.stat-value {
  font-size: 1.5rem;
  font-family: var(--font-mono);
  font-weight: 700;
}
.table-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}
.data-table th {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-weight: 600;
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 1;
}
.data-table td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
}
.usage-row {
  cursor: pointer;
  transition: background 0.1s;
}
.usage-row:hover {
  background: var(--card-hover-bg);
}
.detail-row td {
  padding: 16px;
  background: rgba(128,128,128,0.03);
  border-bottom: 2px solid var(--border-color);
}
.usage-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, rgba(128,128,128,0.2));
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.detail-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-title {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.detail-text {
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-card, rgba(128,128,128,0.1));
  padding: 8px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.json-view {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}
.usage-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.usage-date {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.usage-model {
  font-size: 0.95rem;
  font-weight: 500;
}
.token-badge {
  background: var(--accent-bg);
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-family: var(--font-mono);
  font-weight: 600;
}
.empty-state {
  text-align: center;
  padding: 30px;
  color: var(--text-secondary);
  font-style: italic;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  padding-left: 4px;
}

.setting-card {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  padding: 24px;
}
html.dark .setting-card {
  background: rgba(255, 255, 255, 0.03);
}

.btn-close {
  position: absolute;
  top: 24px;
  right: 24px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.btn-close:hover {
  background: var(--card-hover-bg);
  color: var(--color-danger);
}

.form-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.glass-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-glass);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 0.95rem;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.glass-input:focus {
  outline: none;
  border-color: var(--input-focus-border);
  box-shadow: 0 0 0 3px var(--color-primary-alpha);
}

.hint-text {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.label-desc {
  display: flex;
  flex-direction: column;
}

.theme-group {
  margin-bottom: 0;
}

.btn-theme {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--border-glass);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-theme:hover {
  border-color: var(--color-primary-alpha);
  background: rgba(139, 92, 246, 0.05);
}

.text-amber { color: #f59e0b; }
.text-indigo { color: #6366f1; }

.slider-group {
  margin-top: 4px;
}

.sub-group {
  padding-left: 16px;
  border-left: 3px solid var(--color-primary-alpha);
  margin-top: -8px;
}

.flex-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

/* Toggle Switch Styles */
.switch {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-glass-subtle);
  transition: .4s;
}

.switch .slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: var(--color-primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.switch .slider.round {
  border-radius: 34px;
}

.switch .slider.round:before {
  border-radius: 50%;
}

.glass-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-glass);
  outline: none;
  margin-top: 8px;
}

.glass-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  transition: transform 0.1s;
}

.glass-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid var(--border-glass-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: var(--card-hover-bg);
  color: var(--text-primary);
}

.btn-primary {
  padding: 10px 24px;
  border-radius: 12px;
  border: none;
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px var(--color-primary-alpha);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--color-primary-alpha);
  background: var(--color-primary-light);
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-content {
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-pop {
  0% { transform: scale(0.95) translateY(10px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

/* Deeper Mobile Adjustments for Internal Content */
.settings-body.is-mobile .model-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.settings-body.is-mobile .model-item-actions {
  width: 100%;
  justify-content: space-between;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.settings-body.is-mobile .btn-sm {
  flex: 1;
  text-align: center;
  justify-content: center;
}

.settings-body.is-mobile .search-box {
  flex-wrap: wrap;
}

.settings-body.is-mobile .search-box .glass-input {
  min-width: 100%;
}

.settings-body.is-mobile .flex-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 16px !important;
}

.settings-body.is-mobile .flex-row > div, 
.settings-body.is-mobile .flex-row > label {
  width: 100%;
}

.settings-body.is-mobile .table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -16px;
  padding: 0 16px;
}

.settings-body.is-mobile .data-table {
  min-width: 600px; /* Force table to scroll instead of squash */
}

.settings-body.is-mobile .usage-stats-grid {
  grid-template-columns: 1fr;
  gap: 12px;
}
</style>
