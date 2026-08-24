<script setup lang="ts">
/**
 * 登录/注册页（全屏，替代原弹窗）：游客随时可用全部功能，登录开启多设备云同步。
 * 登录成功回来源页（ui store openAuth 记录）；已登录误入时直接送回。
 */
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, Postcard, Key } from '@element-plus/icons-vue'
import { useUIStore } from '../stores'
import { useAuthStore } from '../stores/auth'
import { ApiError } from '../services/apiClient'

const uiStore = useUIStore()
const authStore = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
  nickname: '',
  inviteCode: ''
})

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

const submit = async () => {
  const username = form.username.trim()
  const password = form.password

  if (!USERNAME_RE.test(username)) {
    ElMessage.warning('用户名需 3~20 位字母/数字/下划线')
    return
  }
  if (password.length < 6 || password.length > 64) {
    ElMessage.warning('密码长度需 6~64 位')
    return
  }

  loading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login(username, password)
      ElMessage.success(`欢迎回来，${authStore.user?.nickname || authStore.user?.username}`)
    } else {
      await authStore.register(
        username,
        password,
        form.nickname.trim() || undefined,
        form.inviteCode.trim() || undefined
      )
      ElMessage.success('注册成功，已自动登录')
    }
    uiStore.closeAuth()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 已登录状态误入登录页 → 直接送回来源页
watch(
  () => authStore.isLoggedIn,
  (v) => {
    if (v && uiStore.currentView === 'auth') uiStore.closeAuth()
  },
  { immediate: true }
)
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- 品牌头 -->
      <div class="auth-brand">
        <span class="auth-logo"></span>
        <span class="auth-title">拾光</span>
        <span class="auth-subtitle">登录后开启 ☁️ 多设备云同步</span>
      </div>

      <!-- 模式切换（贴合项目 segmented 风格） -->
      <div class="auth-tabs">
        <button class="auth-tab" :class="{ active: mode === 'login' }" @click="mode = 'login'">
          登录
        </button>
        <button class="auth-tab" :class="{ active: mode === 'register' }" @click="mode = 'register'">
          注册
        </button>
      </div>

      <div class="auth-form">
        <el-input
          v-model="form.username"
          placeholder="用户名（3~20 位字母/数字/下划线）"
          :prefix-icon="User"
          :disabled="loading"
          @keyup.enter="submit"
        />
        <el-input
          v-model="form.password"
          type="password"
          placeholder="密码（6~64 位）"
          :prefix-icon="Lock"
          show-password
          :disabled="loading"
          @keyup.enter="submit"
        />
        <template v-if="mode === 'register'">
          <el-input
            v-model="form.nickname"
            placeholder="昵称（选填）"
            :prefix-icon="Postcard"
            :disabled="loading"
            maxlength="30"
          />
          <el-input
            v-model="form.inviteCode"
            placeholder="邀请码（未开启邀请制可留空）"
            :prefix-icon="Key"
            :disabled="loading"
            @keyup.enter="submit"
          />
        </template>

        <el-button type="primary" class="auth-submit" :loading="loading" @click="submit">
          {{ mode === 'login' ? '登录' : '注册并登录' }}
        </el-button>
      </div>

      <div class="auth-hint">
        未登录可继续作为游客在本机使用全部基础功能（数据仅存于本浏览器）。
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  box-sizing: border-box;
  /* 移动端 content-area 零内边距，页面自补 */
  overflow-y: auto;
  background: url('../assets/auth-bg.jpg') center / cover no-repeat;
}

/* 暗化遮罩：保证深浅两种模式与亮色壁纸下的表单可读性（卡片玻璃透出背景） */
.auth-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(15, 18, 34, 0.45);
}

.auth-card {
  position: relative; /* 浮于遮罩之上 */
  z-index: 1;
  width: 100%;
  max-width: 380px;
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-sizing: border-box;
  /* 玻璃拟态：与项目 glass-panel 语言一致，暗化底保证文字对比度 */
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}

/* scoped 下 html.dark 不带本组件属性，须 :global 提升才能命中暗色根类 */
:global(html.dark) .auth-card {
  background: rgba(30, 33, 48, 0.72);
  border-color: rgba(255, 255, 255, 0.12);
}

/* 品牌头：logo 圆点用主题色呼应 */
.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
}

.auth-logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  margin-bottom: var(--space-xs);
}

.auth-title {
  font-size: 1.3rem;
  font-weight: var(--weight-bold);
  color: var(--el-text-color-primary);
}

.auth-subtitle {
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
}

.auth-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--el-fill-color-light);
}

.auth-tab {
  flex: 1;
  padding: var(--space-xs) 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.auth-tab.active {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  font-weight: var(--weight-semibold);
  box-shadow: var(--shadow-sm);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.auth-submit {
  margin-top: var(--space-xs);
  width: 100%;
}

.auth-hint {
  margin-top: var(--space-md);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
