<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Search, Delete, Download, CircleCheckFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAllModels, hasModelInCache, deleteModelCache as purgeModelCache, downloadModel } from '../services/webLlmManager'
import { useSettings } from '../composables/useSettings'
import type { Settings } from '../composables/useSettings'

const props = defineProps<{ form: Settings; active: boolean }>()
const { updateSettings } = useSettings()

// --- 本地模型管理 ---
const searchQuery = ref('')
const showOnlyDownloaded = ref(false)
const downloadedModels = ref<Record<string, boolean>>({})
const allModels = ref<any[]>([])

const filteredModels = computed(() => {
  let list = allModels.value
  if (showOnlyDownloaded.value) {
    list = list.filter(m => downloadedModels.value[m.model_id])
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(m => m.model_id.toLowerCase().includes(q))
  }
  return list.slice().sort((a, b) => {
    const aD = downloadedModels.value[a.model_id] ? 1 : 0
    const bD = downloadedModels.value[b.model_id] ? 1 : 0
    if (aD !== bD) return bD - aD
    const aS = props.form.localModelName === a.model_id ? 1 : 0
    const bS = props.form.localModelName === b.model_id ? 1 : 0
    return bS - aS
  }).slice(0, 50)
})

const checkCaches = async () => {
  // 模型列表异步加载（首次进入 AI tab 时触发 web-llm 懒加载）
  if (allModels.value.length === 0) {
    allModels.value = await getAllModels()
  }
  for (const model of allModels.value) {
    hasModelInCache(model.model_id).then(has => {
      if (has) downloadedModels.value[model.model_id] = true
    }).catch(() => {})
  }
}

// 进入 AI tab 时才加载模型列表（保持 web-llm 懒加载）
watch(() => props.active, (v) => { if (v) checkCaches() })
onMounted(() => { if (props.active) checkCaches() })

const deleteModelCache = async (modelId: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要从浏览器存储中彻底删除模型 [${modelId}] 的文件缓存吗？这可以释放大量磁盘空间。`,
      '删除模型缓存',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await purgeModelCache(modelId)
    downloadedModels.value[modelId] = false
    ElMessage.success('模型缓存已删除')
  } catch (action) {
    if (action !== 'cancel' && action !== 'close') {
      console.error(action)
      ElMessage.error('删除失败，可能没有权限或被占用')
    }
  }
}

const selectModel = (modelId: string) => {
  props.form.localModelName = modelId
  updateSettings({ localModelName: modelId })
}

const downloadingModels = ref<Record<string, { progress: number, text: string }>>({})

const startDownload = async (modelId: string) => {
  if (downloadingModels.value[modelId]) return
  downloadingModels.value[modelId] = { progress: 0, text: 'Preparing...' }
  try {
    await downloadModel(modelId, (report) => {
      downloadingModels.value[modelId] = { progress: report.progress, text: report.text }
    })
    downloadedModels.value[modelId] = true
    ElMessage.success(`模型 ${modelId} 下载完成`)
  } catch (e: any) {
    console.error('Failed to download model', e)
    ElMessage.error(`下载模型失败: ${e.message}`)
  } finally {
    delete downloadingModels.value[modelId]
  }
}

const save = () => {
  updateSettings({ ...props.form })
  ElMessage.success('已保存')
}
</script>

<template>
  <el-form label-position="top" class="settings-form">
    <!-- 引擎模式 -->
    <el-card shadow="never" class="setting-card">
      <template #header><span class="card-title">引擎模式选择</span></template>
      <el-radio-group v-model="form.aiMode" class="engine-radio-group">
        <el-radio value="cloud" size="large">云端 API（速度快，兼容全平台）</el-radio>
        <el-radio value="local" size="large">本地 WebLLM（断网可用，仅限高配电脑）</el-radio>
      </el-radio-group>
    </el-card>

    <!-- 本地模型库 -->
    <el-card v-if="form.aiMode === 'local'" shadow="never" class="setting-card">
      <template #header><span class="card-title">本地模型资源库</span></template>
      <div class="model-toolbar">
        <el-input
          v-model="searchQuery"
          :prefix-icon="Search"
          placeholder="搜索模型 (例如 qwen, llama...)"
          clearable
          style="flex: 1;"
        />
        <el-checkbox v-model="showOnlyDownloaded">只看已缓存</el-checkbox>
      </div>
      <el-scrollbar height="360px" class="model-list-scroll">
        <div
          v-for="model in filteredModels"
          :key="model.model_id"
          class="model-item"
          :class="{ 'is-active': form.localModelName === model.model_id }"
        >
          <div class="model-info">
            <span class="model-name">
              {{ model.model_id }}
              <span v-if="model.vram_required_MB" class="model-size">
                (~{{ (model.vram_required_MB / 1024).toFixed(1) }} GB)
              </span>
            </span>
            <el-tag v-if="downloadedModels[model.model_id]" type="success" size="small" :icon="CircleCheckFilled">
              已缓存
            </el-tag>
          </div>
          <div class="model-actions">
            <el-button
              v-if="downloadedModels[model.model_id] && !downloadingModels[model.model_id]"
              type="danger"
              text
              :icon="Delete"
              @click="deleteModelCache(model.model_id)"
            >
              释放空间
            </el-button>

            <div v-if="downloadingModels[model.model_id]" class="download-progress">
              <el-progress
                :percentage="Math.round(downloadingModels[model.model_id].progress * 100)"
                :stroke-width="14"
                striped
                striped-flow
              />
              <span class="progress-text">{{ downloadingModels[model.model_id].text }}</span>
            </div>

            <el-button
              v-else-if="!downloadedModels[model.model_id]"
              type="primary"
              plain
              :icon="Download"
              @click="startDownload(model.model_id)"
            >
              下载缓存
            </el-button>

            <el-button
              v-else-if="form.localModelName === model.model_id"
              type="success"
              disabled
            >
              当前默认
            </el-button>

            <el-button
              v-else
              type="primary"
              plain
              @click="selectModel(model.model_id)"
            >
              设为默认
            </el-button>
          </div>
        </div>
        <el-empty v-if="filteredModels.length === 0" description="没有找到匹配的模型" />
      </el-scrollbar>
    </el-card>

    <!-- 云端 API 配置 -->
    <el-card v-if="form.aiMode === 'cloud'" shadow="never" class="setting-card">
      <template #header><span class="card-title">API 核心参数（云端模式）</span></template>
      <el-form label-position="top">
        <el-form-item label="API Base URL">
          <el-input v-model="form.apiBaseUrl" placeholder="例如: https://api.deepseek.com/v1" class="control-width" />
          <div class="form-hint">地址必须以 https:// 开头（本地调试可用 http://localhost），否则请求会被拦截。</div>
        </el-form-item>
        <el-form-item label="模型名称 (Model)">
          <el-input v-model="form.modelName" placeholder="例如: deepseek-chat 或 gpt-4o-mini" class="control-width" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." class="control-width" />
          <div class="form-hint">安全提示：API 密钥以明文保存在本浏览器 localStorage，不上传任何服务器；请勿在公共电脑留存，且仅填入可信的 https 服务地址。</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save">保存 API 配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </el-form>
</template>
