import { getSettingsTable } from "#/database/settings"
import { sendEmail } from "#/utils/email"
import { generateScript } from "#/utils/generate-script"
import { getBeijingNow } from "#/utils/time"

export default defineEventHandler(async (event) => {
  const dryRun = getQuery(event).dryRun === "true"

  const settingsTable = await getSettingsTable()
  if (!settingsTable) {
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

  const result = await generateScript({
    apiKey: settings.llmApiKey,
    baseUrl: settings.llmBaseUrl || "https://api.deepseek.com",
    model: settings.llmModel || "deepseek-v4-pro",
  })

  let emailStatus: "sent" | "failed" | "skipped" = "skipped"
  let emailError: string | null = null
  if (!dryRun) {
    try {
      const subject = result.title || `新闻速递 ${today}`
      const emailText = `${result.body}\n\n———————————\n本邮件由「信息速递员」根据您的订阅设置自动生成发送。\n如需停止接收，请前往 https://new.dengjiabei.cn/analyze 关闭定时发送。`
      await sendEmail({ to: settings.toEmail, subject, text: emailText })
      emailStatus = "sent"
    } catch (e: any) {
      emailStatus = "failed"
      emailError = String(e?.message ?? e).slice(0, 500)
    }
  }

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
    title: result.title,
    text: result.fullText,
    newsCount: result.newsCount,
    emailStatus,
    emailError,
    articleHits: result.articleHits,
  }
})
