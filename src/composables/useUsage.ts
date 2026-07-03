import { ref, watch } from 'vue'

const LOCAL_STORAGE_USAGE = 'canvas_api_usage'

export interface UsageRecord {
  id: string
  date: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requestContent?: string
  responseContent?: string
  rawPrompt?: string
}

const usageHistory = ref<UsageRecord[]>([])

const loadUsage = () => {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(LOCAL_STORAGE_USAGE)
  if (stored) {
    try {
      usageHistory.value = JSON.parse(stored)
    } catch (e) {
      console.error('Failed to parse usage', e)
    }
  }
}

loadUsage()

watch(usageHistory, (newUsage) => {
  localStorage.setItem(LOCAL_STORAGE_USAGE, JSON.stringify(newUsage))
}, { deep: true })

export function useUsage() {
  const addRecord = (record: Omit<UsageRecord, 'id' | 'date'>) => {
    const newRecord: UsageRecord = {
      ...record,
      id: Date.now().toString(),
      date: new Date().toISOString()
    }
    // Keep last 100 records
    usageHistory.value = [newRecord, ...usageHistory.value].slice(0, 100)
  }

  const clearHistory = () => {
    usageHistory.value = []
  }

  return {
    usageHistory,
    addRecord,
    clearHistory
  }
}
