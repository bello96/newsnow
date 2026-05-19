import process from "node:process"
import { getHistoryTable } from "#/database/history"

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!verifyCronToken(process.env.CRON_TOKEN, auth)) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }
  const limit = Math.min(50, Math.max(1, Number(getQuery(event).limit) || 7))
  const history = await getHistoryTable()
  if (!history) {
    throw createError({ statusCode: 500, message: "history not available" })
  }
  const items = await history.recent(limit)
  return { count: items.length, items }
})
