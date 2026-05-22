interface AihotItem {
  id: string
  title: string
  title_en?: string | null
  url: string
  source?: string
  publishedAt?: string
  summary?: string
  category?: string
}

interface AihotRes {
  count: number
  hasNext: boolean
  nextCursor?: string
  items: AihotItem[]
}

// AIHOT 公开 API：mode=selected 取人工/AI 精选。
// 接口要求浏览器 UA（curl 默认 UA 会 403），myFetch 默认已带 Chrome UA，天然满足。
const aihot = defineSource(async () => {
  const apiUrl = "https://aihot.virxact.com/api/public/items?mode=selected&take=50"
  const res: AihotRes = await myFetch(apiUrl)
  return (res.items ?? [])
    .filter((it) => it.title && it.url)
    .map((it) => ({
      id: it.id || it.url,
      title: it.title,
      url: it.url,
      pubDate: it.publishedAt ? Date.parse(it.publishedAt) || undefined : undefined,
      extra: {
        info: it.source || undefined,
        hover: it.summary || undefined,
      },
    }))
})

export default aihot
