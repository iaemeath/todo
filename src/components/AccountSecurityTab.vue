<script setup lang="ts">
/**
 * 账号安全（登录用户）：当前邮箱（只读，登录标识）+ 自助改昵称 + 自助改密码。
 * 改密需先验原密码；新密码双输入 + 前后端共享弱口令策略（password.ts）。
 */
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { api, ApiError } from '../services/apiClient'
import { useAuthStore } from '../stores/auth'
import { validatePassword } from '../types/password'

const authStore = useAuthStore()

// ---- 改昵称 ----
const nicknameForm = reactive({ nickname: authStore.user?.nickname || '' })
const savingNickname = ref(false)

const saveNickname = async () => {
  const nickname = nicknameForm.nickname.trim()
  if (!nickname) { ElMessage.warning('昵称不能为空'); return }
  savingNickname.value = true
  try {
    await api('/auth/profile', { method: 'PUT', body: { nickname } })
    authStore.updateUser({ nickname })
    ElMessage.success('昵称已更新')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试')
  } finally {
    savingNickname.value = false
  }
}

// ---- 改密码 ----
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const savingPwd = ref(false)
const pwdHint = ref('')

const checkPwd = () => {
  const r = validatePassword(pwdForm.newPassword, authStore.user?.email || '')
  pwdHint.value = pwdForm.newPassword && !r.ok ? r.reason : ''
}

const savePassword = async () => {
  if (!pwdForm.oldPassword) { ElMessage.warning('请输入原密码'); return }
  const check = validatePassword(pwdForm.newPassword, authStore.user?.email || '')
  if (!check.ok) { ElMessage.warning(check.reason); return }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  if (pwdForm.newPassword === pwdForm.oldPassword) {
    ElMessage.warning('新密码不能与原密码相同')
    return
  }
  savingPwd.value = true
  try {
    await api('/auth/password', {
      method: 'PUT',
      body: { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }
    })
    ElMessage.success('密码已修改')
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
    pwdHint.value = ''
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试')
  } finally {
    savingPwd.value = false
  }
}
</script>

<template>
  <div class="account-security">
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">账号信息</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">登录邮箱</span>
          <span class="setting-desc">账号标识，用于登录与找回密码</span>
        </div>
        <span class="email-display">{{ authStore.user?.email || '—' }}</span>
      </div>
    </el-card>

    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">昵称</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">显示昵称</span>
          <span class="setting-desc">侧栏与同步状态中展示的名字</span>
        </div>
        <div class="dual-input">
          <el-input
            v-model="nicknameForm.nickname"
            maxlength="30"
            class="control-width"
            placeholder="昵称"
            style="width: 180px"
          />
          <el-button type="primary" :loading="savingNickname" @click="saveNickname">保存</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">修改密码</span></template>
      <div class="pwd-form">
        <el-input
          v-model="pwdForm.oldPassword"
          type="password"
          placeholder="原密码"
          show-password
          class="control-width"
        />
        <el-input
          v-model="pwdForm.newPassword"
          type="password"
          placeholder="新密码（8~64 位，含字母和数字）"
          show-password
          class="control-width"
          @blur="checkPwd"
        />
        <div v-if="pwdHint" class="pwd-hint">{{ pwdHint }}</div>
        <el-input
          v-model="pwdForm.confirmPassword"
          type="password"
          placeholder="确认新密码（再输入一遍）"
          show-password
          class="control-width"
          @keyup.enter="savePassword"
        />
        <el-button type="primary" :loading="savingPwd" @click="savePassword">修改密码</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.account-security {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 560px;
}

.email-display {
  font-size: var(--font-sm);
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.pwd-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: flex-start;
}

.pwd-hint {
  font-size: var(--font-xs);
  color: var(--el-color-danger);
  line-height: 1.4;
}
</style>
