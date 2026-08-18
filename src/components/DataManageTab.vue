<script setup lang="ts">
import { ref } from 'vue'
import { Download, Upload, FolderOpened } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { exportAllData, parseBundle, importAllData } from '../stores'

const fileInput = ref<HTMLInputElement | null>(null)

// ---- 导出 ----
const handleExport = () => {
  const bundle = exportAllData()
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const a = document.createElement('a')
  a.href = url
  a.download = `todo-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('备份文件已导出')
}

// ---- 导入（全量覆盖，二次确认） ----
const triggerImport = () => {
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      ElMessage.error('文件不是有效的 JSON 格式')
      return
    }
    const bundle = parseBundle(raw)
    if (!bundle) {
      ElMessage.error('备份文件格式不正确（缺少任务/日程数据）')
      return
    }
    await ElMessageBox.confirm(
      '导入将用备份文件覆盖当前的全部数据（任务、日程、设置、主题、用量记录），此操作不可撤销。',
      '导入数据',
      { type: 'warning', confirmButtonText: '覆盖导入', cancelButtonText: '取消' }
    )
    importAllData(bundle)
    ElMessage.success('数据已恢复')
  } catch {
    // 用户取消确认弹窗
  } finally {
    input.value = '' // 复位以支持连续导入同一文件
  }
}
</script>

<template>
  <div class="data-manage">
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">导出备份</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">导出全部数据</span>
          <span class="setting-desc">任务、日程、设置、主题与用量记录打包为 JSON 备份文件。</span>
        </div>
        <el-button type="primary" plain :icon="Download" @click="handleExport">导出备份</el-button>
      </div>
      <div class="form-hint">安全说明：导出文件已自动剔除 API Key，可安全分享或留存；导入后如需云端 AI 请重新填写密钥。</div>
    </el-card>

    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">导入恢复</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">从备份文件恢复</span>
          <span class="setting-desc">选择之前导出的备份文件，恢复到备份时刻的完整状态。</span>
        </div>
        <el-button type="warning" plain :icon="Upload" @click="triggerImport">选择备份文件</el-button>
      </div>
      <div class="form-hint">⚠️ 导入为全量覆盖：当前全部数据将被备份文件内容整体替换，操作前建议先导出当前数据。</div>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        style="display: none;"
        @change="handleFileChange"
      />
    </el-card>

    <div class="data-empty-hint">
      <el-icon><FolderOpened /></el-icon>
      <span>备份文件名格式：todo-backup-日期-时间.json</span>
    </div>
  </div>
</template>

<style scoped>
.data-manage {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.data-empty-hint {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.78rem;
  color: var(--el-text-color-secondary);
}
</style>
