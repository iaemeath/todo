<template>
  <div class="guide-tab">
    <div class="usage-header">
      <div>
        <h3 class="pane-title">使用指南</h3>
        <p class="pane-desc">主页（日历 + 待办）的常用操作速查，按平台切换查看对应用法。</p>
      </div>
    </div>

    <el-tabs v-model="activePlatform" class="guide-tabs">
      <el-tab-pane label="Web 端" name="web">
        <section v-for="section in webSections" :key="section.title" class="guide-section">
          <h4 class="guide-section-title">{{ section.title }}</h4>
          <div v-for="entry in section.entries" :key="entry.action" class="guide-row">
            <span class="guide-action">{{ entry.action }}</span>
            <span class="guide-desc">{{ entry.desc }}</span>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="移动端" name="mobile">
        <section v-for="section in mobileSections" :key="section.title" class="guide-section">
          <h4 class="guide-section-title">{{ section.title }}</h4>
          <div v-for="entry in section.entries" :key="entry.action" class="guide-row">
            <span class="guide-action">{{ entry.action }}</span>
            <span class="guide-desc">{{ entry.desc }}</span>
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUIStore } from '../stores'

// 按当前设备默认展示对应平台，另一平台可手动切换
const { isMobile } = storeToRefs(useUIStore())
const activePlatform = ref<'web' | 'mobile'>(isMobile.value ? 'mobile' : 'web')

interface GuideEntry {
  action: string
  desc: string
}
interface GuideSection {
  title: string
  entries: GuideEntry[]
}

// 内容与实际交互一一对应：来源 CalendarArea.vue（dateClick/select/contextmenu/eventChange/
// 工具条区间导航/滑动手势）与 TodoSidebar.vue（排序把手/拖拽排期/删除）、
// App.vue（浮层底罩关闭）及 AppNavBar.vue（导航）
const webSections: GuideSection[] = [
  {
    title: '📅 日历区',
    entries: [
      { action: '按住左键拖选时段', desc: '新增日程的唯一入口：框选一段时段后松开，自动预填精确的起止时间（单击不触发，防误触）' },
      { action: '右击日程块', desc: '打开编辑弹窗：修改标题、日期、起止时间、颜色，或删除日程' },
      { action: '按住左键拖动日程', desc: '把日程移动到其他日期或时间，松开即保存' },
      { action: '拖动日程上下边缘', desc: '拉长或缩短日程时长' }
    ]
  },
  {
    title: '🕐 顶部工具条（日期导航）',
    entries: [
      { action: '中央日期范围选择器', desc: '所见即所选：选任意 1~14 天的区间（上限可在设置中调整），日历精确展示这几天并保留时间轴；超限自动截断' },
      { action: '点 ‹ / › 按钮', desc: '整段平移当前区间（如 7 天视图一次平移 7 天）；月视图下则翻上一月 / 下一月' },
      { action: '点「月」按钮', desc: '切换到月总览：选择器变为月选择器，日历列头显示星期名；再次点击回到之前的区间视图（手机端可在设置中开关显示）' },
      { action: '点「⛶」全屏按钮', desc: '日历铺满整个视口，专注浏览；再点一次或按 Esc 退出' }
    ]
  },
  {
    title: '✅ 待办栏（右侧）',
    entries: [
      { action: '输入标题 + 回车 / ➕', desc: '新增待办事项' },
      { action: '拖住 ⠿ 把手上下拖', desc: '调整待办的显示顺序' },
      { action: '按住待办文字向左拖', desc: '拖到日历的任意时间格，将待办排期为日程' },
      { action: '点 🗑 按钮', desc: '删除该待办' },
      { action: '收起 / 展开待办栏', desc: '点右上角按钮收起待办栏让日历占满全屏；收起后点工具条右侧的展开按钮恢复' }
    ]
  },
  {
    title: '🧭 顶部导航',
    entries: [
      { action: '点「拾光」logo', desc: '从任意页面返回主页' },
      { action: '任务管理 / 日程管理 / 设置', desc: '切换到对应页面；再次点击当前页签可返回主页' }
    ]
  }
]

const mobileSections: GuideSection[] = [
  {
    title: '📅 日历区（默认按天展示）',
    entries: [
      { action: '长按空白处拖选时段', desc: '新增日程的唯一入口：按住约 1 秒后拖选时段松开，自动预填精确的起止时间（轻点不触发，防误触）' },
      { action: '双击日程（快速轻点两次）', desc: '打开编辑弹窗：修改标题、日期、起止时间、颜色，或删除日程' },
      { action: '按住日程块拖动', desc: '移动日程到其他时间；拖动日程边缘可调整时长' },
      { action: '左右滑动翻时段', desc: '单日视图快速左滑看下一天、右滑看上一天；多日区间视图则整段平移，中央选择器自动跟随' },
      { action: '顶部中央时间选择器', desc: '点开单月面板，先点起点再点终点选定区间（可跨月翻页，默认 1~7 天、上限可在设置中调整，超限自动截断），与网页端同能力' }
    ]
  },
  {
    title: '✅ 待办浮层（右侧滑出）',
    entries: [
      { action: '右上角面板按钮', desc: '打开待办浮层（覆盖约 60% 屏宽）' },
      { action: '点浮层外区域', desc: '点击浮层外的日历区域即可关闭浮层（拖拽排期时不受影响）' },
      { action: '输入标题 + ➕', desc: '新增待办事项' },
      { action: '按住待办向左拖出浮层', desc: '拖到日历的任意时间格，将待办排期为日程；松手后浮层自动收起' },
      { action: '拖住 ⠿ 把手上下拖', desc: '调整待办的显示顺序' },
      { action: '点 🗑 按钮', desc: '删除该待办' }
    ]
  },
  {
    title: '🧭 顶部导航',
    entries: [
      { action: '主页右上角三个图标', desc: '分别进入任务管理 / 日程管理 / 设置' },
      { action: '其他页面左上角 ‹ 返回', desc: '返回主页' }
    ]
  }
]
</script>

<style scoped>
/* 移动优先：基础样式 = 窄屏上下堆叠；桌面行布局在 min-width 断点增强。
   间距/字号/圆角走令牌，移动端紧凑值由 platform-mobile 自动生效。 */
.guide-tab {
  max-width: 860px;
}

.guide-section {
  margin-bottom: var(--space-xl);
}

.guide-section-title {
  font-size: var(--font-base);
  font-weight: var(--weight-bold);
  margin: 0 0 var(--space-sm);
  color: var(--el-text-color-primary);
}

.guide-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.guide-row:last-child {
  border-bottom: none;
}

.guide-action {
  align-self: flex-start;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: var(--weight-semibold);
  font-size: var(--font-sm);
  line-height: 1.5;
  text-align: center;
  box-sizing: border-box;
}

.guide-desc {
  font-size: var(--font-sm);
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

/* 桌面：操作标签与说明左右并排，标签定宽对齐 */
@media (width >= 769px) {
  .guide-row {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .guide-action {
    flex-shrink: 0;
    min-width: 130px;
    max-width: 230px;
  }
}
</style>
