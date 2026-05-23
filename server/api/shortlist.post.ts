import { shortlistArchive } from "#/utils/generate-script"

interface ShortlistBody {
  baseUrl?: string
  model?: string
}

// 拉取今日归档后用 DeepSeek 初筛去重，返回最多 50 条候选（供前端勾选）
export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, message: "缺少 LLM API Key（请在 Authorization 头携带 Bearer <key>）" })
  }
  const llmKey = auth.slice("Bearer ".length).trim()
  if (!llmKey) {
    throw createError({ statusCode: 401, message: "LLM API Key 为空" })
  }

  const body = await readBody<ShortlistBody>(event).catch<ShortlistBody>(() => ({}))
  const baseUrl = (body && body.baseUrl) || "https://api.deepseek.com"
  const model = (body && body.model) || "deepseek-v4-pro"

  const result = await shortlistArchive({ apiKey: llmKey, baseUrl, model })

  return {
    total: result.total,
    count: result.items.length,
    items: result.items.map(r => ({
      sourceId: r.sourceId,
      newsId: r.newsId,
      title: r.title,
      url: r.url,
      firstSeen: r.firstSeen,
    })),
  }
})
