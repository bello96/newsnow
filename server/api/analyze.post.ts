import { ofetch } from "ofetch"
import { getArchiveTable } from "#/database/archive"
import { getHistoryTable } from "#/database/history"
import { getDouyinSystemPrompt } from "#/prompts/douyin"
import { joinChatCompletionsUrl } from "#/utils/llm-url"

const BEIJING_OFFSET_MS = 8 * 3600 * 1000

function getBeijingMidnightUtcMs(nowMs: number) {
  const beijing = new Date(nowMs + BEIJING_OFFSET_MS)
  return Date.UTC(
    beijing.getUTCFullYear(),
    beijing.getUTCMonth(),
    beijing.getUTCDate(),
    0,
    0,
    0,
  ) - BEIJING_OFFSET_MS
}

interface AnalyzeBody {
  baseUrl?: string
  model?: string
}

interface LLMChatResponse {
  choices: Array<{ message: { content: string } }>
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
  const chatUrl = joinChatCompletionsUrl(baseUrl)

  const archiveTable = await getArchiveTable()
  const historyTable = await getHistoryTable()
  if (!archiveTable || !historyTable) {
    throw createError({ statusCode: 500, message: "数据库未就绪" })
  }

  const now = Date.now()
  const todayStart = getBeijingMidnightUtcMs(now)
  const items = await archiveTable.range(todayStart, now)
  if (items.length === 0) {
    throw createError({ statusCode: 400, message: "今日尚无归档新闻，请等待自动抓取任务跑过一次后再试" })
  }

  const systemPrompt = await getDouyinSystemPrompt()
  const newsList = items
    .map(i => `- [${i.sourceId}] ${i.title} (${i.url})`)
    .join("\n")
  const userPrompt = `## 今日新闻列表（共 ${items.length} 条）\n${newsList}`

  let text = ""
  try {
    const llmRes = await ofetch<LLMChatResponse>(
      chatUrl,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${llmKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 2000,
        },
        timeout: 180000,
      },
    )
    text = llmRes.choices?.[0]?.message?.content?.trim() ?? ""
  } catch (e: any) {
    const data = e?.data ?? e?.response?._data
    const msg = data?.error?.message ?? data?.message ?? String(e)
    throw createError({ statusCode: e?.response?.status ?? 502, message: `LLM 调用失败: ${msg}` })
  }

  if (!text) {
    throw createError({ statusCode: 502, message: "LLM 返回为空" })
  }

  await historyTable.insert({
    generatedAt: now,
    text,
    model,
    newsCount: items.length,
    sentTo: null,
    emailStatus: "skipped",
    emailError: null,
  })

  return {
    text,
    newsCount: items.length,
    model,
  }
})
