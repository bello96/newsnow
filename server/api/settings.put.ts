import process from "node:process"
import { getSettingsTable } from "#/database/settings"
import type { UserSettings } from "#/database/settings"

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!verifyCronToken(process.env.CRON_TOKEN, auth)) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }
  const body = await readBody<Partial<Omit<UserSettings, "id">>>(event)
  if (!body || typeof body !== "object") {
    throw createError({ statusCode: 400, message: "Invalid body" })
  }
  const settings = await getSettingsTable()
  if (!settings) {
    throw createError({ statusCode: 500, message: "settings not available" })
  }
  await settings.put(body)
  const updated = await settings.get()
  return updated
})
