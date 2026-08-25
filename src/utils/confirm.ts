/**
 * 统一确认弹窗（收敛各页面重复的 ElMessageBox.confirm 仪式）。
 * 两种形态：
 * - confirmDialog：纯询问（流程中途用），确认 true / 取消 false
 * - confirmAction：确认 → 执行 → 成功提示（终端动作用），取消静默返回；
 *   action 抛错向外冒泡由调用方接管（取消已被消化，外层 catch 只会收到真实错误）
 */
import { ElMessageBox, ElMessage } from 'element-plus'

interface ConfirmOpts {
  /** 确认按钮文案（默认"确定"；删除类传"删除"） */
  confirmText?: string
  type?: 'warning' | 'info' | 'success' | 'error'
}

export async function confirmDialog(message: string, title: string, opts: ConfirmOpts = {}): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      type: opts.type ?? 'warning',
      confirmButtonText: opts.confirmText ?? '确定',
      cancelButtonText: '取消'
    })
    return true
  } catch {
    return false
  }
}

export async function confirmAction(o: {
  message: string
  title: string
  confirmText?: string
  type?: ConfirmOpts['type']
  /** 确认后执行；返回值忽略，成败提示由 action 内部或 success 承担 */
  action: () => unknown | Promise<unknown>
  /** action 成功执行后的统一提示（省略则由 action 内部自行提示） */
  success?: string
}): Promise<void> {
  if (!(await confirmDialog(o.message, o.title, { confirmText: o.confirmText, type: o.type }))) return
  await o.action()
  if (o.success) ElMessage.success(o.success)
}
