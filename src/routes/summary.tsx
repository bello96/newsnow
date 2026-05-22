import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { SettingsDialog } from "~/components/summary/settings-dialog"
import { HistoryList } from "~/components/summary/history-list"
import { ResultView } from "~/components/summary/result-view"
import { summaryResultAtom } from "~/atoms/summary"
import { DEEPSEEK_BASE_URL, historyAtom, llmSettingsAtom } from "~/atoms/settings"
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
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refreshHistory = async () => {
    try {
      const h = await apiFetch<{ count: number; items: HistoryRow[] }>("history?limit=7")
      setHistory(h.items)
    } catch {
      // 历史刷新失败不影响主流程
    }
  }

  const onAnalyze = async () => {
    const cfg = settings.llm
    if (!cfg.apiKey) {
      setSettingsOpen(true)
      return
    }
    setSendMsg(null)
    setResult({ loading: true, text: "" })
    try {
      const data = await llmFetch<AnalyzeResponse>("analyze", cfg.apiKey, {
        method: "POST",
        body: {
          baseUrl: DEEPSEEK_BASE_URL,
          model: cfg.model,
        },
      })
      setResult({ loading: false, text: data.text })
      await refreshHistory()
    } catch (e: any) {
      setResult({ loading: false, text: "", error: e?.message ?? String(e) })
    }
  }

  const onSend = async () => {
    if (!result.text) {
      return
    }
    const emails = settings.email.toEmails.map((e) => e.trim()).filter(Boolean)
    if (emails.length === 0) {
      setSendMsg({ ok: false, text: "请先在配置里添加收件邮箱" })
      setSettingsOpen(true)
      return
    }
    setSending(true)
    setSendMsg(null)
    try {
      await apiFetch("send", {
        method: "POST",
        body: { text: result.text, toEmails: emails },
      })
      setSendMsg({ ok: true, text: `已发送到 ${emails.length} 个邮箱` })
      await refreshHistory()
    } catch (e: any) {
      setSendMsg({ ok: false, text: e?.data?.message || e?.message || "发送失败，请重试" })
    } finally {
      setSending(false)
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
            {result.loading ? "生成中..." : "立即分析"}
          </button>
        </div>
      </div>
      <div className="text-xs op-60">
        点「立即分析」让大模型从今日累积的新闻里挑出爆点生成口播稿，确认无误后再「发送到邮箱」。API Key
        仅保存在浏览器本地。
      </div>
      <ResultView />
      {!result.loading && result.text && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="px-4 py-1.5 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <span className="i-ph:paper-plane-tilt" />
            {sending ? "发送中..." : "发送到邮箱"}
          </button>
          {sendMsg && (
            <span
              className={`text-sm flex items-center gap-1 ${sendMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
            >
              <span className={sendMsg.ok ? "i-ph:check-circle" : "i-ph:warning-circle"} />
              {sendMsg.text}
            </span>
          )}
        </div>
      )}
      <div className="mt-2">
        <HistoryList />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
