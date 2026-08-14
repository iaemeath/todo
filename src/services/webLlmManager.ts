import type { MLCEngine } from '@mlc-ai/web-llm'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../stores'

// web-llm 体积巨大（6MB+），只在真正需要时动态加载，避免进入主 bundle。
// import type 仅用于类型标注，编译时擦除，不产生运行时依赖。
let engineInstance: MLCEngine | null = null
let webllmModule: typeof import('@mlc-ai/web-llm') | null = null
const loadWebLlm = async () => {
  if (!webllmModule) webllmModule = await import('@mlc-ai/web-llm')
  return webllmModule
}

// ===== 供设置页「本地模型管理」使用 =====

/** 所有预置模型列表 */
export async function getAllModels() {
  const { prebuiltAppConfig } = await loadWebLlm()
  return prebuiltAppConfig.model_list
}

/** 模型是否已下载到浏览器缓存 */
export async function hasModelInCache(modelId: string): Promise<boolean> {
  const m = await loadWebLlm()
  return m.hasModelInCache(modelId)
}

/** 删除模型缓存文件（释放磁盘空间） */
export async function deleteModelCache(modelId: string): Promise<void> {
  const m = await loadWebLlm()
  await m.deleteModelAllInfoInCache(modelId)
}

/** 下载模型到缓存（下载完成后立即 unload，仅用于「预先下载」） */
export async function downloadModel(
  modelId: string,
  onProgress?: (report: { progress: number; text: string }) => void
): Promise<void> {
  const { CreateMLCEngine } = await loadWebLlm()
  const engine = await CreateMLCEngine(modelId, {
    initProgressCallback: onProgress
  })
  await engine.unload()
}

// ===== 供语音助手推理使用 =====

/** 获取本地推理引擎单例（首次调用时加载模型） */
export async function getLocalEngine(): Promise<MLCEngine> {
  const settingsStore = useSettingsStore()
  const { settings } = storeToRefs(settingsStore)

  if (engineInstance) {
    return engineInstance
  }

  const { CreateMLCEngine } = await loadWebLlm()
  engineInstance = await CreateMLCEngine(settings.value.localModelName, {
    initProgressCallback: (progress: any) => {
      settingsStore.updateSettings({ webLlmProgress: progress.text })
    }
  })

  return engineInstance
}
