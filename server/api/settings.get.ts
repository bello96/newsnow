import { getSettingsTable } from "#/database/settings"

// 返回服务器上「已生效」的定时任务状态（前端用来显示真相）。
// 隐藏 llmApiKey，只回 hasLlmKey 布尔，避免密钥泄露。
export default defineEventHandler(async () => {
  const table = await getSettingsTable()
  if (!table) {
    throw createError({ statusCode: 500, message: "settings table not available" })
  }
  const s = await table.get()
  const toEmails = s.toEmail
    ? s.toEmail.split(",").map(e => e.trim()).filter(Boolean)
    : []
  return {
    enabled: s.enabled,
    scheduleMode: s.scheduleMode,
    sendHour: s.sendHour,
    sendMinute: s.sendMinute,
    sendAt: s.sendAt,
    toEmails,
    hasLlmKey: !!s.llmApiKey,
    llmModel: s.llmModel,
    lastSentDate: s.lastSentDate,
    updatedAt: s.updatedAt,
  }
})
