<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Calendar, Monitor, Iphone, Compass } from '@element-plus/icons-vue'
import { isShellApp, getServerUrl } from '../services/apiClient'

/**
 * 关于页：产品说明 + 三端下载（游客可达的分发入口）。
 * 版本数据动态取自更新源 latest.yml（electron-updater 同一数据源），
 * 拉取失败时回退 __APP_VERSION__ 推导——页面永不因网络问题空白。
 */

const latestVersion = ref('')
const latestDate = ref('')
const exeUrl = ref('')

const semver = computed(() => (latestVersion.value || __APP_VERSION__).split('.').slice(0, 3).join('.'))
const apkUrl = computed(() => `updates/shiguang-${semver.value}-debug.apk`)
const releaseText = computed(() =>
  latestDate.value ? `${latestVersion.value}（${latestDate.value.slice(0, 10)} 发布）` : latestVersion.value || __APP_VERSION__
)

onMounted(async () => {
  try {
    // 网页同源相对路径；原生壳（Electron/Capacitor）指向配置的服务器地址
    const base = isShellApp ? getServerUrl() : ''
    const r = await fetch(`${base}/updates/latest.yml?t=${Date.now()}`)
    if (!r.ok) return
    const yml = await r.text()
    const v = yml.match(/^version:\s*(.+)$/m)?.[1]?.trim()
    const u = yml.match(/^  - url:\s*(.+)$/m)?.[1]?.trim()
    const d = yml.match(/^releaseDate:\s*'?([^'\n]+)'?/m)?.[1]?.trim()
    if (v) latestVersion.value = v
    if (d) latestDate.value = d
    // exe 文件名含中文，下载链接需 URL 编码（yml 里的 url 是原始文件名）
    if (u) exeUrl.value = `updates/${encodeURIComponent(u)}`
  } catch {
    // 更新源不可达（离线/开发环境）——回退当前版本推导，链接仍可给
  }
})
</script>

<template>
  <div class="about-page">
    <!-- 产品标识 -->
    <header class="about-hero">
      <el-icon class="hero-icon"><Calendar /></el-icon>
      <div class="hero-text">
        <h1 class="hero-title">拾光</h1>
        <p class="hero-slogan">捡拾时光 —— AI 驱动的日历待办应用</p>
      </div>
      <span class="hero-version">{{ releaseText }}</span>
    </header>

    <!-- 产品说明 -->
    <section class="about-card">
      <h2 class="card-title">这是什么</h2>
      <p class="card-text">
        拾光把日历、待办与日程排期放进一块画布：左侧月历承载全部日程，右侧待办即拖即排。
        数据以本地优先——不登录也能完整使用，所有内容保存在设备上；
        登录后开启多设备云同步，手机、电脑、网页三端数据保持一致。
      </p>
      <ul class="feature-list">
        <li>任务树（最多三级）+ 独立日程，叶子任务拖入日历即完成排期</li>
        <li>本地优先架构：离线可用，登录后自动记录级同步（增量 + 断点续传）</li>
        <li>桌面端到点提醒、托盘常驻；移动端手势适配</li>
        <li>AI 助理：自然语言创建任务/日程，本地大模型或云端模式可选</li>
      </ul>
    </section>

    <!-- 三端下载 -->
    <section class="about-card">
      <h2 class="card-title">下载与使用</h2>
      <div class="download-grid">
        <div class="download-item">
          <el-icon class="dl-icon"><Compass /></el-icon>
          <h3 class="dl-title">网页版</h3>
          <p class="dl-desc">当前页面即是，浏览器打开即用，无需安装</p>
          <p class="dl-note">推荐先在这里体验全部功能</p>
        </div>
        <div class="download-item">
          <el-icon class="dl-icon"><Monitor /></el-icon>
          <h3 class="dl-title">Windows 桌面版</h3>
          <p class="dl-desc">到点提醒 / 托盘常驻 / 自动更新</p>
          <a v-if="exeUrl" class="dl-link" :href="exeUrl" download>下载安装包</a>
          <p class="dl-note">已安装的用户启动后自动升级</p>
        </div>
        <div class="download-item">
          <el-icon class="dl-icon"><Iphone /></el-icon>
          <h3 class="dl-title">Android 版</h3>
          <p class="dl-desc">手机浏览器点击下载后直接安装</p>
          <a class="dl-link" :href="apkUrl" download>下载 APK</a>
          <p class="dl-note">当前为测试签名（debug），安装时需允许未知来源</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about-page {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.about-hero {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
  border-radius: var(--el-border-radius-base);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
}

.hero-icon {
  font-size: 3rem;
  color: var(--el-color-primary);
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-title {
  margin: 0;
  font-size: var(--font-xl, 1.5rem);
  font-weight: var(--weight-bold, 600);
  color: var(--el-text-color-primary);
}

.hero-slogan {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-sm);
  color: var(--el-text-color-secondary);
}

.hero-version {
  flex-shrink: 0;
  font-size: var(--font-xs);
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.about-card {
  padding: var(--space-lg);
  border-radius: var(--el-border-radius-base);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
}

.card-title {
  margin: 0 0 var(--space-md);
  font-size: var(--font-base);
  font-weight: var(--weight-medium, 500);
  color: var(--el-text-color-primary);
}

.card-text {
  margin: 0 0 var(--space-md);
  font-size: var(--font-sm);
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.feature-list {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--font-sm);
  line-height: 2;
  color: var(--el-text-color-regular);
}

.download-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
}

/* 移动端：下载卡纵排 */
@media (max-width: 768px) {
  .download-grid {
    grid-template-columns: 1fr;
  }
}

.download-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  padding: var(--space-md);
  border-radius: var(--el-border-radius-base);
  border: 1px solid var(--el-border-color-lighter);
}

.dl-icon {
  font-size: 1.5rem;
  color: var(--el-color-primary);
}

.dl-title {
  margin: 0;
  font-size: var(--font-base);
  font-weight: var(--weight-medium, 500);
  color: var(--el-text-color-primary);
}

.dl-desc {
  margin: 0;
  font-size: var(--font-xs);
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  flex: 1;
}

.dl-link {
  display: inline-block;
  margin-top: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--el-border-radius-base);
  background: var(--el-color-primary);
  color: #fff;
  font-size: var(--font-sm);
  text-decoration: none;
  cursor: pointer;
}

.dl-link:hover {
  background: var(--el-color-primary-light-3);
}

.dl-note {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--el-text-color-placeholder);
}
</style>
