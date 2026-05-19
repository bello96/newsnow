import process from "node:process"
import { getSettingsTable } from "#/database/settings"

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!verifyCronToken(process.env.CRON_TOKEN, auth)) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }
  const settings = await getSettingsTable()
  if (!settings) {
    throw createError({ statusCode: 500, message: "settings not available" })
  }
  return await settings.get()
})
