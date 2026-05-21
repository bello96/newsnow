import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { PROVIDER_PRESETS, llmSettingsAtom } from "~/atoms/settings"
import type { LLMSettings, ProviderId } from "~/atoms/settings"

export function SettingsDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [settings, setSettings] = useAtom(llmSettingsAtom)
  const [draft, setDraft] = useState<LLMSettings>(settings)
  const [activeTab, setActiveTab] = useState<ProviderId>(settings.activeProvider)

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setActiveTab(settings.activeProvider)
    }
  }, [open, settings])

  const activePreset = PROVIDER_PRESETS.find(p => p.id === activeTab)!
  const cfg = draft.providers[activeTab]

  function setCfg<K extends keyof typeof cfg>(key: K, value: typeof cfg[K]) {
    setDraft({
      ...draft,
      providers: {
        ...draft.providers,
        [activeTab]: { ...cfg, [key]: value },
      },
    })
  }

  function save() {
    setSettings({ ...draft, activeProvider: activeTab })
    onClose()
  }

  function resetBaseUrl() {
    setCfg("baseUrl", activePreset.baseUrl)
  }

  if (!open) {
    return null
  }

  const inputCls = "w-full p-2 border border-primary/20 rounded bg-zinc-200/60 dark:bg-zinc-700/40 text-sm focus:outline-none focus:border-primary transition-colors"
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
          API Key 仅保存在浏览器本地。保存后会使用「当前选中」的供应商进行分析。
        </div>

        <div className="flex p-1 bg-primary/5 rounded-lg mb-4">
          {PROVIDER_PRESETS.map((p) => {
            const filled = !!draft.providers[p.id].apiKey
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveTab(p.id)}
                className={$([
                  "flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm transition-all",
                  activeTab === p.id
                    ? "bg-base shadow-sm color-primary font-bold"
                    : "op-60 hover:op-100",
                ])}
              >
                {p.name}
                {filled && (
                  <span className="i-ph:check-circle-fill text-xs color-primary" title="已填" />
                )}
              </button>
            )
          })}
        </div>

        <div className="mb-3">
          <label className={labelCls}>API Key</label>
          <input
            type="password"
            className={inputCls}
            value={cfg.apiKey}
            onChange={e => setCfg("apiKey", e.target.value)}
            placeholder={activeTab === "deepseek" ? "sk-..." : activeTab === "kimi" ? "sk-..." : "..."}
            autoFocus
          />
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Base URL</label>
            {cfg.baseUrl !== activePreset.baseUrl && (
              <button
                type="button"
                onClick={resetBaseUrl}
                className="text-xs op-60 hover:op-100 mb-1"
              >
                恢复默认
              </button>
            )}
          </div>
          <input
            type="text"
            className={inputCls}
            value={cfg.baseUrl}
            onChange={e => setCfg("baseUrl", e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className={labelCls}>Model</label>
          <select
            className={inputCls}
            value={cfg.model}
            onChange={e => setCfg("model", e.target.value)}
          >
            {activePreset.models.map(m => <option key={m} value={m}>{m}</option>)}
            {!activePreset.models.includes(cfg.model) && (
              <option value={cfg.model}>
                {cfg.model}
                {" (custom)"}
              </option>
            )}
          </select>
        </div>

        <div className="flex justify-end gap-2 mt-4">
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
            保存并使用
            {" "}
            {activePreset.name}
          </button>
        </div>
      </div>
    </div>
  )
}
