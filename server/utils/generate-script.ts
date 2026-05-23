import { ofetch } from "ofetch"
import { getArchiveTable } from "#/database/archive"
import { getDouyinSelectPrompt, getDouyinWritePrompt } from "#/prompts/douyin"
import { fetchArticles } from "#/utils/fetch-article"
import { joinChatCompletionsUrl } from "#/utils/llm-url"
import { getBeijingMidnightUtcMs } from "#/utils/time"

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
}

interface LLMChatResponse {
  choices: Array<{ message: { content: string } }>
}

interface PickedItem {
  sourceId: string
  title: string
  url: string
}

interface SelectResult {
  mainline: PickedItem
  related: PickedItem[]
  hotspots: string
}

export interface GenerateResult {
  title: string | null
  body: string
  fullText: string
  newsCount: number
  picked: PickedItem[]
  articleHits: number
}

// 调一次 OpenAI 兼容 chat completions，返回 message.content
async function chat(
  cfg: LLMConfig,
  messages: Array<{ role: string, content: string }>,
  opts: { jsonMode?: boolean, maxTokens?: number } = {},
): Promise<string> {
  const chatUrl = joinChatCompletionsUrl(cfg.baseUrl || "https://api.deepseek.com")
  const body: Record<string, any> = {
    model: cfg.model || "deepseek-v4-pro",
    messages,
    temperature: 0.5,
    max_tokens: opts.maxTokens ?? 2000,
  }
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" }
  }
  try {
    const res = await ofetch<LLMChatResponse>(chatUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      timeout: 180000,
    })
    return res.choices?.[0]?.message?.content?.trim() ?? ""
  } catch (e: any) {
    const data = e?.data ?? e?.response?._data
    const msg = data?.error?.message ?? data?.message ?? String(e)
    throw createError({ statusCode: e?.response?.status ?? 502, message: `LLM 调用失败: ${msg}` })
  }
}

// 从 LLM 返回里稳健提取选题 JSON，失败返回 null（调用方降级）
function parseSelectJson(raw: string): SelectResult | null {
  if (!raw) {
    return null
  }
  const trimmed = raw.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    return null
  }
  const s = trimmed.slice(start, end + 1)
  try {
    const obj = JSON.parse(s)
    if (!obj || typeof obj !== "object" || !obj.mainline || typeof obj.mainline.url !== "string") {
      return null
    }
    const related: PickedItem[] = Array.isArray(obj.related)
      ? obj.related
          .filter((r: any) => r && typeof r.url === "string")
          .slice(0, 4)
          .map((r: any) => ({ sourceId: String(r.sourceId ?? ""), title: String(r.title ?? ""), url: r.url }))
      : []
    return {
      mainline: {
        sourceId: String(obj.mainline.sourceId ?? ""),
        title: String(obj.mainline.title ?? ""),
        url: obj.mainline.url,
      },
      related,
      hotspots: typeof obj.hotspots === "string" ? obj.hotspots : "",
    }
  } catch {
    return null
  }
}

// 拆出稿件第一行的「# 大标题」
export function splitTitle(raw: string): { title: string | null, body: string } {
  const text = raw.trim()
  if (!text.startsWith("#")) {
    return { title: null, body: text }
  }
  const nl = text.indexOf("\n")
  if (nl === -1) {
    const only = text.replace(/^#+/, "").trim()
    return { title: only || null, body: "" }
  }
  const title = text.slice(0, nl).replace(/^#+/, "").trim()
  const body = text.slice(nl + 1).trim()
  return { title: title || null, body }
}

// 两阶段生成：① 选题 → ② 抓正文 → ③ 写稿
export async function generateScript(cfg: LLMConfig, candidates?: PickedItem[]): Promise<GenerateResult> {
  if (!cfg.apiKey) {
    throw createError({ statusCode: 400, message: "LLM API Key 未配置" })
  }

  // 优先使用调用方手选的素材（前端勾选）；未传则取今日全部归档
  let items: PickedItem[]
  if (candidates && candidates.length > 0) {
    items = candidates
  } else {
    const archiveTable = await getArchiveTable()
    if (!archiveTable) {
      throw createError({ statusCode: 500, message: "数据库未就绪" })
    }
    const now = Date.now()
    const todayStart = getBeijingMidnightUtcMs(now)
    const rows = await archiveTable.range(todayStart, now)
    items = rows.map(r => ({ sourceId: r.sourceId, title: r.title, url: r.url }))
  }
  if (items.length === 0) {
    throw createError({ statusCode: 400, message: "今日尚无归档新闻，请等待自动抓取任务跑过一次后再试" })
  }

  // ① 选题
  const selectPrompt = await getDouyinSelectPrompt()
  const newsList = items.map(i => `- [${i.sourceId}] ${i.title} (${i.url})`).join("\n")
  const selectRaw = await chat(
    cfg,
    [
      { role: "system", content: selectPrompt },
      { role: "user", content: `## 今日新闻列表（共 ${items.length} 条）\n${newsList}` },
    ],
    { jsonMode: true, maxTokens: 1000 },
  )
  const selected = parseSelectJson(selectRaw)

  let picked: PickedItem[]
  let hotspots = ""
  if (selected) {
    picked = [selected.mainline, ...selected.related].slice(0, 5)
    hotspots = selected.hotspots
  } else {
    // 选题失败：降级取归档前若干条
    picked = items.slice(0, 4).map(i => ({ sourceId: i.sourceId, title: i.title, url: i.url }))
  }

  // ② 抓正文（并发，失败降级）
  const articles = await fetchArticles(picked.map(p => p.url))
  const articleHits = articles.filter(a => a.ok).length
  const contentByUrl = new Map(articles.map(a => [a.url, a]))

  const section = (p: PickedItem) => {
    const a = contentByUrl.get(p.url)
    const content = a?.ok && a.content ? a.content : "正文未获取"
    return `[${p.sourceId}] ${p.title}\n正文：${content}`
  }

  // ③ 写稿
  const writePrompt = await getDouyinWritePrompt()
  const mainline = picked[0]
  const related = picked.slice(1)
  const writeUser = [
    "## 主线新闻",
    section(mainline),
    "",
    "## 呼应新闻",
    ...related.map(section),
    "",
    "## 多源热点观察",
    hotspots || "无",
  ].join("\n")

  const raw = await chat(
    cfg,
    [
      { role: "system", content: writePrompt },
      { role: "user", content: writeUser },
    ],
    { maxTokens: 2000 },
  )
  const fullText = raw.trim()
  if (!fullText) {
    throw createError({ statusCode: 502, message: "LLM 返回为空" })
  }
  const { title, body } = splitTitle(fullText)

  return { title, body, fullText, newsCount: items.length, picked, articleHits }
}
