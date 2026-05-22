import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { MAX_RECIPIENTS, PROVIDER_PRESETS, llmSettingsAtom } from "~/atoms/settings"
import type { EmailConfig, LLMSettings, ProviderId } from "~/atoms/settings"
import { apiFetch } from "~/utils/api"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

// sendAt(UTC ms，按北京时间解释) ↔ datetime-local 输入框的 "YYYY-MM-DDTHH:MM"
function sendAtToLocalInput(ms: number | null): string {
  if (!ms) {
    return ""
  }
  const b = new Date(ms + 8 * 3600 * 1000)
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}T${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`
}

function localInputToSendAt(s: string): number | null {
  if (!s) {
    return null
  }
  const ms = Date.parse(`${s}:00+08:00`)
  return Number.isNaN(ms) ? null : ms
}

export function SettingsDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [settings, setSettings] = useAtom(llmSettingsAtom)
  const [draft, setDraft] = useState<LLMSettings>(settings)
  const [activeTab, setActiveTab] = useState<ProviderId>(settings.activeProvider)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setActiveTab(settings.activeProvider)
      setError("")
    }
  }, [open, settings])

  const activePreset = PROVIDER_PRESETS.find(p => p.id === activeTab)!
  const cfg = draft.providers[activeTab]
  const email = draft.email

  function setCfg<K extends keyof typeof cfg>(key: K, value: typeof cfg[K]) {
    setDraft({
      ...draft,
      providers: {
        ...draft.providers,
        [activeTab]: { ...cfg, [key]: value },
      },
    })
  }

  function setEmail<K extends keyof EmailConfig>(key: K, value: EmailConfig[K]) {
    setDraft({ ...draft, email: { ...email, [key]: value } })
  }

  async function save() {
    setSaving(true)
    setError("")
    const next: LLMSettings = { ...draft, activeProvider: activeTab }
    const cleanedEmails = next.email.toEmails.map(e => e.trim()).filter(Boolean)

    if (next.email.enabled) {
      if (cleanedEmails.length === 0) {
        setError("开启定时发送需至少填写一个收件邮箱")
        setSaving(false)
        return
      }
      if (next.email.scheduleMode === "once") {
        if (!next.email.sendAt) {
          setError("请选择一次性发送的时间")
          setSaving(false)
          return
        }
        if (next.email.sendAt <= Date.now()) {
          setError("一次性发送时间必须晚于当前时间")
          setSaving(false)
          return
        }
      }
    }

    try {
      const activeCfg = next.providers[next.activeProvider]
      const body: Record<string, any> = {
        enabled: next.email.enabled ? 1 : 0,
        toEmails: cleanedEmails,
        scheduleMode: next.email.scheduleMode,
        sendHour: next.email.sendHour,
        sendMinute: next.email.sendMinute,
        sendAt: next.email.sendAt,
      }
      if (next.email.enabled) {
        body.llmApiKey = activeCfg.apiKey
        body.llmBaseUrl = activeCfg.baseUrl
        body.llmModel = activeCfg.model
      } else {
        body.llmApiKey = ""
      }
      await apiFetch<{ ok: boolean }>("settings", {
        method: "PUT",
        body,
      })
      setSettings({ ...next, email: { ...next.email, toEmails: cleanedEmails } })
      onClose()
    } catch (e: any) {
      setError(e?.message || "保存失败，请重试")
    } finally {
      setSaving(false)
    }
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
        className="bg-base p-5 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="i-ph:robot" />
            配置
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
          API Key 仅保存在浏览器本地；开启定时邮件后，将上传到服务器以便定时调用。
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

        <div className="mt-5 pt-3 border-t border-primary/15">
          <label className={labelCls}>
            收件邮箱（最多
            {" "}
            {MAX_RECIPIENTS}
            {" "}
            个 · 手动 / 定时发送共用）
          </label>
          <div className="flex flex-col gap-2">
            {email.toEmails.map((addr, i) => {
              // 简单的可增删字符串列表，按 index 操作即可
              return (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="email"
                    className={inputCls}
                    value={addr}
                    onChange={(e) => {
                      const next = [...email.toEmails]
                      next[i] = e.target.value
                      setEmail("toEmails", next)
                    }}
                    placeholder="your@email.com"
                  />
                  <button
                    type="button"
                    onClick={() => setEmail("toEmails", email.toEmails.filter((_, j) => j !== i))}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded op-50 hover:op-100 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    aria-label="删除该邮箱"
                  >
                    <span className="i-ph:trash" />
                  </button>
                </div>
              )
            })}
            {email.toEmails.length < MAX_RECIPIENTS && (
              <button
                type="button"
                onClick={() => setEmail("toEmails", [...email.toEmails, ""])}
                className="self-start flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                <span className="i-ph:plus" />
                添加邮箱
              </button>
            )}
            {email.toEmails.length === 0 && (
              <span className="text-xs op-50">点「添加邮箱」填写收件人，再到「生成今日总结」后即可手动发送</span>
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-primary/15">
          <label className={$([
            "flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors mb-3",
            email.enabled ? "bg-primary/15" : "bg-primary/5 hover:bg-primary/10",
          ])}
          >
            <input
              type="checkbox"
              checked={email.enabled}
              onChange={e => setEmail("enabled", e.target.checked)}
            />
            <span className="text-sm font-medium flex items-center gap-1">
              <span className="i-ph:clock" />
              开启定时发送
            </span>
            <span className="ml-auto text-xs">
              {email.enabled
                ? <span className="color-primary">● 已开启</span>
                : <span className="op-50">○ 关闭</span>}
            </span>
          </label>

          {email.enabled && (
            <>
              <div className="flex gap-2 mb-3">
                {([
                  { id: "daily", label: "每天循环", icon: "i-ph:repeat" },
                  { id: "once", label: "一次性", icon: "i-ph:calendar-check" },
                ] as const).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEmail("scheduleMode", m.id)}
                    className={$([
                      "flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm transition-all border",
                      email.scheduleMode === m.id
                        ? "bg-primary/15 border-primary/40 color-primary font-bold"
                        : "border-transparent bg-primary/5 op-70 hover:op-100",
                    ])}
                  >
                    <span className={m.icon} />
                    {m.label}
                  </button>
                ))}
              </div>

              {email.scheduleMode === "daily"
                ? (
                    <div className="mb-3">
                      <label className={labelCls}>每天发送时间（北京时间，每 30 分钟）</label>
                      <select
                        className={inputCls}
                        value={`${pad(email.sendHour)}:${pad(email.sendMinute)}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number)
                          setDraft({ ...draft, email: { ...email, sendHour: h, sendMinute: m } })
                        }}
                      >
                        {Array.from({ length: 48 }, (_, i) => {
                          const h = Math.floor(i / 2)
                          const m = i % 2 === 0 ? 0 : 30
                          const label = `${pad(h)}:${pad(m)}`
                          return <option key={label} value={label}>{label}</option>
                        })}
                      </select>
                    </div>
                  )
                : (
                    <div className="mb-3">
                      <label className={labelCls}>发送时间（北京时间，发完自动关闭）</label>
                      <input
                        type="datetime-local"
                        className={inputCls}
                        value={sendAtToLocalInput(email.sendAt)}
                        min={sendAtToLocalInput(Date.now())}
                        onChange={e => setEmail("sendAt", localInputToSendAt(e.target.value))}
                      />
                    </div>
                  )}

              <div className="text-xs op-50">
                {email.scheduleMode === "daily"
                  ? "服务器每天到点用当前 Provider 配置生成口播稿，发到上面所有收件邮箱。"
                  : "到指定时间点后发送一次，发完自动关闭定时。"}
                {" "}
                实际触发由 GitHub Actions 调度，可能延迟最多 30 分钟。
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 p-2 text-sm text-red-500 bg-red-500/10 rounded">
            <span className="i-ph:warning-circle inline-block align-middle mr-1" />
            {error}
          </div>
        )}

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
            disabled={saving}
            className="px-4 py-1.5 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50"
          >
            {saving ? "保存中..." : `保存并使用 ${activePreset.name}`}
          </button>
        </div>
      </div>
    </div>
  )
}
