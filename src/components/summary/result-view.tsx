import { useAtomValue } from "jotai"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { summaryResultAtom } from "~/atoms/summary"

export function ResultView() {
  const result = useAtomValue(summaryResultAtom)
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
    <article className="prose prose-sm dark:prose-invert max-w-none p-4 border rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.text}</ReactMarkdown>
    </article>
  )
}
