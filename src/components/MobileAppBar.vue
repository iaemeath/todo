<template>
  <!-- 移动端统一顶条（三段式，所有移动页面同构）：
       左 汉堡（开导航抽屉，单一实现）| 中 #center 插槽（主页时间选择器）或 title 居中标题
       | 右 #right 插槽（主页 月/待办开关，其他页预留）。
       灰带形态与 CalendarToolbar / TodoSidebar .sidebar-header 同构：
       三处用同一 calc 定高（--space-md 顶边 + 44 内容 + 1px 底边）几何严格相等 -->
  <div class="mobile-app-bar">
    <div class="mobile-app-bar__side">
      <button class="mobile-app-bar__burger" title="导航菜单" @click="setNavDrawerOpen(true)">
        <Menu :size="20" />
      </button>
    </div>
    <div class="mobile-app-bar__center">
      <slot name="center">
        <span v-if="title" class="mobile-app-bar__title">{{ title }}</span>
      </slot>
    </div>
    <div class="mobile-app-bar__side mobile-app-bar__side--right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
/** 移动端统一顶条：汉堡直连 ui store；中央/右侧由调用方以插槽定制（主页时间选择器/开关）。 */
import { Menu } from 'lucide-vue-next'
import { useUIStore } from '../stores'

defineProps<{ title?: string }>()

const { setNavDrawerOpen } = useUIStore()
</script>

<style scoped>
.mobile-app-bar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: calc(44px + var(--space-md) + 1px); /* 移动 53，与日历工具条/待办头部严格相等 */

  /* 上下边框不对称（灰顶边 / 1px 底边），flex 只在内容盒居中会整体偏下；
     补「边框差」等量 padding-bottom 抬回视觉中心（同 CalendarToolbar 灰带） */
  padding: 0 var(--space-md) calc(var(--space-md) - 1px);
  border-top: var(--space-md) solid var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

/* 左右等宽占位保证中央严格居中（沿用 CalendarToolbar __side 模式） */
.mobile-app-bar__side {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.mobile-app-bar__side--right {
  justify-content: flex-end;
  gap: var(--space-sm);
}

.mobile-app-bar__center {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* 汉堡：透明底图标按钮，热区达标 var(--touch-target)（移动 44px） */
.mobile-app-bar__burger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.mobile-app-bar__burger:hover {
  background: var(--el-fill-color); /* 灰带上 hover 需更深一档可见（同日历工具条按钮） */
  color: var(--el-color-primary);
}

/* 居中标题：规格对齐待办头部 h2（--font-md + semibold） */
.mobile-app-bar__title {
  font-size: var(--font-md);
  font-weight: var(--weight-semibold);
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
