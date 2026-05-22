import process from "node:process"
import { ofetch } from "ofetch"

const MAX_CHARS = 2000
const TIMEOUT_MS = 15000

export interface ArticleResult {
  url: string
  ok: boolean
  content: string | null
}

// 用 Jina Reader 抓取网页正文。失败返回 ok:false，由调用方降级为「仅标题」。
export async function fetchArticle(url: string): Promise<ArticleResult> {
  if (!url || !/^https?:\/\//.test(url)) {
    return { url, ok: false, content: null }
  }
  const headers: Record<string, string> = {
    // 返回纯文本正文，去掉图片 / 链接，降低 token 消耗
    "X-Return-Format": "text",
  }
  const jinaKey = process.env.JINA_API_KEY
  if (jinaKey) {
    headers.Authorization = `Bearer ${jinaKey}`
  }
  try {
    const res = await ofetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers,
      responseType: "text",
      timeout: TIMEOUT_MS,
      retry: 0,
    })
    const text = (res ?? "").trim()
    if (!text) {
      return { url, ok: false, content: null }
    }
    return { url, ok: true, content: text.slice(0, MAX_CHARS) }
  } catch {
    return { url, ok: false, content: null }
  }
}

// 并发抓取多条，单条失败不影响其它条
export async function fetchArticles(urls: string[]): Promise<ArticleResult[]> {
  return Promise.all(urls.map(u => fetchArticle(u)))
}
