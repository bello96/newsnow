import { getArchiveTable } from "#/database/archive"
import { getBeijingMidnightUtcMs } from "#/utils/time"

// 返回今日（北京时间）已归档的新闻汇总，即口播稿选题所用的原始素材。
export default defineEventHandler(async () => {
  const table = await getArchiveTable()
  if (!table) {
    throw createError({ statusCode: 500, message: "数据库未就绪" })
  }
  const now = Date.now()
  const from = getBeijingMidnightUtcMs(now)
  const rows = await table.range(from, now)
  return {
    from,
    to: now,
    count: rows.length,
    items: rows.map(r => ({
      sourceId: r.sourceId,
      newsId: r.newsId,
      title: r.title,
      url: r.url,
      firstSeen: r.firstSeen,
    })),
  }
})
