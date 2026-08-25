<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download, Upload, FolderOpened, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { confirmAction } from '../utils/confirm'
import { exportAllData, parseBundle, useUIStore } from '../stores'
import { useAuthStore } from '../stores/auth'
import { syncState, lastSyncAt, syncNow, restoreFromCloud, importBundle } from '../services/syncManager'
import { isDesktopShell, getServerUrl, setServerUrl } from '../services/apiClient'

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
const displayName = computed(() => authStore.user?.username || authStore.user?.email || '')
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
  await confirmAction({
    message: '将用云端数据整体覆盖本机当前数据，覆盖后不可恢复；如本机有未同步的改动，请先导出备份。',
    title: '从云端恢复',
    confirmText: '覆盖恢复',
    action: async () => {
      const ok = await restoreFromCloud()
      if (ok) ElMessage.success('已恢复云端数据')
      else ElMessage.error('恢复失败（云端无数据或网络不可达）')
    }
  })
}

// ---- Electron 壳：服务器地址配置（file:// 下 API 走绝对地址，此处可视化，替代 F12 改 localStorage）----
const isDesktop = isDesktopShell
const serverUrl = ref(isDesktop ? getServerUrl() : '')
const serverWarn = computed(() =>
  !isDesktop || serverUrl.value.startsWith('https://')
    ? ''
    : '当前为不加密连接（http）：登录令牌与数据明文传输，服务器部署 HTTPS 后请切换为 https:// 地址'
)

function applyServerUrl() {
  const u = serverUrl.value.trim()
  if (u && !/^https?:\/\//i.test(u)) {
    ElMessage.warning('地址需以 http:// 或 https:// 开头')
    return
  }
  setServerUrl(u)
  serverUrl.value = getServerUrl()
  ElMessage.success(u ? '服务器地址已保存，立即生效' : '已恢复默认服务器地址')
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
    await confirmAction({
      message: '导入将用备份文件覆盖当前的任务、日程、设置（含 API Key）与主题；备份中没有的任务/日程将被删除，用量记录仅合并不删除，此操作不可撤销。'
        + (authStore.isLoggedIn ? '当前已登录：结果（含删除）会同步到该账号的其他设备。' : ''),
      title: '导入数据',
      confirmText: '覆盖导入',
      action: () => importBundle(bundle),
      success: '数据已恢复'
    })
  } catch {
    // 确认取消已被 confirmAction 消化；此处兜 importBundle 的意外异常
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
      <!-- Electron 壳专用：API 服务器地址可视化配置（登录前后都可能需要改） -->
      <template v-if="isDesktop">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">服务器地址</span>
            <span class="setting-desc">桌面版通过远程服务器登录与同步，支持 https 加密地址。</span>
          </div>
          <div class="cloud-actions">
            <el-input v-model="serverUrl" placeholder="https://your-server.example" style="width: 250px" />
            <el-button plain @click="applyServerUrl">保存</el-button>
          </div>
        </div>
        <div v-if="serverWarn" class="form-hint hint-warn">{{ serverWarn }}</div>
      </template>
      <template v-if="!authStore.isLoggedIn">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">登录开启多设备云同步</span>
            <span class="setting-desc">登录后数据定期自动同步到云端账号，换设备不丢数据。</span>
          </div>
          <el-button type="primary" @click="uiStore.openAuth()">登录 / 注册</el-button>
        </div>
        <div class="form-hint">未登录不影响本机使用：全部功能照常，数据仅存于本浏览器（清理浏览器数据会丢失）。</div>
      </template>
      <template v-else>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">{{ syncText }}</span>
            <span class="setting-desc">账号 {{ displayName }} · 上次同步 {{ lastSyncText }}（改动后约 30 秒自动同步，每 5 分钟自动对齐一次）</span>
          </div>
          <div class="cloud-actions">
            <el-button type="primary" plain :icon="Refresh" :loading="syncing" @click="handleSyncNow">立即同步</el-button>
            <el-button type="warning" plain @click="handleRestoreCloud">从云端恢复</el-button>
          </div>
        </div>
      </template>
    </el-card>

    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">导出备份</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">导出全部数据</span>
          <span class="setting-desc">任务、日程、设置（含 API Key）、主题与用量记录打包为 JSON 备份文件。</span>
        </div>
        <el-button type="primary" plain :icon="Download" @click="handleExport">导出备份</el-button>
      </div>
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
      <div class="form-hint">⚠️ 导入以备份文件为准：备份中没有的任务/日程将被删除，设置（含 API Key）随之覆盖；用量记录为追加流水，仅合并不删除。已登录时结果会同步到该账号的其他设备。操作前建议先导出当前数据。</div>
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

/* http 明文连接警示（form-hint 的警告色变体） */
.hint-warn {
  color: var(--el-color-warning);
  margin-top: calc(var(--space-sm) * -1);
}
</style>
