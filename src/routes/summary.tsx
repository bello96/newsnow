import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { SettingsDialog } from "~/components/summary/settings-dialog"
import { HistoryList } from "~/components/summary/history-list"
import { ResultView } from "~/components/summary/result-view"
import { summaryResultAtom } from "~/atoms/summary"
import { adminTokenAtom, historyAtom } from "~/atoms/settings"
import type { HistoryRow } from "~/atoms/settings"
import { authedFetch } from "~/utils/api"

interface AnalyzeResponse {
  dryRun: boolean
  text: string
  newsCount: number
  emailStatus: string
  emailError: string | null
  today: string
  beijingHour: number
}

export const Route = createFileRoute("/summary")({ component: SummaryPage })

function SummaryPage() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const token = useAtomValue(adminTokenAtom)
  const [result, setResult] = useAtom(summaryResultAtom)
  const setHistory = useSetAtom(historyAtom)

  const onAnalyze = async () => {
    if (!token) {
      setSettingsOpen(true)
      return
    }
    setResult({ loading: true, text: "" })
    try {
      const data = await authedFetch<AnalyzeResponse>("cron/analyze?dryRun=true", token, {
        method: "POST",
      })
      setResult({ loading: false, text: data.text })
      try {
        const h = await authedFetch<{ count: number, items: HistoryRow[] }>("history?limit=7", token)
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
            {result.loading ? "生成中..." : "试运行（仅生成不发邮件）"}
          </button>
        </div>
      </div>
      <div className="text-xs op-60">
        定时任务每天根据「配置 - 发送小时」自动生成并发邮件；此处的「试运行」用于实时调试，不计入定时窗口。
      </div>
      <ResultView />
      <div className="mt-2">
        <HistoryList />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
