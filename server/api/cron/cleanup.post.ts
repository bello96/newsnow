import process from "node:process"
import { getArchiveTable } from "#/database/archive"

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!verifyCronToken(process.env.CRON_TOKEN, auth)) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const archive = await getArchiveTable()
  if (!archive) {
    throw createError({ statusCode: 500, message: "archive not available" })
  }

  const days = Math.max(1, Number(getQuery(event).days ?? 30))
  const cutoff = Date.now() - days * 86400 * 1000
  await archive.cleanup(cutoff)
  logger.success(`cron cleanup: removed older than ${days}d`)
  return { cutoff, days }
})
