import { ref, nextTick } from 'vue'

export function useEditorCanvasStage() {
  const stage = ref<any>(null)
  const gridLayer = ref<any>(null)
  const mainLayer = ref<any>(null)
  const guideLayer = ref<any>(null)
  
  let Konva: any = null
  let themeObserver: MutationObserver | null = null
  let resizeHandler: (() => void) | null = null
  let resizeTick: any = null
 
  const initStage = async (
    container: HTMLDivElement,
    onStageClick: () => void,
    onResizeOrThemeChange: () => void
  ) => {
    // Dynamically load Konva for client side compatibility
    const module = await import('konva')
    Konva = module.default
 
    stage.value = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: 900
    })
 
    gridLayer.value = new Konva.Layer()
    mainLayer.value = new Konva.Layer()
    guideLayer.value = new Konva.Layer()
 
    stage.value.add(gridLayer.value)
    stage.value.add(mainLayer.value)
    stage.value.add(guideLayer.value)
 
    // Stage clicks on empty background clears selected task
    stage.value.on('click tap', (e: any) => {
      if (e.target === stage.value) {
        onStageClick()
      }
    })
 
    // Resize Handler with rAF throttling
    resizeHandler = () => {
      if (!stage.value || !container) return
      stage.value.width(container.clientWidth)
      if (!resizeTick) {
        resizeTick = requestAnimationFrame(() => {
          onResizeOrThemeChange()
          resizeTick = null
        })
      }
    }
    window.addEventListener('resize', resizeHandler)
 
    // Theme Mutation Observer
    themeObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === 'data-theme') {
          nextTick(() => onResizeOrThemeChange())
        }
      })
    })
    themeObserver.observe(document.documentElement, { attributes: true })
  }
 
  const destroyStage = () => {
    if (resizeTick) {
      cancelAnimationFrame(resizeTick)
      resizeTick = null
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler)
      resizeHandler = null
    }
    if (themeObserver) {
      themeObserver.disconnect()
      themeObserver = null
    }
    if (stage.value) {
      stage.value.destroy()
      stage.value = null
    }
    gridLayer.value = null
    mainLayer.value = null
    guideLayer.value = null
  }

  return {
    stage,
    gridLayer,
    mainLayer,
    guideLayer,
    initStage,
    destroyStage
  }
}
