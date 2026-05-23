import { generateScript } from "#/utils/generate-script"

interface AnalyzeItem {
  sourceId?: string
  title?: string
  url?: string
}

interface AnalyzeBody {
  baseUrl?: string
  model?: string
  items?: AnalyzeItem[]
}

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, message: "缺少 LLM API Key（请在 Authorization 头携带 Bearer <key>）" })
  }
  const llmKey = auth.slice("Bearer ".length).trim()
  if (!llmKey) {
    throw createError({ statusCode: 401, message: "LLM API Key 为空" })
  }

  const body = await readBody<AnalyzeBody>(event).catch<AnalyzeBody>(() => ({}))
  const baseUrl = (body && body.baseUrl) || "https://api.deepseek.com"
  const model = (body && body.model) || "deepseek-v4-pro"

  // 前端勾选的素材子集（可选）：清洗后限量，未传时由 generateScript 取今日全部归档
  const candidates = Array.isArray(body?.items)
    ? body.items
        .filter(it => it && typeof it.url === "string" && it.url && typeof it.title === "string" && it.title)
        .slice(0, 500)
        .map(it => ({ sourceId: String(it.sourceId ?? ""), title: String(it.title), url: String(it.url) }))
    : undefined

  const result = await generateScript({ apiKey: llmKey, baseUrl, model }, candidates)

  return {
    text: result.fullText,
    title: result.title,
    newsCount: result.newsCount,
    model,
    articleHits: result.articleHits,
  }
})
