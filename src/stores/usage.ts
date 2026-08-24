import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { UsageRecord } from '../types/bundle'

const LOCAL_STORAGE_USAGE = 'canvas_api_usage'

// 契约定义在 types/bundle.ts（前后端共享），此处 re-export 保持既有 import 路径兼容
export type { UsageRecord } from '../types/bundle'

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
