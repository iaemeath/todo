<template>
  <div class="voice-assistant-fab">
    <!-- Feedback Toast -->
    <Transition name="toast-slide">
      <div v-if="toastMessage" class="voice-toast glass-panel" :class="toastType">
        {{ toastMessage }}
      </div>
    </Transition>

    <!-- Main FAB -->
    <button 
      class="fab-btn"
      :class="[state, { 'is-pulsing': state === 'listening' }]"
      @click="toggleVoice"
      :disabled="state === 'processing'"
      :title="tooltip"
    >
      <div v-if="state === 'listening'" class="pulse-ring"></div>
      
      <Mic v-if="state === 'idle' || state === 'listening'" class="fab-icon" />
      <Loader2 v-else-if="state === 'processing'" class="fab-icon spin" />
      <Check v-else-if="state === 'success'" class="fab-icon" />
      <AlertCircle v-else-if="state === 'error'" class="fab-icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Mic, Loader2, Check, AlertCircle } from 'lucide-vue-next'
import { parseVoiceCommand } from '../services/llmService'
import { useTodos } from '../composables/useTodos'

type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error'

const state = ref<VoiceState>('idle')
const toastMessage = ref('')
const toastType = ref<'info' | 'success' | 'error'>('info')
let recognition: any = null

const { addTask } = useTodos()

const tooltip = computed(() => {
  switch(state.value) {
    case 'idle': return '点击开始语音排期'
    case 'listening': return '正在倾听...'
    case 'processing': return 'AI 正在解析...'
    case 'success': return '解析成功'
    case 'error': return '解析失败'
    default: return ''
  }
})

const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000) => {
  toastMessage.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, duration)
}

const initSpeechRecognition = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  
  if (!SpeechRecognition) {
    showToast('抱歉，您的浏览器不支持语音识别', 'error')
    return false
  }

  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onstart = () => {
    state.value = 'listening'
    showToast('请说出您的日程安排...', 'info', 5000)
  }

  recognition.onresult = async (event: any) => {
    const text = event.results[0][0].transcript
    state.value = 'processing'
    showToast(`正在解析: "${text}"`, 'info', 5000)
    
    try {
      const parsedTask = await parseVoiceCommand(text)
      addTask(parsedTask)
      state.value = 'success'
      showToast(`已成功创建: ${parsedTask.title}`, 'success')
      
      setTimeout(() => {
        state.value = 'idle'
      }, 2000)
    } catch (e: any) {
      state.value = 'error'
      showToast(e.message || 'AI 解析失败', 'error')
      
      setTimeout(() => {
        state.value = 'idle'
      }, 3000)
    }
  }

  recognition.onerror = (event: any) => {
    state.value = 'error'
    showToast(`语音识别失败: ${event.error}`, 'error')
    setTimeout(() => {
      state.value = 'idle'
    }, 3000)
  }

  recognition.onend = () => {
    // If we stop without processing (e.g. user aborted or silence)
    if (state.value === 'listening') {
      state.value = 'idle'
      toastMessage.value = ''
    }
  }

  return true
}

const toggleVoice = () => {
  if (state.value === 'processing') return

  if (state.value === 'listening') {
    recognition?.stop()
    state.value = 'idle'
    toastMessage.value = ''
    return
  }

  if (!recognition) {
    const success = initSpeechRecognition()
    if (!success) return
  }

  try {
    recognition.start()
  } catch (e) {
    console.error(e)
    recognition.stop()
  }
}
</script>

<style scoped>
.voice-assistant-fab {
  position: fixed;
  bottom: 40px;
  right: 40px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
  z-index: 9999;
}

.voice-toast {
  padding: 12px 20px;
  border-radius: 12px;
  background: var(--bg-glass-solid);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-glass);
  font-size: 0.9rem;
  font-weight: 500;
  max-width: 300px;
  word-wrap: break-word;
  color: var(--text-primary);
  border-left: 4px solid var(--color-primary);
}

.voice-toast.success {
  border-left-color: var(--color-success);
}

.voice-toast.error {
  border-left-color: var(--color-danger);
}

/* Toast Transitions */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.9);
}

.fab-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px var(--color-primary-alpha);
  cursor: pointer;
  position: relative;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  outline: none;
}

.fab-btn:hover {
  transform: translateY(-4px) scale(1.05);
  background: var(--color-primary-light);
  box-shadow: 0 12px 32px var(--color-primary-alpha);
}

.fab-btn:active {
  transform: translateY(2px) scale(0.95);
}

.fab-btn.listening {
  background: var(--color-danger);
  box-shadow: 0 8px 24px var(--color-danger-alpha);
}

.fab-btn.success {
  background: var(--color-success);
  box-shadow: 0 8px 24px var(--color-success-alpha);
}

.fab-icon {
  width: 28px;
  height: 28px;
  z-index: 2;
}

.spin {
  animation: spin-anim 1s linear infinite;
}

@keyframes spin-anim {
  100% { transform: rotate(360deg); }
}

.pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid white;
  animation: pulse-anim 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  z-index: 1;
}

@keyframes pulse-anim {
  0% { transform: scale(0.95); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; border-width: 1px; }
}
</style>
