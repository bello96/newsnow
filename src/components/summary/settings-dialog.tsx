import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { MODEL_OPTIONS, llmConfigAtom } from "~/atoms/settings"
import type { LLMConfig } from "~/atoms/settings"

export function SettingsDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [config, setConfig] = useAtom(llmConfigAtom)
  const [draft, setDraft] = useState<LLMConfig>(config)

  useEffect(() => {
    if (open) {
      setDraft(config)
    }
  }, [open, config])

  function save() {
    setConfig(draft)
    onClose()
  }

  if (!open) {
    return null
  }

  const inputCls = "w-full p-2 border border-primary/20 rounded bg-primary/5 text-sm focus:outline-none focus:border-primary focus:bg-primary/8 transition-colors"
  const labelCls = "block text-xs op-70 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-base p-5 rounded-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="i-ph:robot" />
            LLM 配置
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="op-50 hover:op-100 transition-opacity text-lg"
            aria-label="关闭"
          >
            <span className="i-ph:x" />
          </button>
        </div>

        <div className="text-xs op-60 mb-4 p-3 bg-primary/5 rounded">
          API Key 仅保存在你的浏览器本地，不会上传服务器。
        </div>

        <div className="mb-3">
          <label className={labelCls}>API Key</label>
          <input
            type="password"
            className={inputCls}
            value={draft.apiKey}
            onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder="sk-..."
            autoFocus
          />
        </div>

        <div className="mb-3">
          <label className={labelCls}>Base URL</label>
          <input
            type="text"
            className={inputCls}
            value={draft.baseUrl}
            onChange={e => setDraft({ ...draft, baseUrl: e.target.value })}
          />
        </div>

        <div className="mb-3">
          <label className={labelCls}>Model</label>
          <select
            className={inputCls}
            value={draft.model}
            onChange={e => setDraft({ ...draft, model: e.target.value })}
          >
            {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            {!MODEL_OPTIONS.includes(draft.model as typeof MODEL_OPTIONS[number]) && (
              <option value={draft.model}>
                {draft.model}
                {" (custom)"}
              </option>
            )}
          </select>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded hover:bg-primary/10 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            className="px-4 py-1.5 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
