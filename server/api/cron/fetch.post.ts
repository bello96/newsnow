import process from "node:process"
import type { SourceID } from "@shared/types"
import { getters } from "#/getters"
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

  const now = Date.now()
  const ids = Object.keys(getters) as SourceID[]
  const settled = await Promise.allSettled(ids.map(async (id) => {
    const items = await getters[id]()
    await archive.upsert(id, items, now)
    return { id, count: items.length }
  }))

  const results = settled.map((r, i) => r.status === "fulfilled"
    ? { id: ids[i], status: "ok" as const, count: r.value.count }
    : { id: ids[i], status: "error" as const, error: String(r.reason).slice(0, 200) })

  const ok = results.filter(r => r.status === "ok").length
  const failed = results.filter(r => r.status === "error").length

  // 清理已不在源列表里的归档行（删源后自动清掉孤儿数据，如已移除的 juejin）
  const pruned = await archive.pruneSources(ids)

  logger.success(`cron fetch: ${ok} ok / ${failed} failed, pruned ${pruned} orphan rows`)
  return { ok, failed, pruned, now, results }
})
