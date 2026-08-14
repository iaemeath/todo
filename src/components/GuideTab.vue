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
// daterange 时间选择器）与 TodoSidebar.vue（排序把手/拖拽排期/删除）及 AppNavBar.vue（导航）
const webSections: GuideSection[] = [
  {
    title: '📅 日历区',
    entries: [
      { action: '单击空白时间格', desc: '新增日程，默认时长 1 小时' },
      { action: '按住左键拖选时段', desc: '框选一段时段后松开，新增日程并自动预填精确的起止时间' },
      { action: '右击日程块', desc: '打开编辑弹窗：修改标题、日期、起止时间、颜色，或删除日程' },
      { action: '按住左键拖动日程', desc: '把日程移动到其他日期或时间，松开即保存' },
      { action: '拖动日程上下边缘', desc: '拉长或缩短日程时长' }
    ]
  },
  {
    title: '🕐 顶部中央时间选择器（日期导航）',
    entries: [
      { action: '点开选择日期范围', desc: '唯一的日期导航入口——原工具栏的 ‹ › 今天 与 月 / 周 / 日 按钮已移除，翻页和视图切换全部通过它完成' },
      { action: '选 1 天', desc: '切换到日视图，只展示所选当天' },
      { action: '选 2 ~ 7 天', desc: '切换到周视图，展示起始日所在的一周' },
      { action: '选 7 天以上', desc: '切换到月视图，展示起始日所在的整个月' },
      { action: '双向同步', desc: '选择器实时回显日历当前展示的日期范围，两者始终保持一致' }
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
      { action: '轻点空白时间格', desc: '新增日程，默认时长 1 小时' },
      { action: '双击日程（快速轻点两次）', desc: '打开编辑弹窗：修改标题、日期、起止时间、颜色，或删除日程' },
      { action: '按住日程块拖动', desc: '移动日程到其他时间；拖动日程边缘可调整时长' },
      { action: '左右滑动翻页', desc: '在日历上快速左滑看下一天、右滑看上一天（周 / 月视图时按周 / 月步进），中央选择器自动跟随' },
      { action: '顶部中央时间选择器', desc: '点开面板直接跳转到任意日期' }
    ]
  },
  {
    title: '✅ 待办浮层（右侧滑出）',
    entries: [
      { action: '右上角面板按钮', desc: '打开待办浮层（覆盖约 60% 屏宽）' },
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
.guide-tab {
  max-width: 860px;
}

.guide-section {
  margin-bottom: 24px;
}

.guide-section-title {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
}

.guide-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.guide-row:last-child {
  border-bottom: none;
}

.guide-action {
  flex-shrink: 0;
  min-width: 130px;
  max-width: 230px;
  padding: 3px 10px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
  font-size: 0.85rem;
  line-height: 1.5;
  text-align: center;
  box-sizing: border-box;
}

.guide-desc {
  flex: 1;
  font-size: 0.88rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  padding-top: 2px;
}

/* 窄屏：操作标签与说明上下堆叠 */
@media (max-width: 768px) {
  .guide-row {
    flex-direction: column;
    gap: 4px;
  }
  .guide-action {
    min-width: 0;
    max-width: none;
    align-self: flex-start;
  }
  .guide-desc {
    padding-top: 0;
  }
}
</style>
