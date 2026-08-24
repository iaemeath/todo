<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download, Upload, FolderOpened, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { exportAllData, parseBundle, importAllData, useUIStore, type ExportBundle } from '../stores'
import { useAuthStore } from '../stores/auth'
import {
  syncState,
  lastSyncAt,
  syncNow,
  restoreFromCloud,
  getLocalBackups,
  restoreLocalBackup
} from '../services/syncManager'

const uiStore = useUIStore()
const authStore = useAuthStore()

// ---- 云同步 ----
const SYNC_TEXT: Record<string, string> = {
  idle: '待同步（自动进行）',
  syncing: '同步中…',
  synced: '已同步',
  offline: '离线，联网后自动同步',
  error: '同步失败，稍后自动重试'
}
const syncText = computed(() => SYNC_TEXT[syncState.value] || syncState.value)
const displayName = computed(() => authStore.user?.nickname || authStore.user?.username || '')
const lastSyncText = computed(() =>
  lastSyncAt.value ? new Date(lastSyncAt.value).toLocaleString('zh-CN') : '从未'
)

const syncing = ref(false)
const handleSyncNow = async () => {
  syncing.value = true
  try {
    const ok = await syncNow()
    if (ok) ElMessage.success('同步完成')
    else if (syncState.value === 'offline') ElMessage.warning('网络不可达，联网后自动重试')
    else ElMessage.error('同步失败，请稍后重试')
  } finally {
    syncing.value = false
  }
}

const handleRestoreCloud = async () => {
  try {
    await ElMessageBox.confirm(
      '将用云端数据覆盖本机当前数据（覆盖前自动保留本机保护快照）。',
      '从云端恢复',
      { type: 'warning', confirmButtonText: '覆盖恢复', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  const ok = await restoreFromCloud()
  if (ok) {
    ElMessage.success('已恢复云端数据')
    refreshBackups()
  } else {
    ElMessage.error('恢复失败（云端无数据或网络不可达）')
  }
}

// 本机保护快照（每次被云端覆盖前自动存档，最多 3 份）
const backups = ref<ExportBundle[]>(getLocalBackups())
const selectedBackup = ref('')
const backupOptions = computed(() =>
  backups.value.map((b, i) => ({
    value: String(i),
    label: `${new Date(b.exportedAt).toLocaleString('zh-CN')} · ${b.tasks.length} 任务`
  }))
)
const refreshBackups = () => {
  backups.value = getLocalBackups()
  selectedBackup.value = ''
}
const handleRestoreBackup = async () => {
  const b = backups.value[Number(selectedBackup.value)]
  if (!b) return
  try {
    await ElMessageBox.confirm(
      `回滚到 ${new Date(b.exportedAt).toLocaleString('zh-CN')} 的本机快照？当前数据将被覆盖。`,
      '回滚本机快照',
      { type: 'warning', confirmButtonText: '回滚', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  restoreLocalBackup(b)
  ElMessage.success('已回滚，稍后自动同步到云端')
}

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
    <!-- 云同步（登录特权；游客显示引导） -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">云同步</span></template>
      <template v-if="!authStore.isLoggedIn">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">登录开启多设备云同步</span>
            <span class="setting-desc">登录后数据定期自动同步到云端账号，换设备不丢数据；同时解锁语音助手。</span>
          </div>
          <el-button type="primary" @click="uiStore.openAuth()">登录 / 注册</el-button>
        </div>
        <div class="form-hint">未登录不影响本机使用：全部功能照常，数据仅存于本浏览器（清理浏览器数据会丢失）。</div>
      </template>
      <template v-else>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">{{ syncText }}</span>
            <span class="setting-desc">账号 {{ displayName }} · 上次同步 {{ lastSyncText }}（改动后约 30 秒自动同步）</span>
          </div>
          <div class="cloud-actions">
            <el-button type="primary" plain :icon="Refresh" :loading="syncing" @click="handleSyncNow">立即同步</el-button>
            <el-button type="warning" plain @click="handleRestoreCloud">从云端恢复</el-button>
          </div>
        </div>
        <div v-if="backupOptions.length" class="setting-row">
          <div class="setting-info">
            <span class="setting-name">本机保护快照</span>
            <span class="setting-desc">每次被云端覆盖前自动存档，最多保留 3 份，可随时回滚。</span>
          </div>
          <div class="cloud-actions">
            <el-select v-model="selectedBackup" placeholder="选择快照" style="width: 210px">
              <el-option
                v-for="opt in backupOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-button :disabled="selectedBackup === ''" @click="handleRestoreBackup">回滚</el-button>
          </div>
        </div>
      </template>
    </el-card>

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

/* 云同步操作按钮组（可能与较长的说明文字并排，允许换行） */
.cloud-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.data-empty-hint {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.78rem;
  color: var(--el-text-color-secondary);
}
</style>
