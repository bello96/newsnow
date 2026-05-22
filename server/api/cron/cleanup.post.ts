import process from "node:process"
import { getArchiveTable } from "#/database/archive"

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!verifyCronToken(process.env.CRON_TOKEN, auth)) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const q = getQuery(event)
  const archiveDays = Math.max(1, Number(q.archiveDays) || 30)
  const now = Date.now()

  const archive = await getArchiveTable()
  if (!archive) {
    throw createError({ statusCode: 500, message: "database not available" })
  }

  const archiveCutoff = now - archiveDays * 86400 * 1000
  await archive.cleanup(archiveCutoff)

  logger.success(`cron cleanup: archive>${archiveDays}d`)
  return {
    archiveDays,
    archiveCutoff,
  }
})
