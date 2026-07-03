import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm'
import { useSettings } from '../composables/useSettings'

let engineInstance: MLCEngine | null = null

export async function getLocalEngine(): Promise<MLCEngine> {
  const { settings, updateSettings } = useSettings()
  
  if (engineInstance) {
    return engineInstance
  }
  
  const initProgressCallback = (progress: any) => {
    updateSettings({ webLlmProgress: progress.text })
  }
  
  engineInstance = await CreateMLCEngine(settings.value.localModelName, {
    initProgressCallback
  })
  
  return engineInstance
}
