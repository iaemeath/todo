<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-content glass-panel layout-split">
          
          <button class="btn-close" @click="close">
            <X class="icon-sm" />
          </button>

          <!-- Sidebar -->
          <aside class="settings-sidebar">
            <h2 class="sidebar-title">
              <SettingsIcon class="icon-sm text-primary" />
              全局设置
            </h2>
            <nav class="settings-nav">
              <button 
                :class="['nav-item', { active: activeTab === 'view' }]"
                @click="activeTab = 'view'"
              >
                <Monitor class="icon-sm" />
                视觉与外观
              </button>
              <button 
                :class="['nav-item', { active: activeTab === 'ai' }]"
                @click="activeTab = 'ai'"
              >
                <Bot class="icon-sm" />
                AI 助理配置
              </button>
            </nav>
          </aside>

          <!-- Main Content -->
          <main class="settings-body">
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
                <p class="pane-desc">配置大语言模型以激活智能语音录入功能。支持任何兼容 OpenAI 接口的模型（如 DeepSeek, 通义千问, Kimi）。</p>
              </div>

              <section class="setting-section">
                <h4 class="section-title">API 核心参数</h4>
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
          </main>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Settings as SettingsIcon, Sun, Moon, Monitor, Bot } from 'lucide-vue-next'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const activeTab = ref('view')
const { settings, updateSettings } = useSettings()
const { isDark, toggleTheme } = useTheme()

const form = ref({ ...settings.value })

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { ...settings.value }
  }
})

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
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  width: 100%;
  max-width: 900px;
  height: 85vh;
  background: var(--bg-glass-solid);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: 24px;
  box-shadow: var(--shadow-glass);
  position: relative;
  transform-origin: center;
}

/* Dual Pane Layout */
.layout-split {
  display: flex;
  flex-direction: row;
  padding: 0;
  overflow: hidden;
  height: 90%;
}

.settings-sidebar {
  width: 240px;
  background: rgba(0, 0, 0, 0.02);
  border-right: 1px solid var(--border-glass);
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex-shrink: 0;
}
html.dark .settings-sidebar {
  background: rgba(255, 255, 255, 0.02);
}

.sidebar-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
}
.text-primary { color: var(--color-primary); }

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.nav-item:hover {
  background: var(--card-hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--color-primary-alpha);
  color: var(--color-primary);
}

.settings-body {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  position: relative;
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

.pane-header {
  margin-bottom: 32px;
}
.pane-title {
  margin: 0 0 12px 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
}
.pane-desc {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
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
</style>
