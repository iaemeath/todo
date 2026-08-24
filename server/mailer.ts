/**
 * 邮件发送：nodemailer + SMTP 环境变量（163/QQ 等邮箱授权码）。
 * 未配置 SMTP 时验证码打印到 server 日志（开发兜底，流程可完整走通）——
 * 检索日志取码：grep "[mail-code]"。
 */
import { createTransport, type Transporter } from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

const smtpReady = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS)

let transporter: Transporter | null = null
if (smtpReady) {
  transporter = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 走隐式 TLS；587 用 STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })
}

const SUBJECT: Record<string, string> = {
  register: '拾光 - 邮箱验证码（注册）',
  reset: '拾光 - 邮箱验证码（重置密码）'
}

/** 发送验证码邮件；SMTP 未配置时落日志兜底（不抛错，调用方按已发送处理） */
export async function sendCodeMail(email: string, code: string, purpose: string): Promise<void> {
  const subject = SUBJECT[purpose] || '拾光 - 邮箱验证码'
  const minutes = 10

  if (!transporter) {
    console.log(`[mail-code] SMTP 未配置，验证码落日志兜底 → ${email} [${purpose}] ${code}（${minutes} 分钟内有效）`)
    return
  }

  await transporter.sendMail({
    from: `"拾光" <${SMTP_FROM}>`,
    to: email,
    subject,
    text: `您的验证码是 ${code}，${minutes} 分钟内有效。若非本人操作请忽略本邮件。`,
    html: `
      <div style="max-width:420px;margin:0 auto;font-family:system-ui,-apple-system,'PingFang SC',sans-serif;color:#333">
        <h3 style="margin:16px 0 8px">${subject}</h3>
        <p style="margin:8px 0;color:#666">验证码：</p>
        <p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:8px 0">${code}</p>
        <p style="margin:8px 0;font-size:13px;color:#999">${minutes} 分钟内有效，单次使用。若非本人操作请忽略本邮件。</p>
      </div>`
  })
}
