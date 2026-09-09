<template>
  <el-dialog
    :model-value="visible"
    title="键盘快捷键"
    width="520px"
    append-to-body
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="sc-help">
      <section v-for="group in groups" :key="group.title" class="sc-help__group">
        <h3>{{ group.title }}</h3>
        <div v-for="row in group.rows" :key="row.label" class="sc-help__row">
          <span class="sc-help__label">{{ row.label }}</span>
          <span class="sc-help__keys">
            <kbd v-for="key in row.keys" :key="key">{{ key }}</kbd>
          </span>
        </div>
      </section>
    </div>
    <template #footer>
      <span class="sc-help__hint">按 <kbd>?</kbd> 随时呼出本页 · 仅桌面端生效</span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [v: boolean] }>()

interface HelpRow { label: string; keys: string[] }
interface HelpGroup { title: string; rows: HelpRow[] }

const groups: HelpGroup[] = [
  {
    title: '全局',
    rows: [
      { label: '快捷键帮助', keys: ['?'] },
      { label: '关闭弹层 / 登录页返回', keys: ['Esc'] }
    ]
  },
  {
    title: '主页 · 时间管理',
    rows: [
      { label: '回到今天', keys: ['T'] },
      { label: '新建日程', keys: ['C'] },
      { label: '上一 / 下一时段', keys: ['←', '→'] },
      { label: '单日 / 周区间 / 月视图', keys: ['1', '2', '3'] },
      { label: '复制选中日程到后一天', keys: ['Ctrl', 'V'] },
      { label: '删除选中日程（可撤销）', keys: ['Del'] },
      { label: '取消选中', keys: ['Esc'] }
    ]
  },
  {
    title: '设置',
    rows: [{ label: '上 / 下个设置分区', keys: ['↑', '↓'] }]
  },
  {
    title: '屏保',
    rows: [{ label: '退出屏保回主页', keys: ['任意键'] }]
  }
]
</script>

<style scoped>
.sc-help {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.sc-help__group h3 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.sc-help__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-xs) 0;
}

.sc-help__label {
  font-size: var(--font-base);
}

.sc-help__keys {
  display: inline-flex;
  gap: var(--space-xs);
}

.sc-help kbd {
  display: inline-block;
  min-width: 22px;
  padding: 1px 6px;
  text-align: center;
  font-family: var(--font-family);
  font-size: var(--font-xs);
  color: var(--text-primary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
}

.sc-help__hint {
  font-size: var(--font-xs);
  color: var(--text-secondary);
}
</style>
