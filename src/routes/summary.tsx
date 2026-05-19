import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import { ConfigDialog } from "~/components/summary/config-dialog"
import { InputArea } from "~/components/summary/input-area"
import { ResultView } from "~/components/summary/result-view"
import { llmConfigAtom, summaryRequirementAtom, summaryResultAtom } from "~/atoms/summary"
import { chat } from "~/utils/llm"
import { myFetch } from "~/utils"

interface ArchiveItem {
  sourceId: string
  newsId: string
  title: string
  url: string
  pubDate: number | null
  firstSeen: number
}

interface ArchiveResponse {
  from: number
  to: number
  count: number
  items: ArchiveItem[]
}

export const Route = createFileRoute("/summary")({ component: SummaryPage })

function SummaryPage() {
  const [configOpen, setConfigOpen] = useState(false)
  const config = useAtomValue(llmConfigAtom)
  const requirement = useAtomValue(summaryRequirementAtom)
  const [result, setResult] = useAtom(summaryResultAtom)

  const onAnalyze = async () => {
    if (!config.apiKey) {
      setConfigOpen(true)
      return
    }
    if (!requirement.trim()) {
      setResult({ loading: false, text: "", error: "请填写分析要求" })
      return
    }
    setResult({ loading: true, text: "" })
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const archive = await myFetch<ArchiveResponse>("archive", {
        query: { from: todayStart.getTime(), to: Date.now() },
      })
      if (archive.count === 0) {
        setResult({ loading: false, text: "", error: "今日尚无归档数据，请稍后再试（cron 每 2 小时抓取一次）" })
        return
      }
      const newsList = archive.items
        .map(i => `- [${i.sourceId}] ${i.title} (${i.url})`)
        .join("\n")
      const text = await chat(config, [
        {
          role: "system",
          content: [
            "你是按用户规范工作的助手。",
            "- 严格遵守用户在「分析要求」中提供的所有要求（字数、结构、格式、风格、合规、自检清单等）。",
            "- 「今日新闻列表」是你的素材库，按用户要求从中挑选条目使用。",
            "- 用户要求纯文本就纯文本，要求 markdown 就 markdown——不要主观加链接、序号、标题。",
            "- 输出前自检用户的合规要求与自检清单，不通过就重写。",
          ].join("\n"),
        },
        {
          role: "user",
          content: `## 分析要求\n${requirement}\n\n## 今日新闻列表（共 ${archive.count} 条）\n${newsList}`,
        },
      ])
      setResult({ loading: false, text })
    } catch (e: any) {
      setResult({ loading: false, text: "", error: e?.message ?? String(e) })
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">新闻汇总</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="px-3 py-1 rounded hover:bg-primary/10 text-sm flex items-center gap-1"
          >
            <span className="i-ph:gear" />
            配置
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={result.loading}
            className="px-4 py-1 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50 disabled:cursor-not-allowed disabled:hover:bg-primary/20"
          >
            {result.loading ? "分析中..." : "开始分析"}
          </button>
        </div>
      </div>
      <InputArea />
      <ResultView />
      <ConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
}
