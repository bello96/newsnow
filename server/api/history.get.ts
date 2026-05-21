import { getHistoryTable } from "#/database/history"

export default defineEventHandler(async (event) => {
  const limit = Math.min(50, Math.max(1, Number(getQuery(event).limit) || 7))
  const history = await getHistoryTable()
  if (!history) {
    throw createError({ statusCode: 500, message: "history not available" })
  }
  const items = await history.recent(limit)
  return { count: items.length, items }
})
