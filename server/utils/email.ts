import { ofetch } from "ofetch"

export interface SendEmailParams {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
}

interface ResendSuccessResponse {
  id: string
}

export async function sendEmail(p: SendEmailParams): Promise<{ id: string }> {
  if (!p.apiKey) {
    throw new Error("缺少 Resend API key")
  }
  if (!p.from || !p.to) {
    throw new Error("缺少发件人或收件人邮箱")
  }
  try {
    const res = await ofetch<ResendSuccessResponse>("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${p.apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        from: p.from,
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
