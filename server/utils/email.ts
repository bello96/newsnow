import process from "node:process"
import { ofetch } from "ofetch"

export interface SendEmailParams {
  to: string
  subject: string
  text: string
}

interface ResendSuccessResponse {
  id: string
}

export async function sendEmail(p: SendEmailParams): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL
  const fromName = process.env.FROM_NAME || "信息速递员"

  if (!apiKey) {
    throw new Error("服务端未配置 RESEND_API_KEY 环境变量")
  }
  if (!fromEmail) {
    throw new Error("服务端未配置 FROM_EMAIL 环境变量（须为 Resend 已验证域名下的邮箱）")
  }
  if (!p.to) {
    throw new Error("缺少收件人邮箱")
  }
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  try {
    const res = await ofetch<ResendSuccessResponse>("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        from,
        to: p.to,
        subject: p.subject,
        text: p.text,
      },
      timeout: 30000,
    })
    return { id: res.id }
  } catch (e: any) {
    const data = e?.data ?? e?.response?._data
    const msg = data?.message ?? data?.error ?? String(e)
    throw new Error(`Resend 发送失败: ${msg}`)
  }
}
