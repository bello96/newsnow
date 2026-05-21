import { getSettingsTable } from "#/database/settings"

interface SettingsPayload {
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
  toEmail?: string
  sendHour?: number
  sendMinute?: number
  enabled?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SettingsPayload>(event).catch<SettingsPayload>(() => ({}))
  const table = await getSettingsTable()
  if (!table) {
    throw createError({ statusCode: 500, message: "settings table not available" })
  }

  const partial: SettingsPayload = {}
  if (typeof body.llmApiKey === "string") {
    partial.llmApiKey = body.llmApiKey
  }
  if (typeof body.llmBaseUrl === "string") {
    partial.llmBaseUrl = body.llmBaseUrl
  }
  if (typeof body.llmModel === "string") {
    partial.llmModel = body.llmModel
  }
  if (typeof body.toEmail === "string") {
    partial.toEmail = body.toEmail
  }
  if (typeof body.sendHour === "number" && body.sendHour >= 0 && body.sendHour <= 23) {
    partial.sendHour = body.sendHour
  }
  if (typeof body.sendMinute === "number" && (body.sendMinute === 0 || body.sendMinute === 30)) {
    partial.sendMinute = body.sendMinute
  }
  if (body.enabled === 0 || body.enabled === 1) {
    partial.enabled = body.enabled
  }

  await table.put(partial)
  return { ok: true }
})
