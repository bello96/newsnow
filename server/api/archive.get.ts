import type { SourceID } from "@shared/types"
import { getArchiveTable } from "#/database/archive"

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const toMs = Number(q.to ?? Date.now())
  const fromMs = Number(q.from ?? toMs - 86400 * 1000)
  const ids = q.ids ? String(q.ids).split(",") as SourceID[] : undefined

  const archive = await getArchiveTable()
  if (!archive) {
    throw createError({ statusCode: 500, message: "archive not available" })
  }
  const rows = await archive.range(fromMs, toMs, ids)
  return { from: fromMs, to: toMs, count: rows.length, items: rows }
})
