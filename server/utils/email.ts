import process from "node:process"
import { ofetch } from "ofetch"

export interface SendEmailParams {
  to: string
  subject: string
  text: string
}

interface BrevoSuccessResponse {
  messageId: string
}

export async function sendEmail(p: SendEmailParams): Promise<{ id: string }> {
  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.FROM_EMAIL
  const fromName = process.env.FROM_NAME || "信息速递员"

  if (!apiKey) {
    throw new Error("服务端未配置 BREVO_API_KEY 环境变量")
  }
  if (!fromEmail) {
    throw new Error("服务端未配置 FROM_EMAIL 环境变量（须为 Brevo 已验证域名下的邮箱）")
  }
  if (!p.to) {
    throw new Error("缺少收件人邮箱")
  }
  try {
    const res = await ofetch<BrevoSuccessResponse>("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: {
        sender: { name: fromName, email: fromEmail },
        to: [{ email: p.to }],
        subject: p.subject,
        textContent: p.text,
      },
      timeout: 30000,
    })
    return { id: res.messageId }
  } catch (e: any) {
    const data = e?.data ?? e?.response?._data
    const msg = data?.message ?? data?.code ?? String(e)
    throw new Error(`Brevo 发送失败: ${msg}`)
  }
}
