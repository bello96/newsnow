import { ofetch } from "ofetch"
import { getArchiveTable } from "#/database/archive"
import { getHistoryTable } from "#/database/history"
import { getSettingsTable } from "#/database/settings"
import { getDouyinSystemPrompt } from "#/prompts/douyin"
import { sendEmail } from "#/utils/email"
import { joinChatCompletionsUrl } from "#/utils/llm-url"

const BEIJING_OFFSET_MS = 8 * 3600 * 1000

function getBeijingNow(nowMs: number) {
  const beijing = new Date(nowMs + BEIJING_OFFSET_MS)
  return {
    ymd: beijing.toISOString().slice(0, 10),
    hour: beijing.getUTCHours(),
    minute: beijing.getUTCMinutes(),
  }
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
  const dryRun = getQuery(event).dryRun === "true"

  const settingsTable = await getSettingsTable()
  const historyTable = await getHistoryTable()
  const archiveTable = await getArchiveTable()
  if (!settingsTable || !historyTable || !archiveTable) {
    throw createError({ statusCode: 500, message: "数据库未就绪" })
  }

  const settings = await settingsTable.get()
  const now = Date.now()
  const { ymd: today, hour: beijingHour, minute: beijingMinute } = getBeijingNow(now)

  if (!dryRun) {
    if (!settings.enabled) {
      return { skip: "disabled" }
    }
    if (!settings.llmApiKey) {
      return { skip: "no_llm_key" }
    }
    if (!settings.toEmail) {
      return { skip: "no_to_email" }
    }
    if (settings.scheduleMode === "once") {
      if (!settings.sendAt) {
        return { skip: "no_send_at" }
      }
      if (now < settings.sendAt) {
        return { skip: "not_yet", now, sendAt: settings.sendAt }
      }
      // 目标时间已过 2 小时仍未发，视为过期任务，自动关闭定时
      if (now - settings.sendAt > 2 * 3600 * 1000) {
        await settingsTable.put({ enabled: 0, sendAt: null })
        return { skip: "expired", now, sendAt: settings.sendAt }
      }
    } else {
      const targetMin = settings.sendHour * 60 + settings.sendMinute
      const currMin = beijingHour * 60 + beijingMinute
      const delta = currMin - targetMin
      if (delta < 0 || delta >= 30) {
        return { skip: "not_in_window", currMin, targetMin }
      }
      if (settings.lastSentDate === today) {
        return { skip: "already_sent", today }
      }
    }
  }

  if (!settings.llmApiKey) {
    throw createError({ statusCode: 400, message: "LLM API Key 未配置" })
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
    const chatUrl = joinChatCompletionsUrl(settings.llmBaseUrl || "https://api.deepseek.com")
    const llmRes = await ofetch<LLMChatResponse>(chatUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.llmApiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: settings.llmModel || "deepseek-v4-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      },
      timeout: 180000,
    })
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
      const subject = `新闻速递 ${today}`
      const emailText = `${text}\n\n———————————\n本邮件由「信息速递员」根据您的订阅设置自动生成发送。\n如需停止接收，请前往 https://new.dengjiabei.cn/summary 关闭定时发送。`
      await sendEmail({ to: settings.toEmail, subject, text: emailText })
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
    if (settings.scheduleMode === "once") {
      // 一次性发送完成：关闭定时并清空目标时间，避免重复发送
      await settingsTable.put({ enabled: 0, sendAt: null })
    } else {
      await settingsTable.markSent(today)
    }
  }

  return {
    dryRun,
    today,
    text,
    newsCount: items.length,
    emailStatus,
    emailError,
  }
})
