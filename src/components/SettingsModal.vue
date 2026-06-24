<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-content glass-panel">
          <button class="btn-close" @click="close">
            <X class="icon-sm" />
          </button>
          
          <h2 class="modal-title">
            <SettingsIcon class="icon-md" />
            AI 智能助理设置
          </h2>
          <p class="modal-desc">配置大模型 API 以开启语音智能排期功能。支持任何兼容 OpenAI 接口的模型（如 DeepSeek, 通义千问, Kimi, GPT）。</p>

          <form @submit.prevent="save" class="form-layout">
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
              <span class="hint-text">您的 API 密钥仅保存在本地浏览器，不会上传至任何其他服务器。</span>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-cancel" @click="close">取消</button>
              <button type="submit" class="btn-primary">保存设置</button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Settings as SettingsIcon } from 'lucide-vue-next'
import { useSettings } from '../composables/useSettings'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { settings, updateSettings } = useSettings()

const form = ref({ ...settings.value })

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { ...settings.value }
  }
})

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
  max-width: 480px;
  background: var(--bg-glass-solid);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: 24px;
  padding: 32px;
  box-shadow: var(--shadow-glass);
  position: relative;
  transform-origin: center;
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
}

.btn-close:hover {
  background: var(--card-hover-bg);
  color: var(--color-danger);
}

.modal-title {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-title .icon-md {
  color: var(--color-primary);
}

.modal-desc {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.form-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.85rem;
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
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
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
