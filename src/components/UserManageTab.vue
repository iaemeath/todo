<script setup lang="ts">
/**
 * 用户管理（仅管理员）：侧栏入口由 features.admin 控显隐，
 * 本页数据一律走 /api/admin/*（服务端 requireAdmin 是真正的权限边界，
 * 直接敲 URL #/users 进入的非管理员只会收到 403 提示）。
 * 布局对齐任务/日程管理页：上方筛选栏（搜索+刷新）+ 下方全宽列表。
 */
import { ref, computed, onMounted } from 'vue'
import { Refresh, Key, Delete, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, ApiError } from '../services/apiClient'
import { useAuthStore } from '../stores/auth'

interface AdminUser {
  id: string
  email: string | null
  username: string | null
  createdAt: string
  syncedAt: string | null
  snapshotKb: number
}

const authStore = useAuthStore()
const users = ref<AdminUser[]>([])
const loading = ref(false)
const errMsg = ref('')

// ---- 筛选：按邮箱/用户名模糊匹配 ----
const searchQuery = ref('')
const filteredUsers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(u =>
    (u.email || '').toLowerCase().includes(q) ||
    (u.username || '').toLowerCase().includes(q)
  )
})

const isMe = (u: AdminUser) => u.id === authStore.user?.id

const load = async () => {
  loading.value = true
  errMsg.value = ''
  try {
    const r = await api<{ users: AdminUser[] }>('/admin/users')
    users.value = r.users
  } catch (e) {
    errMsg.value = e instanceof ApiError ? e.message : '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
onMounted(load)

/** SQLite localtime 文本 "2026-08-24 12:00:00" → 本地格式（补 T 保跨浏览器解析） */
const fmtTime = (t: string | null) =>
  t ? new Date(t.replace(' ', 'T')).toLocaleString('zh-CN') : '从未'

const apiErr = (e: unknown) =>
  ElMessage.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试')

/** 重置密码：明文输入由管理员线下转达对方（6~64 位，与注册同规） */
const resetPassword = async (u: AdminUser) => {
  let password: string
  try {
    ;({ value: password } = await ElMessageBox.prompt(
      `为用户「${u.email || u.username}」设置新密码（6~64 位），请线下转达对方`,
      '重置密码',
      {
        inputType: 'password',
        inputPattern: /^.{6,64}$/,
        inputErrorMessage: '密码长度需 6~64 位'
      }
    ))
  } catch {
    return
  }
  try {
    await api(`/admin/users/${u.id}/password`, { method: 'PUT', body: { password } })
    ElMessage.success('密码已重置')
  } catch (e) {
    apiErr(e)
  }
}

/** 删除用户：级联删云端快照；本地优先架构下不影响对方浏览器中的数据 */
const removeUser = async (u: AdminUser) => {
  try {
    await ElMessageBox.confirm(
      `将删除用户「${u.email || u.username}」及其云端快照，不可恢复。对方浏览器中的本地数据不受影响，但将失去云同步。`,
      '删除用户',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await api(`/admin/users/${u.id}`, { method: 'DELETE' })
    ElMessage.success('用户已删除')
    void load()
  } catch (e) {
    apiErr(e)
  }
}
</script>

<template>
  <div class="manage-page user-manage">
    <!-- Toolbar：搜索 + 刷新 + 计数（对齐任务/日程管理页） -->
    <div class="manage-toolbar">
      <el-input
        v-model="searchQuery"
        :prefix-icon="Search"
        placeholder="搜索邮箱..."
        clearable
        style="width: 240px"
      />
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      <span class="toolbar-stat">共 {{ filteredUsers.length }} 个用户</span>
    </div>

    <!-- Table -->
    <el-alert
      v-if="errMsg"
      :title="errMsg"
      type="error"
      show-icon
      :closable="false"
      class="err-alert"
    />
    <el-table v-else v-loading="loading" :data="filteredUsers" stripe>
      <el-table-column prop="email" label="邮箱" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ row.email || '—' }}</template>
      </el-table-column>
      <el-table-column label="注册时间" min-width="150">
        <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="最后同步" min-width="150">
        <template #default="{ row }">{{ fmtTime(row.syncedAt) }}</template>
      </el-table-column>
      <el-table-column label="数据" width="80" align="right">
        <template #default="{ row }">{{ row.snapshotKb ? row.snapshotKb + ' KB' : '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button :icon="Key" link type="primary" @click="resetPassword(row as AdminUser)">重置密码</el-button>
          <el-tooltip
            v-if="isMe(row as AdminUser)"
            content="不能删除自己的账号"
            placement="top"
          >
            <el-button :icon="Delete" link type="danger" disabled>删除</el-button>
          </el-tooltip>
          <el-button v-else :icon="Delete" link type="danger" @click="removeUser(row as AdminUser)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <p class="admin-hint">
      管理员页面：删除账号会级联删除其云端快照，但不影响该用户浏览器中的本地数据（本地优先架构）。
    </p>
  </div>
</template>

<style scoped>
/* 布局对齐任务/日程管理页（TaskManagePage.manage-page 同构） */
.manage-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  overflow-y: auto;
  box-sizing: border-box;
}

.manage-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex-shrink: 0;
}

.toolbar-stat {
  font-size: var(--font-sm);
  color: var(--el-text-color-secondary);
}

.err-alert {
  flex-shrink: 0;
}

.admin-hint {
  margin-top: auto;
  padding-top: var(--space-sm);
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  flex-shrink: 0;
}

/* 操作列三个 link 按钮一行放下（图标+文字的紧凑内边距） */
:deep(.el-table .el-button + .el-button) {
  margin-left: 8px;
}
</style>
