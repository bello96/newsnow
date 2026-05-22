import { getHistoryTable } from "#/database/history"
import { generateScript } from "#/utils/generate-script"

interface AnalyzeBody {
  baseUrl?: string
  model?: string
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

  const result = await generateScript({ apiKey: llmKey, baseUrl, model })

  const historyTable = await getHistoryTable()
  if (historyTable) {
    await historyTable.insert({
      generatedAt: Date.now(),
      text: result.fullText,
      model,
      newsCount: result.newsCount,
      sentTo: null,
      emailStatus: "skipped",
      emailError: null,
    })
  }

  return {
    text: result.fullText,
    title: result.title,
    newsCount: result.newsCount,
    model,
    articleHits: result.articleHits,
  }
})
