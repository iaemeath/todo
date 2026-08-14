import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

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

export const useUsageStore = defineStore('usage', () => {
  const usageHistory = ref<UsageRecord[]>([])

  const load = () => {
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

  load()

  watch(usageHistory, (newUsage) => {
    localStorage.setItem(LOCAL_STORAGE_USAGE, JSON.stringify(newUsage))
  }, { deep: true })

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

  return { usageHistory, addRecord, clearHistory }
})
