import type { UserSettings } from "#/database/settings"
import { getSettingsTable } from "#/database/settings"
import { normalizeRecipients } from "#/utils/email"

interface SettingsPayload {
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
  toEmails?: string[]
  sendHour?: number
  sendMinute?: number
  scheduleMode?: "daily" | "once"
  sendAt?: number | null
  enabled?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SettingsPayload>(event).catch<SettingsPayload>(() => ({}))
  const table = await getSettingsTable()
  if (!table) {
    throw createError({ statusCode: 500, message: "settings table not available" })
  }

  const partial: Partial<Omit<UserSettings, "id">> = {}
  if (typeof body.llmApiKey === "string") {
    partial.llmApiKey = body.llmApiKey
  }
  if (typeof body.llmBaseUrl === "string") {
    partial.llmBaseUrl = body.llmBaseUrl
  }
  if (typeof body.llmModel === "string") {
    partial.llmModel = body.llmModel
  }
  if (Array.isArray(body.toEmails)) {
    partial.toEmail = normalizeRecipients(body.toEmails).join(",")
  }
  if (typeof body.sendHour === "number" && body.sendHour >= 0 && body.sendHour <= 23) {
    partial.sendHour = body.sendHour
  }
  if (typeof body.sendMinute === "number" && (body.sendMinute === 0 || body.sendMinute === 30)) {
    partial.sendMinute = body.sendMinute
  }
  if (body.scheduleMode === "daily" || body.scheduleMode === "once") {
    partial.scheduleMode = body.scheduleMode
  }
  if (body.sendAt === null || typeof body.sendAt === "number") {
    partial.sendAt = body.sendAt
  }
  if (body.enabled === 0 || body.enabled === 1) {
    partial.enabled = body.enabled
  }

  await table.put(partial)
  return { ok: true }
})
