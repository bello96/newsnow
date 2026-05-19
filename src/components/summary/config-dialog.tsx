import { useAtom } from "jotai"
import { MODEL_OPTIONS, llmConfigAtom } from "~/atoms/summary"

export function ConfigDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [config, setConfig] = useAtom(llmConfigAtom)
  if (!open) {
    return null
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-base p-6 rounded-xl w-[90%] max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">LLM 配置</h3>
        <label className="block text-sm mb-1">API Key</label>
        <input
          type="password"
          className="w-full p-2 mb-3 border rounded bg-transparent"
          value={config.apiKey}
          onChange={e => setConfig({ ...config, apiKey: e.target.value })}
          placeholder="sk-..."
        />
        <label className="block text-sm mb-1">Base URL</label>
        <input
          type="text"
          className="w-full p-2 mb-3 border rounded bg-transparent"
          value={config.baseUrl}
          onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
          placeholder="https://api.deepseek.com"
        />
        <label className="block text-sm mb-1">Model</label>
        <select
          className="w-full p-2 mb-3 border rounded bg-base"
          value={config.model}
          onChange={e => setConfig({ ...config, model: e.target.value })}
        >
          {MODEL_OPTIONS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
          {!MODEL_OPTIONS.includes(config.model as typeof MODEL_OPTIONS[number]) && (
            <option value={config.model}>
              {config.model}
              {" "}
              (custom)
            </option>
          )}
        </select>
        <div className="text-xs op-60 mb-2">
          Key 保存在浏览器 localStorage，仅在调用时通过本站后端代理转发到上述 Base URL。
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded hover:bg-primary/10">关闭</button>
        </div>
      </div>
    </div>
  )
}
