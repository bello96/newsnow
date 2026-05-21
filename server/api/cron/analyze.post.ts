import process from "node:process"
import { ofetch } from "ofetch"
import { getSettingsTable } from "#/database/settings"
import { getHistoryTable } from "#/database/history"
import { getArchiveTable } from "#/database/archive"
import { getDouyinSystemPrompt } from "#/prompts/douyin"
import { sendEmail } from "#/utils/email"

const BEIJING_OFFSET_MS = 8 * 3600 * 1000

function getBeijingYmdAndHour(nowMs: number) {
  const beijing = new Date(nowMs + BEIJING_OFFSET_MS)
  const ymd = beijing.toISOString().slice(0, 10)
  const hour = beijing.getUTCHours()
  const minute = beijing.getUTCMinutes()
  return { ymd, hour, minute }
}

function getBeijingMidnightUtcMs(nowMs: number) {
  const beijing = new Date(nowMs + BEIJING_OFFSET_MS)
  return Date.UTC(
    beijing.getUTCFullYear(),
    beijing.getUTCMonth(),
    beijing.getUTCDate(),
    0,
    0,
    0,
  ) - BEIJING_OFFSET_MS
}

interface LLMChatResponse {
  choices: Array<{ message: { content: string } }>
}

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!verifyCronToken(process.env.CRON_TOKEN, auth)) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const dryRun = getQuery(event).dryRun === "true"

  const settingsTable = await getSettingsTable()
  const historyTable = await getHistoryTable()
  const archiveTable = await getArchiveTable()
  if (!settingsTable || !historyTable || !archiveTable) {
    throw createError({ statusCode: 500, message: "database tables not available" })
  }

  const settings = await settingsTable.get()
  const now = Date.now()
  const { ymd: today, hour: beijingHour, minute: beijingMinute } = getBeijingYmdAndHour(now)

  if (!dryRun) {
    if (!settings.enabled) {
      return { skip: "disabled", now, today }
    }
    const targetMin = settings.sendHour * 60 + settings.sendMinute
    const currMin = beijingHour * 60 + beijingMinute
    const delta = currMin - targetMin
    if (delta < 0 || delta >= 30) {
      return {
        skip: "not_in_window",
        beijingHour,
        beijingMinute,
        sendHour: settings.sendHour,
        sendMinute: settings.sendMinute,
      }
    }
    if (settings.lastSentDate === today) {
      return { skip: "already_sent", today }
    }
  }

  if (!settings.llmApiKey) {
    throw createError({ statusCode: 400, message: "LLM API key 未配置" })
  }

  const todayStart = getBeijingMidnightUtcMs(now)
  const items = await archiveTable.range(todayStart, now)
  if (items.length === 0) {
    throw createError({ statusCode: 400, message: "今日尚无归档新闻，无法生成稿件" })
  }

  const systemPrompt = await getDouyinSystemPrompt()
  const newsList = items
    .map(i => `- [${i.sourceId}] ${i.title} (${i.url})`)
    .join("\n")
  const userPrompt = `## 今日新闻列表（共 ${items.length} 条）\n${newsList}`

  let text = ""
  try {
    const llmRes = await ofetch<LLMChatResponse>(
      `${settings.llmBaseUrl.replace(/\/$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.llmApiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: settings.llmModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 2000,
        },
        timeout: 180000,
      },
    )
    text = llmRes.choices?.[0]?.message?.content?.trim() ?? ""
  } catch (e: any) {
    const data = e?.data ?? e?.response?._data
    const msg = data?.error?.message ?? data?.message ?? String(e)
    throw createError({ statusCode: e?.response?.status ?? 502, message: `LLM 调用失败: ${msg}` })
  }

  if (!text) {
    throw createError({ statusCode: 502, message: "LLM 返回为空" })
  }

  let emailStatus: "sent" | "failed" | "skipped" = "skipped"
  let emailError: string | null = null
  if (!dryRun) {
    try {
      if (!settings.resendApiKey || !settings.fromEmail || !settings.toEmail) {
        throw new Error("邮件配置不完整（Resend key / 发件 / 收件邮箱必填）")
      }
      const fromValue = settings.fromName
        ? `${settings.fromName} <${settings.fromEmail}>`
        : settings.fromEmail
      const subject = settings.subjectTemplate.replace("{date}", today)
      await sendEmail({
        apiKey: settings.resendApiKey,
        from: fromValue,
        to: settings.toEmail,
        subject,
        text,
      })
      emailStatus = "sent"
    } catch (e: any) {
      emailStatus = "failed"
      emailError = String(e?.message ?? e).slice(0, 500)
    }
  }

  await historyTable.insert({
    generatedAt: now,
    text,
    model: settings.llmModel,
    newsCount: items.length,
    sentTo: dryRun ? null : settings.toEmail,
    emailStatus,
    emailError,
  })

  if (!dryRun && emailStatus === "sent") {
    await settingsTable.markSent(today)
  }

  return {
    dryRun,
    today,
    beijingHour,
    beijingMinute,
    text,
    newsCount: items.length,
    emailStatus,
    emailError,
  }
})
