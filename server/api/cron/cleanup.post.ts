import process from "node:process"
import { getArchiveTable } from "#/database/archive"
import { getHistoryTable } from "#/database/history"

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!verifyCronToken(process.env.CRON_TOKEN, auth)) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const q = getQuery(event)
  const archiveDays = Math.max(1, Number(q.archiveDays) || 30)
  const historyDays = Math.max(1, Number(q.historyDays) || 7)
  const now = Date.now()

  const archive = await getArchiveTable()
  const history = await getHistoryTable()
  if (!archive || !history) {
    throw createError({ statusCode: 500, message: "database not available" })
  }

  const archiveCutoff = now - archiveDays * 86400 * 1000
  const historyCutoff = now - historyDays * 86400 * 1000
  await archive.cleanup(archiveCutoff)
  await history.cleanup(historyCutoff)

  logger.success(`cron cleanup: archive>${archiveDays}d, history>${historyDays}d`)
  return {
    archiveDays,
    historyDays,
    archiveCutoff,
    historyCutoff,
  }
})
