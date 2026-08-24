<script setup lang="ts">
/**
 * 登录/注册/忘记密码页（全屏，替代原弹窗）：游客随时可用全部功能，登录开启多设备云同步。
 * v4.2 邮箱体系：注册需邮箱验证码验真（先过图形人机验证），忘记密码走邮箱验证码重置。
 * 弱口令策略与 server 共享（src/types/password.ts 类型下沉），失焦即时提示 + 提交时把关。
 */
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Lock, Postcard, Key, Message, CircleCheck } from '@element-plus/icons-vue'
import { useUIStore } from '../stores'
import { useAuthStore } from '../stores/auth'
import { api, ApiError } from '../services/apiClient'
import { validatePassword, EMAIL_RE } from '../types/password'

const uiStore = useUIStore()
const authStore = useAuthStore()

type Mode = 'login' | 'register' | 'forgot'
const mode = ref<Mode>('login')
const loading = ref(false)

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  inviteCode: '',
  captcha: '',       // 图形码答案（算术题）
  mailCode: ''       // 邮箱验证码
})

/** 密码失焦弱口令即时提示（不阻断输入，提交时再把关） */
const pwdHint = ref('')
const checkPwd = () => {
  pwdHint.value = form.password && !validatePassword(form.password, form.email).ok
    ? validatePassword(form.password, form.email).reason
    : ''
}

// ===== 图形验证码（人机验证）：注册取码/忘记密码取码共用 =====
const captcha = ref<{ id: string; svg: string } | null>(null)
const loadCaptcha = async () => {
  captcha.value = await api<{ id: string; svg: string }>('/auth/captcha')
  form.captcha = ''
}
watch(mode, (m) => {
  // 进入需要人机验证的形态时预取图形码；离开时清掉（旧码已随验证销毁）
  if (m === 'register' || m === 'forgot') void loadCaptcha()
  else captcha.value = null
})

// ===== 邮箱验证码发送（60s 倒计时；register/forgot 两形态分别调各自接口） =====
const sending = ref(false)
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const startCountdown = () => {
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) { clearInterval(timer); timer = null }
  }, 1000)
}

const sendMailCode = async () => {
  if (!EMAIL_RE.test(form.email.trim().toLowerCase())) {
    ElMessage.warning('请先输入正确的邮箱')
    return
  }
  if (!form.captcha.trim()) {
    ElMessage.warning('请先输入图形验证码的答案')
    return
  }
  sending.value = true
  try {
    if (mode.value === 'register') {
      // 注册取码带上密码/邀请码：服务端做弱口令与唯一性预检，避免明显无效的注册发码
      await api('/auth/register/code', {
        method: 'POST',
        body: {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          captchaId: captcha.value?.id,
          captchaCode: form.captcha.trim(),
          inviteCode: form.inviteCode.trim() || undefined
        }
      })
    } else {
      await api('/auth/forgot', {
        method: 'POST',
        body: {
          email: form.email.trim().toLowerCase(),
          captchaId: captcha.value?.id,
          captchaCode: form.captcha.trim()
        }
      })
    }
    startCountdown()
    // 防枚举统一文案（与服务端一致；无论邮箱是否注册都这么提示）
    ElMessage.success(mode.value === 'register' ? '验证码已发送，请查收邮箱' : '若该邮箱已注册，验证码已发送，请查收')
    void loadCaptcha() // 图形码已销毁，换新图
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '发送失败，请稍后重试')
    void loadCaptcha() // 答错/过期也已销毁，换新图重来
  } finally {
    sending.value = false
  }
}

// ===== 提交 =====
const submit = async () => {
  const email = form.email.trim().toLowerCase()

  if (!EMAIL_RE.test(email)) {
    ElMessage.warning('请输入正确的邮箱')
    return
  }

  if (mode.value === 'login') {
    if (!form.password) { ElMessage.warning('请输入密码'); return }
    loading.value = true
    try {
      await authStore.login(email, form.password)
      ElMessage.success(`欢迎回来，${authStore.user?.nickname || email}`)
      uiStore.closeAuth()
    } catch (e) {
      ElMessage.error(e instanceof ApiError ? e.message : '登录失败，请稍后重试')
    } finally {
      loading.value = false
    }
    return
  }

  // register / forgot 共用：弱口令 + 两次密码一致
  const pwdCheck = validatePassword(form.password, email)
  if (!pwdCheck.ok) { ElMessage.warning(pwdCheck.reason); return }
  if (form.password !== form.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  if (!form.mailCode.trim()) {
    ElMessage.warning('请输入邮箱验证码')
    return
  }

  loading.value = true
  try {
    if (mode.value === 'register') {
      await authStore.register(
        email,
        form.password,
        form.nickname.trim() || undefined,
        form.inviteCode.trim() || undefined,
        form.mailCode.trim()
      )
      ElMessage.success('注册成功，已自动登录')
      uiStore.closeAuth()
    } else {
      await api('/auth/reset', {
        method: 'POST',
        body: { email, code: form.mailCode.trim(), password: form.password }
      })
      ElMessage.success('密码已重置，请用新密码登录')
      mode.value = 'login'
      form.password = ''
      form.confirmPassword = ''
      form.mailCode = ''
      pwdHint.value = ''
    }
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 切形态清敏感字段（邮箱保留方便连续操作）
const switchMode = (m: Mode) => {
  mode.value = m
  form.password = ''
  form.confirmPassword = ''
  form.mailCode = ''
  form.captcha = ''
  pwdHint.value = ''
}

// 已登录状态误入登录页 → 直接送回来源页
watch(
  () => authStore.isLoggedIn,
  (v) => {
    if (v && uiStore.currentView === 'auth') uiStore.closeAuth()
  },
  { immediate: true }
)

const submitLabel = computed(() =>
  mode.value === 'login' ? '登录' : mode.value === 'register' ? '注册并登录' : '重置密码'
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

      <!-- 模式切换（忘记密码形态收起，用返回链接回登录） -->
      <div v-if="mode !== 'forgot'" class="auth-tabs">
        <button class="auth-tab" :class="{ active: mode === 'login' }" @click="switchMode('login')">
          登录
        </button>
        <button class="auth-tab" :class="{ active: mode === 'register' }" @click="switchMode('register')">
          注册
        </button>
      </div>
      <button v-else class="auth-link auth-back" @click="switchMode('login')">
        ← 返回登录
      </button>

      <div class="auth-form">
        <el-input
          v-model="form.email"
          placeholder="邮箱"
          :prefix-icon="Message"
          :disabled="loading"
          @keyup.enter="submit"
        />

        <!-- 登录态：仅密码 -->
        <el-input
          v-if="mode === 'login'"
          v-model="form.password"
          type="password"
          placeholder="密码"
          :prefix-icon="Lock"
          show-password
          :disabled="loading"
          @keyup.enter="submit"
        />

        <template v-else>
          <template v-if="mode === 'register'">
            <el-input
              v-model="form.nickname"
              placeholder="昵称（选填）"
              :prefix-icon="Postcard"
              :disabled="loading"
              maxlength="30"
            />
          </template>

          <!-- 密码 + 弱口令即时提示 + 确认密码 -->
          <el-input
            v-model="form.password"
            type="password"
            :placeholder="mode === 'register' ? '密码（8~64 位，含字母和数字）' : '新密码（8~64 位，含字母和数字）'"
            :prefix-icon="Lock"
            show-password
            :disabled="loading"
            @blur="checkPwd"
          />
          <div v-if="pwdHint" class="pwd-hint">{{ pwdHint }}</div>
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="确认密码（再输入一遍）"
            :prefix-icon="Lock"
            show-password
            :disabled="loading"
            @keyup.enter="submit"
          />

          <!-- 图形人机验证 -->
          <div class="captcha-row">
            <!-- eslint-disable-next-line vue/no-v-html -- 服务端生成的验证码 SVG，内容可信 -->
            <div class="captcha-img" title="点击刷新" @click="loadCaptcha" v-html="captcha?.svg"></div>
            <el-input
              v-model="form.captcha"
              placeholder="计算结果"
              :disabled="loading"
              @keyup.enter="sendMailCode"
            />
          </div>

          <!-- 邮箱验证码 -->
          <div class="mail-code-row">
            <el-input
              v-model="form.mailCode"
              placeholder="邮箱验证码"
              :prefix-icon="CircleCheck"
              :disabled="loading"
              maxlength="6"
              @keyup.enter="submit"
            />
            <el-button
              :disabled="countdown > 0 || sending || loading"
              :loading="sending"
              @click="sendMailCode"
            >
              {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
            </el-button>
          </div>

          <el-input
            v-if="mode === 'register'"
            v-model="form.inviteCode"
            placeholder="邀请码（未开启邀请制可留空）"
            :prefix-icon="Key"
            :disabled="loading"
            @keyup.enter="submit"
          />
        </template>

        <el-button type="primary" class="auth-submit" :loading="loading" @click="submit">
          {{ submitLabel }}
        </el-button>

        <button v-if="mode === 'login'" class="auth-link" @click="switchMode('forgot')">
          忘记密码？
        </button>
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
  max-height: 100%; /* 注册表单较长时卡片内滚 */
  overflow-y: auto;
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

/* 弱口令即时提示 */
.pwd-hint {
  margin-top: calc(var(--space-xs) * -0.5);
  font-size: var(--font-xs);
  color: var(--el-color-danger);
  line-height: 1.4;
}

/* 图形验证码行：图片 + 答案输入 */
.captcha-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.captcha-img {
  flex-shrink: 0;
  width: 120px;
  height: 40px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
}

.captcha-img :deep(svg) {
  display: block;
}

/* 邮箱验证码行：输入 + 发送按钮 */
.mail-code-row {
  display: flex;
  gap: var(--space-sm);
}

.mail-code-row .el-button {
  flex-shrink: 0;
}

/* 文字链接（忘记密码 / 返回登录） */
.auth-link {
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  font-size: var(--font-xs);
  cursor: pointer;
  padding: 2px 0;
}

.auth-link:hover {
  text-decoration: underline;
}

.auth-back {
  align-self: flex-start;
  margin-bottom: var(--space-md);
}
</style>
