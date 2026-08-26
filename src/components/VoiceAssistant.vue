<template>
  <div class="voice-assistant-fab" :style="fabStyle">
    <Transition name="toast-slide">
      <div v-if="toastMessage" class="voice-toast glass-panel" :class="toastType">
        {{ toastMessage }}
      </div>
    </Transition>

    <!-- Main FAB -->
    <button
      v-show="state === 'idle' && !toastMessage"
      class="fab-btn"
      :class="[state, { 'is-pulsing': state === 'listening', 'is-dragging': isDraggingState }]"
      @mousedown="startDrag"
      @touchstart="startDrag"
      @click="handleFabClick"
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
import { ref, computed, watch } from 'vue'
import { Mic, Loader2, Check, AlertCircle } from 'lucide-vue-next'
import Fuse from 'fuse.js'
import { confirmDialog } from '../utils/confirm'
import { parseVoiceCommand, type VoiceIntent } from '../services/llmService'
import { storeToRefs } from 'pinia'
import { useTaskStore, useSettingsStore } from '../stores'
import { todayLocal } from '../utils/dates'

type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error'

const state = ref<VoiceState>('idle')
const toastMessage = ref('')
const toastType = ref<'info' | 'success' | 'error'>('info')
let recognition: any = null
let silenceTimer: any = null
let toastTimer: any = null
const accumulatedText = ref('')

// 'todo' 意图 → 任务树(tasks)；'event' 意图 → 日程(schedules)。
// tasks + schedules 合并于同一 useTaskStore。
const taskStore = useTaskStore()
const { tasks, schedules } = storeToRefs(taskStore) // state → storeToRefs
const { addTask, updateTask, deleteTask, addSchedule, updateSchedule, deleteSchedule } = taskStore // action
const { settings } = storeToRefs(useSettingsStore())

// 语音删除属模糊匹配（谐音推断 + Fuse），且任务删除会级联子孙与关联日程，必须先确认
const CANCELLED = '__CANCELLED__'

const executeIntent = async (intent: VoiceIntent): Promise<string> => {
  if (intent.action === 'add') {
    if (intent.target === 'todo') {
      const payload = intent.payload || {}
      addTask({
        title: payload.todoText || '新待办',
        description: '',
        category: 'ideas',
        important: payload.important === true,
        urgent: payload.urgent === true
      })
      return '已成功添加待办：' + (payload.todoText || '新待办')
    } else {
      const payload = intent.payload || {}
      addSchedule({
        title: payload.title || '新日程',
        date: payload.date || todayLocal(),
        startTime: payload.startTime || '12:00',
        endTime: payload.endTime || '13:00',
        color: payload.color || 'blue'
      })
      return '已成功添加日程：' + (payload.title || '新日程')
    }
  }

  const listToSearch = intent.target === 'todo' ? tasks.value : schedules.value
  let bestMatch: any = null

  if (intent.targetId) {
    bestMatch = listToSearch.find(item => String(item.id) === String(intent.targetId))
  }

  if (!bestMatch) {
    if (!intent.searchQuery) {
      throw new Error('未提供搜索关键词，也未找到确切目标，无法执行操作')
    }

    const fuse = new Fuse(listToSearch as any[], {
      keys: ['title', 'description'],
      threshold: 0.4
    })

    const results = fuse.search(intent.searchQuery)
    if (results.length === 0) {
      throw new Error(`找不到符合 "${intent.searchQuery}" 的记录`)
    }

    bestMatch = results[0].item
  }

  if (intent.action === 'delete') {
    const label = intent.target === 'todo' ? '待办' : '日程'
    const extra = intent.target === 'todo' ? '，其子任务和关联日程也会一并删除' : ''
    const ok = await confirmDialog(
      `语音指令将删除${label}「${bestMatch.title}」${extra}，确定执行吗？`,
      '删除确认',
      { confirmText: '删除' }
    )
    if (!ok) throw new Error(CANCELLED)
    if (intent.target === 'todo') {
      deleteTask(bestMatch.id)
      return `已删除待办：${bestMatch.title}`
    } else {
      deleteSchedule(bestMatch.id)
      return `已删除日程：${bestMatch.title}`
    }
  }

  if (intent.action === 'edit') {
    const payload = intent.payload || {}
    if (intent.target === 'todo') {
      updateTask(bestMatch.id, { title: payload.todoText || bestMatch.title })
      return `已修改待办：${payload.todoText || bestMatch.title}`
    } else {
      // Clean undefined keys from payload
      const updates = Object.fromEntries(Object.entries(payload).filter(([_, v]) => v != null))
      updateSchedule(bestMatch.id, updates)
      return `已修改日程：${updates.title || bestMatch.title}`
    }
  }

  throw new Error('未知的操作指令')
}

// --- Draggable Logic ---
const positionX = ref<number | null>(null)
const positionY = ref<number | null>(null)
const isDraggingState = ref(false)

const fabStyle = computed(() => {
  if (positionX.value === null || positionY.value === null) {
    return { bottom: '40px', right: '40px' }
  }
  return {
    left: `${positionX.value}px`,
    top: `${positionY.value}px`,
    bottom: 'auto',
    right: 'auto',
  }
})

let dragStartX = 0
let dragStartY = 0
let isDragging = false
let dragStartPos = { x: 0, y: 0 }

const startDrag = (e: MouseEvent | TouchEvent) => {
  isDragging = false
  isDraggingState.value = false
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  
  dragStartPos = { x: clientX, y: clientY }
  
  if (positionX.value === null) {
    const el = document.querySelector('.voice-assistant-fab') as HTMLElement
    if (el) {
      const rect = el.getBoundingClientRect()
      positionX.value = rect.left
      positionY.value = rect.top
    }
  }

  dragStartX = clientX - (positionX.value || 0)
  dragStartY = clientY - (positionY.value || 0)

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

const onDrag = (e: MouseEvent | TouchEvent) => {
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  
  if (Math.abs(clientX - dragStartPos.x) > 3 || Math.abs(clientY - dragStartPos.y) > 3) {
    isDragging = true
    isDraggingState.value = true
  }

  if (isDragging) {
    if (e.cancelable) e.preventDefault()
    positionX.value = clientX - dragStartX
    positionY.value = clientY - dragStartY
  }
}

const stopDrag = () => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
  setTimeout(() => {
    isDragging = false
    isDraggingState.value = false
  }, 50)
}

const handleFabClick = (e: Event) => {
  if (isDragging) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  toggleVoice()
}
// --- End Draggable Logic ---

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
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastType.value = type
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, duration)
}

watch(() => settings.value.webLlmProgress, (newProgress) => {
  if (state.value === 'processing' && settings.value.aiMode === 'local' && newProgress) {
    showToast(`引擎加载中: ${newProgress}`, 'info', 10000)
  }
})

const initSpeechRecognition = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  
  if (!SpeechRecognition) {
    showToast('抱歉，您的浏览器不支持语音识别', 'error')
    return false
  }

  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  const processVoice = async (text: string) => {
    recognition?.stop()
    state.value = 'processing'
    showToast(`正在解析: "${text}"`, 'info', 5000)
    
    // Optimize context tokens using Fuse.js locally first
    const fuseEvents = new Fuse(schedules.value as any[], { keys: ['title'], threshold: 0.8 })
    const matchedEvents = fuseEvents.search(text).slice(0, 3).map(r => r.item)

    const fuseTodos = new Fuse(tasks.value as any[], { keys: ['title', 'description'], threshold: 0.8 })
    const matchedTodos = fuseTodos.search(text).slice(0, 3).map(r => r.item)

    const contextData = {
      events: matchedEvents.map(t => ({ id: String(t.id), title: t.title, date: t.date })),
      todos: matchedTodos.map(t => ({ id: String(t.id), text: t.title }))
    }
    
    try {
      const intent = await parseVoiceCommand(text, false, contextData)
      const successMsg = await executeIntent(intent)
      state.value = 'success'
      showToast(successMsg, 'success')

      setTimeout(() => {
        state.value = 'idle'
      }, 2000)
    } catch (e: any) {
      // 用户在删除确认弹窗点了取消：静默复位，不算错误
      if (e?.message === CANCELLED) {
        state.value = 'idle'
        toastMessage.value = ''
        return
      }
      if (settings.value.aiMode === 'local') {
        // 选本地模式可能就是不想联网，改用云端前先征求同意
        const useCloud = await confirmDialog(
          '本地模型解析失败，是否改用云端 API 解析本次指令？',
          '切换云端解析',
          { type: 'info', confirmText: '用云端解析' }
        )
        if (!useCloud) {
          state.value = 'idle'
          toastMessage.value = ''
          return
        }
        try {
          const cloudIntent = await parseVoiceCommand(text, true, contextData)
          const cloudSuccessMsg = await executeIntent(cloudIntent)
          state.value = 'success'
          showToast(cloudSuccessMsg, 'success')

          setTimeout(() => {
            state.value = 'idle'
          }, 2000)
        } catch (cloudErr: any) {
          if (cloudErr?.message === CANCELLED) {
            state.value = 'idle'
            toastMessage.value = ''
            return
          }
          state.value = 'error'
          showToast(cloudErr.message || '云端 AI 解析失败', 'error')
          setTimeout(() => { state.value = 'idle' }, 3000)
        }
      } else {
        state.value = 'error'
        showToast(e.message || 'AI 解析失败', 'error')

        setTimeout(() => {
          state.value = 'idle'
        }, 3000)
      }
    }
  }

  recognition.onstart = () => {
    accumulatedText.value = ''
    state.value = 'listening'
    showToast('请说出您的日程安排...', 'info', 5000)
  }

  recognition.onresult = (event: any) => {
    if (state.value !== 'listening') return
    if (silenceTimer) clearTimeout(silenceTimer)
    
    let currentInterim = ''
    let currentFinal = ''

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentFinal += event.results[i][0].transcript
      } else {
        currentInterim += event.results[i][0].transcript
      }
    }

    if (currentFinal) {
      accumulatedText.value += currentFinal
    }
    
    const displayString = accumulatedText.value + currentInterim
    if (displayString) {
      showToast(`正在听: "${displayString}"`, 'info', 5000)
    }

    silenceTimer = setTimeout(() => {
      const finalText = accumulatedText.value + currentInterim
      if (!finalText.trim()) {
        state.value = 'idle'
        recognition.stop()
        return
      }
      processVoice(finalText)
    }, 1500)
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
    if (silenceTimer) clearTimeout(silenceTimer)
    recognition?.stop()
    if (accumulatedText.value.trim()) {
      // process if they click stop but have spoken
      // but if we do this, it will call processVoice inside toggleVoice. We didn't expose processVoice.
      // So we just cancel and let them try again, or we can just drop it. Let's drop it to match original behavior.
    }
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
  z-index: var(--z-overlay);
  width: 64px;
  height: 64px;
}

.voice-toast {
  position: absolute;
  bottom: calc(100% + var(--space-lg));
  right: 0;
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-md);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  box-shadow: var(--el-box-shadow-light);
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
  max-width: 300px;
  width: max-content;
  overflow-wrap: break-word;
  color: var(--el-text-color-primary);
  border-left: 4px solid var(--el-color-primary);
  pointer-events: none;
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
  transition: all var(--duration-base) var(--ease-spring);
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
  cursor: grab;
  position: relative;
  transition: all var(--duration-base) var(--ease-spring);
  outline: none;
}

.fab-btn.is-dragging {
  cursor: grabbing;
  transition: none; /* remove transition when dragging for smooth movement */
  transform: scale(1.05);
}

.fab-btn:active {
  transform: translateY(2px) scale(0.95);
}

.fab-btn:hover:not(.is-dragging) {
  transform: translateY(-4px) scale(1.05);
  background: var(--color-primary-light);
  box-shadow: 0 12px 32px var(--color-primary-alpha);
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
  0% {
    transform: scale(0.95);
    opacity: 0.8;
  }

  100% {
    transform: scale(1.6);
    opacity: 0;
    border-width: 1px;
  }
}

</style>
