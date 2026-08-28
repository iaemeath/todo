import { registerPlugin } from '@capacitor/core'

/**
 * 电池优化豁免（BatteryOptimPlugin 的 JS 端，仅安卓壳可达）：
 * 部分国产 ROM 把「划掉应用」按强停处理——闹钟被系统清空，到点不提醒。
 * 标准干预点是申请忽略电池优化（Doze 白名单）；ROM 私有的自启动/后台管理
 * 无公开 Intent，由设置页文案引导。原生实现见
 * android/.../BatteryOptimPlugin.java（标准 PowerManager/Settings API）。
 */
const BatteryOptim = registerPlugin<{
  getStatus(): Promise<{ ignoring: boolean }>
  requestIgnore(): Promise<void>
}>('BatteryOptim')

/** 当前是否已豁免电池优化；桥不可用（web/Electron）返回 null 由调用方隐藏 UI */
export const batteryIgnoring = async (): Promise<boolean | null> => {
  try {
    return (await BatteryOptim.getStatus()).ignoring
  } catch {
    return null
  }
}

/** 拉起系统「忽略电池优化？」确认弹窗；无该入口的 ROM reject，调用方走文案兜底 */
export const requestBatteryIgnore = (): Promise<void> => BatteryOptim.requestIgnore()
