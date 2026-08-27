import { registerPlugin } from '@capacitor/core'

/**
 * 自定义原生插件入口（android/.../ImmersiveBarsPlugin.java）：沉浸式系统栏控制。
 * 壳内屏保全屏时隐藏状态栏+手势条，边缘滑动临时唤出（TRANSIENT，不挤压布局）。
 *
 * 命名注意：@capacitor/core 8 已内置 SystemBars 插件（无 TRANSIENT 行为），
 * 自定义插件特意取名 ImmersiveBars 避免撞名。registerPlugin 必须在模块级调用
 * （组件 setup 体内会在每次挂载重复注册），故独立成 service 模块，由 ESM 缓存保证全 app 仅注册一次。
 */
interface ImmersiveBarsPlugin {
  hide(): Promise<void>
  show(): Promise<void>
}

export const ImmersiveBars = registerPlugin<ImmersiveBarsPlugin>('ImmersiveBars')
