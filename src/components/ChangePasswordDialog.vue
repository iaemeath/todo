<template>
  <!-- 修改密码弹窗（账号菜单入口；append-to-body 不受侧栏/抽屉裁剪） -->
  <el-dialog v-model="visible" title="修改密码" :width="isMobile ? '92vw' : '420px'" append-to-body>
    <div class="pwd-dialog-form">
      <el-input v-model="pwdForm.oldPassword" type="password" placeholder="原密码" show-password />
      <el-input
        v-model="pwdForm.newPassword"
        type="password"
        placeholder="新密码（8~64 位，含字母和数字）"
        show-password
        @blur="checkPwd"
      />
      <div v-if="pwdHint" class="pwd-hint">{{ pwdHint }}</div>
      <el-input
        v-model="pwdForm.confirmPassword"
        type="password"
        placeholder="确认新密码（再输入一遍）"
        show-password
        @keyup.enter="submitPassword"
      />
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="savingPwd" @click="submitPassword">修改密码</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/** 修改密码弹窗：原密码 + 新密码×2（前后端共享弱口令策略） */
import { ref, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores'
import { api, ApiError } from '../services/apiClient'
import { validatePassword } from '../types/password'

const visible = defineModel<boolean>('visible', { default: false })

const authStore = useAuthStore()
const { isMobile } = storeToRefs(useUIStore())

const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const savingPwd = ref(false)
const pwdHint = ref('')

const checkPwd = () => {
  const r = validatePassword(pwdForm.newPassword, authStore.user?.email || '')
  pwdHint.value = pwdForm.newPassword && !r.ok ? r.reason : ''
}

const submitPassword = async () => {
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
    const r = await api<{ token: string }>('/auth/password', {
      method: 'PUT',
      body: { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }
    })
    // 改密 bump token_ver（其他设备旧 token 即时失效）；本设备换新 token 无缝续期
    authStore.updateToken(r.token)
    ElMessage.success('密码已修改，其他设备已退出登录')
    visible.value = false
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

<style scoped>
/* 修改密码弹窗表单：纵向排列 */
.pwd-dialog-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.pwd-hint {
  margin-top: calc(var(--space-xs) * -0.5);
  font-size: var(--font-xs);
  color: var(--el-color-danger);
  line-height: 1.4;
}
</style>
