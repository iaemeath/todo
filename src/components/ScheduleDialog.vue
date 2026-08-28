<template>
  <el-dialog
    :model-value="visible"
    :title="header"
    :width="isMobile ? '92vw' : '480px'"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <!-- 顶部提示段（排期场景的"将任务排入日历"等），由调用方以插槽注入 -->
    <slot name="hint" />
    <el-form label-position="top">
      <el-form-item v-if="showTitle" label="标题">
        <el-input v-model="form.title" placeholder="请输入日程标题" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          maxlength="200"
          placeholder="日程描述（可选，屏保任务卡与日历悬浮展示）"
        />
      </el-form-item>
      <el-form-item label="日期">
        <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%;" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="开始时间">
            <el-time-picker v-model="form.startTime" value-format="HH:mm" format="HH:mm" placeholder="开始" style="width: 100%;" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="结束时间">
            <el-time-picker v-model="form.endTime" value-format="HH:mm" format="HH:mm" placeholder="结束" style="width: 100%;" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="颜色">
        <el-select v-model="form.color" style="width: 100%;">
          <el-option v-for="c in colorOptions" :key="c.value" :label="c.label" :value="c.value">
            <span class="schedule-color-dot" :style="{ background: c.hex }"></span>
            <span style="margin-left: 8px;">{{ c.label }}</span>
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button v-if="showDelete" type="danger" @click="emit('delete')">删除</el-button>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="confirm">{{ confirmText }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { colorOptions } from '../constants/colors'
import { useUIStore } from '../stores'

/**
 * 日程弹窗（单一数据源）：CalendarArea 新建/编辑日程与 TaskManagePage 排期共用，
 * 历史 双份手写表单（字段/校验/颜色选择器逐字重复）收敛于此。
 * 表单态与校验归组件；落库与成功提示归调用方（save 事件携带表单值）。
 */
export interface ScheduleFormValue {
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  color: string
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    /** 弹窗标题（新增日程/编辑日程/排期到日历） */
    header: string
    /** 打开时的表单初始值（调用方每次打开前构造） */
    initial: ScheduleFormValue
    /** 主按钮文案（创建/保存/创建日程） */
    confirmText?: string
    /** 排期场景无标题字段（标题取任务名），默认显示 */
    showTitle?: boolean
    /** 编辑模式显示删除按钮 */
    showDelete?: boolean
  }>(),
  { confirmText: '创建', showTitle: true, showDelete: false }
)

const emit = defineEmits<{
  'update:visible': [v: boolean]
  save: [form: ScheduleFormValue]
  delete: []
}>()

const { isMobile } = storeToRefs(useUIStore())

// 打开时从 initial 拷贝出本地可编辑副本（编辑过程中不回写调用方）
const form = ref<ScheduleFormValue>({ ...props.initial })
watch(
  () => props.visible,
  (v) => {
    if (v) form.value = { ...props.initial }
  }
)

const confirm = () => {
  const { title, date, startTime, endTime } = form.value
  if (props.showTitle && !title.trim()) { ElMessage.warning('标题不能为空'); return }
  if (!date || !startTime || !endTime) { ElMessage.warning('请填写完整的日期和时间'); return }
  if (startTime >= endTime) { ElMessage.warning('结束时间必须晚于开始时间'); return }
  emit('save', form.value)
  emit('update:visible', false)
}
</script>

<style scoped>
.schedule-color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  vertical-align: middle;
}
</style>
