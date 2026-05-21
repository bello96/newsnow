import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { SettingsDialog } from "~/components/summary/settings-dialog"
import { HistoryList } from "~/components/summary/history-list"
import { ResultView } from "~/components/summary/result-view"
import { summaryResultAtom } from "~/atoms/summary"
import { historyAtom, llmSettingsAtom } from "~/atoms/settings"
import type { HistoryRow } from "~/atoms/settings"
import { apiFetch, llmFetch } from "~/utils/api"

interface AnalyzeResponse {
  text: string
  newsCount: number
  model: string
}

export const Route = createFileRoute("/summary")({ component: SummaryPage })

function SummaryPage() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settings = useAtomValue(llmSettingsAtom)
  const [result, setResult] = useAtom(summaryResultAtom)
  const setHistory = useSetAtom(historyAtom)

  const onAnalyze = async () => {
    const cfg = settings.providers[settings.activeProvider]
    if (!cfg || !cfg.apiKey) {
      setSettingsOpen(true)
      return
    }
    setResult({ loading: true, text: "" })
    try {
      const data = await llmFetch<AnalyzeResponse>("analyze", cfg.apiKey, {
        method: "POST",
        body: {
          baseUrl: cfg.baseUrl,
          model: cfg.model,
        },
      })
      setResult({ loading: false, text: data.text })
      try {
        const h = await apiFetch<{ count: number, items: HistoryRow[] }>("history?limit=7")
        setHistory(h.items)
      } catch {
        // 历史刷新失败不影响主流程
      }
    } catch (e: any) {
      setResult({ loading: false, text: "", error: e?.message ?? String(e) })
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">信息速递员 · 口播稿</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
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
            {result.loading ? "生成中..." : "生成今日总结"}
          </button>
        </div>
      </div>
      <div className="text-xs op-60">
        点「生成今日总结」让大模型从今日累积的新闻里挑出爆点生成口播稿。API Key 仅保存在浏览器本地。
      </div>
      <ResultView />
      <div className="mt-2">
        <HistoryList />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
