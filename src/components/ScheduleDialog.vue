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
      <el-form-item v-if="showTitle" label="描述">
        <!-- 排期场景（showTitle=false）不显示：描述继承任务描述，无需手填（数据仍随表单流转载入） -->
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          maxlength="200"
          placeholder="日程描述（可选，屏保任务卡与日历悬浮展示）"
        />
      </el-form-item>
      <!-- 日期单日 + 起止时间合并为一个 is-range 时间段选择器：表单契约仍是 date/startTime/endTime 三字段 -->
      <el-form-item label="日期">
        <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%;" />
      </el-form-item>
      <el-form-item label="时间段">
        <el-time-picker
          v-model="timeRange"
          is-range
          value-format="HH:mm"
          format="HH:mm"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 100%;"
        />
      </el-form-item>
      <el-form-item label="提醒">
        <!-- 预设档 + 自定义：filterable + allow-create，直接键入分钟数回车即自定义档 -->
        <el-select v-model="remindStr" filterable allow-create style="width: 100%;">
          <el-option v-for="p in remindOptions" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-form-item>
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
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { colorOptions } from '../constants/colors'
import { REMIND_MAX, REMIND_PRESETS, formatRemindLabel, parseRemindInput } from '../constants/schedule'
import { useUIStore } from '../stores'

/**
 * 日程弹窗（单一数据源）：CalendarArea 新建/编辑日程、TaskManagePage 排期、
 * ScheduleManagePage 从任务新增共用，历史 双份手写表单（字段/校验/颜色选择器逐字重复）收敛于此。
 * 表单态与校验归组件；落库与成功提示归调用方（save 事件携带表单值）。
 * 调用方自有字段（如任务选择）经 hint 插槽注入、preValidate 校验。
 */
export interface ScheduleFormValue {
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  color: string
  /** 提前提醒分钟数（0=准时 / -1=不提醒 / N>0=提前 N 分钟），确认时经 parseRemindInput 校验 */
  remindMinutes: number
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    /** 弹窗标题（新增日程/编辑日程/排期到日历/从任务新增日程） */
    header: string
    /** 打开时的表单初始值（调用方每次打开前构造） */
    initial: ScheduleFormValue
    /** 主按钮文案（创建/保存/创建日程） */
    confirmText?: string
    /** 排期场景无标题字段（标题取任务名），默认显示 */
    showTitle?: boolean
    /** 编辑模式显示删除按钮 */
    showDelete?: boolean
    /** 调用方扩展校验（如"请选择一个任务"）：confirm 最先调用，返回错误文案即中止不关窗 */
    preValidate?: () => string | null
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

// 起止时间合并选择器（is-range 时间段）与表单两字段（startTime/endTime）的双向桥接：
// value-format 下 el-time-picker 直接产出 [start, end] 字符串元组，无需 Date 中转。
// 结束早于开始的非法区间仍由 confirm 校验拦下
const timeRange = computed({
  get: (): [string, string] => [form.value.startTime, form.value.endTime],
  set: (range: [string, string]) => {
    if (!range?.[0] || !range?.[1]) return
    form.value.startTime = range[0]
    form.value.endTime = range[1]
  }
})
// 提醒量下拉的字符串模型：allow-create 键入产出字符串，确认时统一解析校验（预设值亦转字符串对齐）
const remindStr = ref('0')
const asPresetOptions = () => REMIND_PRESETS.map((p) => ({ label: p.label, value: String(p.value) }))
/** 预设档在前；当前值非预设（自定义分钟数）时动态补一条格式化选项供回显 */
const remindOptions = computed(() => {
  if (REMIND_PRESETS.some((p) => String(p.value) === remindStr.value)) return asPresetOptions()
  const custom = parseRemindInput(remindStr.value)
  if (custom === null) return asPresetOptions()
  return [{ label: formatRemindLabel(custom), value: remindStr.value }, ...asPresetOptions()]
})
watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.value = { ...props.initial }
      remindStr.value = String(props.initial.remindMinutes ?? 0)
    }
  }
)

const confirm = () => {
  const externalError = props.preValidate?.()
  if (externalError) { ElMessage.warning(externalError); return }
  const { title, date, startTime, endTime } = form.value
  if (props.showTitle && !title.trim()) { ElMessage.warning('标题不能为空'); return }
  if (!date || !startTime || !endTime) { ElMessage.warning('请填写完整的日期和时间'); return }
  if (startTime >= endTime) { ElMessage.warning('结束时间必须晚于开始时间'); return }
  const remindMinutes = parseRemindInput(remindStr.value)
  if (remindMinutes === null) { ElMessage.warning(`提醒量需为 0~${REMIND_MAX} 的整数分钟`); return }
  emit('save', { ...form.value, remindMinutes })
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
