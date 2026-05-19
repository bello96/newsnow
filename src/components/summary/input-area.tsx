import { useAtom } from "jotai"
import { summaryRequirementAtom } from "~/atoms/summary"

export function InputArea() {
  const [text, setText] = useAtom(summaryRequirementAtom)

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ""))
    reader.readAsText(file, "utf-8")
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm op-70">导入 .md 要求文件：</label>
        <input type="file" accept=".md,.txt" onChange={onUpload} className="text-sm" />
      </div>
      <textarea
        className="w-full p-3 border rounded-lg bg-transparent resize-y min-h-32"
        placeholder={"或在此输入分析要求，例如：\n- 主题：科技领域\n- 字数：500\n- 格式：先列出要点，再写一段总结"}
        value={text}
        onChange={e => setText(e.target.value)}
      />
    </div>
  )
}
