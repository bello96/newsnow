import { useAtom, useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { adminTokenAtom, historyAtom } from "~/atoms/settings"
import type { HistoryRow } from "~/atoms/settings"
import { authedFetch } from "~/utils/api"

function formatTime(ms: number): string {
  const d = new Date(ms + 8 * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

function statusIcon(s: string) {
  if (s === "sent") {
    return <span className="text-green-500">✓ 已发</span>
  }
  if (s === "failed") {
    return <span className="text-red-500">✗ 失败</span>
  }
  return <span className="op-60">⊘ 试运行</span>
}

function HistoryItem({ row }: { row: HistoryRow }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <li className="border rounded p-3 mb-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="font-mono op-70">{formatTime(row.generatedAt)}</span>
          {statusIcon(row.emailStatus)}
          {row.newsCount && (
            <span className="op-60">
              {row.newsCount}
              条素材
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="px-2 py-0.5 text-xs rounded bg-primary/20 hover:bg-primary/30"
          >
            {copied ? "已复制 ✓" : "复制"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="px-2 py-0.5 text-xs rounded hover:bg-primary/10"
          >
            {expanded ? "收起" : "展开"}
          </button>
        </div>
      </div>
      {row.emailError && (
        <div className="mt-2 text-xs text-red-500">
          错误：
          {row.emailError}
        </div>
      )}
      {expanded
        ? (
            <pre className="mt-3 text-sm whitespace-pre-wrap font-sans op-90">{row.text}</pre>
          )
        : (
            <div className="mt-2 text-sm op-70 line-clamp-2">
              {row.text.slice(0, 80)}
              {row.text.length > 80 ? "..." : ""}
            </div>
          )}
    </li>
  )
}

export function HistoryList() {
  const token = useAtomValue(adminTokenAtom)
  const [history, setHistory] = useAtom(historyAtom)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      return
    }
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function load() {
    if (!token) {
      return
    }
    setLoading(true)
    setError("")
    try {
      const data = await authedFetch<{ count: number, items: HistoryRow[] }>("history?limit=7", token)
      setHistory(data.items)
    } catch (e: any) {
      setError(e?.message || "加载失败")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return <div className="p-4 text-sm op-50">填写管理 Token 后显示历史记录</div>
  }
  if (loading && history.length === 0) {
    return <div className="p-4 text-sm op-70">加载中...</div>
  }
  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">
        错误：
        {error}
        <button type="button" onClick={load} className="ml-2 underline">重试</button>
      </div>
    )
  }
  if (history.length === 0) {
    return <div className="p-4 text-sm op-50">暂无历史记录</div>
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold">最近 7 期</h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-2 py-0.5 text-xs rounded hover:bg-primary/10 disabled:op-50"
        >
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>
      <ul className="list-none p-0">
        {history.map(row => <HistoryItem key={row.id} row={row} />)}
      </ul>
    </div>
  )
}
