import { useAtomValue } from "jotai"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { summaryResultAtom } from "~/atoms/summary"

export function ResultView() {
  const result = useAtomValue(summaryResultAtom)
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  if (result.loading) {
    return <div className="p-6 text-center op-70">分析中，请稍候...</div>
  }
  if (result.error) {
    return (
      <div className="p-6 text-red-500">
        错误：
        {result.error}
      </div>
    )
  }
  if (!result.text) {
    return <div className="p-6 text-center op-50">点击"开始分析"生成总结</div>
  }
  return (
    <article className="relative prose prose-sm dark:prose-invert max-w-none p-4 border rounded-lg">
      <button
        type="button"
        onClick={onCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-primary/20 hover:bg-primary/30 not-prose"
      >
        {copied ? "已复制 ✓" : "复制原文"}
      </button>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
        }}
      >
        {result.text}
      </ReactMarkdown>
    </article>
  )
}
