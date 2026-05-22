import process from "node:process"
import { ofetch } from "ofetch"
import { buildSignedBody } from "./aliyun-dm"

export interface SendEmailParams {
  to: string
  subject: string
  text: string
}

function isoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
}

export async function sendEmail(p: SendEmailParams): Promise<{ id: string }> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET
  const fromEmail = process.env.FROM_EMAIL
  const fromName = process.env.FROM_NAME || "信息速递员"

  if (!accessKeyId || !accessKeySecret) {
    throw new Error("服务端未配置 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET")
  }
  if (!fromEmail) {
    throw new Error("服务端未配置 FROM_EMAIL（须为阿里云已验证的发信地址）")
  }
  if (!p.to) {
    throw new Error("缺少收件人邮箱")
  }

  const params: Record<string, string> = {
    Format: "JSON",
    Version: "2015-11-23",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: isoTimestamp(),
    SignatureVersion: "1.0",
    SignatureNonce: `${Date.now()}${Math.random().toString(36).slice(2)}`,
    Action: "SingleSendMail",
    AccountName: fromEmail,
    AddressType: "1",
    ReplyToAddress: "false",
    ToAddress: p.to,
    FromAlias: fromName,
    Subject: p.subject,
    TextBody: p.text,
  }

  const body = await buildSignedBody(params, accessKeySecret, "POST")
  try {
    const res = await ofetch<{ RequestId: string }>("https://dm.aliyuncs.com/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      timeout: 30000,
    })
    return { id: res.RequestId }
  } catch (e: any) {
    const data = e?.data ?? e?.response?._data
    const msg = data?.Message ?? data?.Code ?? String(e)
    throw new Error(`阿里云邮件发送失败: ${msg}`)
  }
}
