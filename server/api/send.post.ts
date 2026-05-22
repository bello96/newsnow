import { getHistoryTable } from "#/database/history"
import { sendEmail } from "#/utils/email"
import { splitTitle } from "#/utils/generate-script"

const BEIJING_OFFSET_MS = 8 * 3600 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
const MAX_RECIPIENTS = 5

interface SendBody {
  text?: string
  toEmails?: string[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SendBody>(event).catch<SendBody>(() => ({}))

  const rawText = (body.text ?? "").trim()
  if (!rawText) {
    throw createError({ statusCode: 400, message: "发送内容为空，请先生成口播稿" })
  }

  const emails = Array.isArray(body.toEmails)
    ? body.toEmails
        .map(e => String(e).trim())
        .filter(e => EMAIL_RE.test(e))
        .slice(0, MAX_RECIPIENTS)
    : []
  if (emails.length === 0) {
    throw createError({ statusCode: 400, message: "请先在配置中填写有效的收件邮箱" })
  }

  const now = Date.now()
  const today = new Date(now + BEIJING_OFFSET_MS).toISOString().slice(0, 10)
  const { title, body: scriptBody } = splitTitle(rawText)
  const subject = title || `新闻速递 ${today}`
  const emailText = `${scriptBody}\n\n———————————\n本邮件由「信息速递员」手动发送。`

  let emailStatus: "sent" | "failed" = "sent"
  let emailError: string | null = null
  try {
    await sendEmail({ to: emails.join(","), subject, text: emailText })
  } catch (e: any) {
    emailStatus = "failed"
    emailError = String(e?.message ?? e).slice(0, 500)
  }

  const historyTable = await getHistoryTable()
  if (historyTable) {
    await historyTable.insert({
      generatedAt: now,
      text: rawText,
      model: null,
      newsCount: null,
      sentTo: emails.join(","),
      emailStatus,
      emailError,
    })
  }

  if (emailStatus === "failed") {
    throw createError({ statusCode: 502, message: `邮件发送失败: ${emailError}` })
  }

  return { ok: true, emailStatus, sentTo: emails.join(",") }
})
