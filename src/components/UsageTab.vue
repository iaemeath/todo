<script setup lang="ts">
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { confirmAction } from '../utils/confirm'
import { storeToRefs } from 'pinia'
import { useUsageStore } from '../stores'

const { usageHistory } = storeToRefs(useUsageStore()) // state → storeToRefs
const { clearHistory } = useUsageStore() // action 直接解构

const totalTokensAllTime = computed(() => {
  return usageHistory.value.reduce((acc, curr) => acc + curr.totalTokens, 0)
})

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const handleClearHistory = async () => {
  await confirmAction({
    message: '确定要清空所有 API 消耗记录吗？此操作不可撤销。',
    title: '清空记录',
    confirmText: '清空',
    action: () => clearHistory(),
    success: '消耗记录已清空'
  })
}
</script>

<template>
  <div>
  <div class="usage-actions">
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
</template>

<style scoped>
/* 页头介绍已按设置页统一规范移除，仅保留右对齐的操作按钮行 */
.usage-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-md);
}
</style>
