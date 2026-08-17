<script setup lang="ts">
import { Moon, Sunny } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useThemeStore, type Settings } from '../stores'

const props = defineProps<{ form: Settings }>()

const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore) // state → storeToRefs
const { toggleTheme } = themeStore // action 直接解构

// 时间范围联动钳制：startHour >= endHour 会让 FC 网格（slotMinTime > slotMaxTime）异常
const onStartHourChange = (v: number | undefined) => {
  if (v == null) return
  if (v >= props.form.endHour) props.form.endHour = Math.min(24, v + 1)
}
const onEndHourChange = (v: number | undefined) => {
  if (v == null) return
  if (v <= props.form.startHour) props.form.startHour = Math.max(0, v - 1)
}
</script>

<template>
  <el-form label-position="top" class="settings-form">
    <!-- 界面主题 -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">界面主题</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">暗黑模式</span>
          <span class="setting-desc">切换深色 / 浅色主题</span>
        </div>
        <el-switch
          :model-value="isDark"
          @change="toggleTheme"
          :active-icon="Moon"
          :inactive-icon="Sunny"
          size="large"
        />
      </div>
    </el-card>

    <!-- 主题色 -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">主题色</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">主题色</span>
          <span class="setting-desc">自定义应用主色调（按钮 / 高亮 / 菜单等）</span>
        </div>
        <el-color-picker v-model="form.primaryColor" />
      </div>
    </el-card>

    <!-- 日历画布与密度 -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">日历画布与密度</span></template>
      <el-form-item label="时间范围（小时）">
        <div class="dual-input">
          <el-input-number v-model="form.startHour" :min="0" :max="23" controls-position="right" @change="onStartHourChange" />
          <span class="range-sep">~</span>
          <el-input-number v-model="form.endHour" :min="1" :max="24" controls-position="right" @change="onEndHourChange" />
        </div>
      </el-form-item>
      <el-form-item label="时行数（一个小时划分为几行）">
        <el-select v-model="form.slotDuration" class="control-width">
          <el-option label="1 行 / 小时 (每行 60 分钟)" value="01:00:00" />
          <el-option label="2 行 / 小时 (每行 30 分钟)" value="00:30:00" />
          <el-option label="3 行 / 小时 (每行 20 分钟)" value="00:20:00" />
          <el-option label="4 行 / 小时 (每行 15 分钟)" value="00:15:00" />
          <el-option label="6 行 / 小时 (每行 10 分钟)" value="00:10:00" />
        </el-select>
      </el-form-item>
      <el-form-item :label="`行高度（单格高度）: ${form.slotHeight}px`">
        <el-slider v-model="form.slotHeight" :min="20" :max="120" :step="2" class="control-width" />
      </el-form-item>
    </el-card>

    <!-- 整点网格控制 -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">网格控制（整点）</span></template>
      <el-form-item :label="`整点分割线粗细: ${form.majorLineWidth}px`">
        <el-slider v-model="form.majorLineWidth" :min="0.5" :max="4" :step="0.5" class="control-width" />
      </el-form-item>
      <el-form-item :label="`整点分割线颜色深度: ${Math.round(form.majorLineOpacity * 100)}%`">
        <el-slider v-model="form.majorLineOpacity" :min="0.05" :max="1" :step="0.05" class="control-width" />
      </el-form-item>
    </el-card>

    <!-- 辅助网格控制 -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">辅助网格控制（非整点）</span></template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">显示非整点辅助细线</span>
          <span class="setting-desc">关闭后网格将呈现极简的纯小时块</span>
        </div>
        <el-switch v-model="form.showMinorLines" />
      </div>
      <template v-if="form.showMinorLines">
        <el-divider />
        <el-form-item :label="`辅助细线粗细: ${form.minorLineWidth}px`">
          <el-slider v-model="form.minorLineWidth" :min="0.5" :max="3" :step="0.5" class="control-width" />
        </el-form-item>
        <el-form-item :label="`辅助细线颜色深度: ${Math.round(form.minorLineOpacity * 100)}%`">
          <el-slider v-model="form.minorLineOpacity" :min="0.05" :max="1" :step="0.05" class="control-width" />
        </el-form-item>
      </template>
    </el-card>

    <!-- 当前时刻指示线 -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">当前时刻指示线</span></template>
      <el-form-item label="线条颜色">
        <el-color-picker v-model="form.nowIndicatorColor" show-alpha color-format="rgb" />
      </el-form-item>
      <el-form-item :label="`线条粗细: ${form.nowIndicatorHeight}px`">
        <el-slider v-model="form.nowIndicatorHeight" :min="1" :max="6" :step="0.5" class="control-width" />
      </el-form-item>
    </el-card>
  </el-form>
</template>
