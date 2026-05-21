import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { MODEL_OPTIONS, adminTokenAtom, settingsAtom } from "~/atoms/settings"
import type { UserSettings } from "~/atoms/settings"
import { authedFetch } from "~/utils/api"

const EMPTY_SETTINGS: UserSettings = {
  id: 1,
  llmApiKey: "",
  llmBaseUrl: "https://api.deepseek.com",
  llmModel: "deepseek-v4-pro",
  resendApiKey: "",
  fromEmail: "",
  fromName: "",
  toEmail: "",
  subjectTemplate: "今日口播稿 - {date}",
  sendHour: 7,
  sendMinute: 0,
  enabled: 0,
  lastSentDate: null,
  updatedAt: 0,
}

type TabId = "llm" | "email" | "schedule"

const TABS: { id: TabId, label: string, icon: string }[] = [
  { id: "llm", label: "LLM", icon: "i-ph:robot" },
  { id: "email", label: "邮件", icon: "i-ph:envelope-simple" },
  { id: "schedule", label: "定时", icon: "i-ph:clock" },
]

export function SettingsDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [token, setToken] = useAtom(adminTokenAtom)
  const [settings, setSettings] = useAtom(settingsAtom)
  const [draft, setDraft] = useState<UserSettings>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<TabId>("llm")

  useEffect(() => {
    if (!open) {
      return
    }
    if (settings) {
      setDraft(settings)
      return
    }
    if (token) {
      void load(token)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function load(t: string) {
    setLoading(true)
    setError("")
    try {
      const data = await authedFetch<UserSettings>("settings", t)
      setSettings(data)
      setDraft(data)
    } catch (e: any) {
      setError(e?.message || "加载失败")
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!token) {
      setError("请先填写管理 Token")
      return
    }
    setLoading(true)
    setError("")
    try {
      const updated = await authedFetch<UserSettings>("settings", token, {
        method: "PUT",
        body: {
          llmApiKey: draft.llmApiKey,
          llmBaseUrl: draft.llmBaseUrl,
          llmModel: draft.llmModel,
          resendApiKey: draft.resendApiKey,
          fromEmail: draft.fromEmail,
          fromName: draft.fromName,
          toEmail: draft.toEmail,
          subjectTemplate: draft.subjectTemplate,
          sendHour: draft.sendHour,
          sendMinute: draft.sendMinute,
          enabled: draft.enabled,
        },
      })
      setSettings(updated)
      setDraft(updated)
      onClose()
    } catch (e: any) {
      setError(e?.message || "保存失败")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return null
  }

  const inputCls = "w-full p-2 border rounded bg-transparent text-sm focus:outline-none focus:border-primary transition-colors"
  const labelCls = "block text-xs op-70 mb-1"
  const fieldCls = "mb-3"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-base p-5 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="i-ph:gear-six" />
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

        <div className="mb-4">
          <label className={labelCls}>
            <span className="i-ph:key align-middle inline-block mr-1" />
            管理 Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              className={inputCls}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="必填，CRON_TOKEN"
            />
            <button
              type="button"
              className="px-3 py-1 rounded bg-primary/20 hover:bg-primary/30 text-xs whitespace-nowrap disabled:op-50"
              onClick={() => load(token)}
              disabled={!token || loading}
            >
              加载
            </button>
          </div>
        </div>

        <div className="flex p-1 bg-primary/5 rounded-lg mb-4">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={$([
                "flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm transition-all",
                activeTab === t.id
                  ? "bg-base shadow-sm color-primary font-bold"
                  : "op-60 hover:op-100",
              ])}
            >
              <span className={t.icon} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-[260px]">
          {activeTab === "llm" && (
            <div>
              <div className={fieldCls}>
                <label className={labelCls}>API Key</label>
                <input
                  type="password"
                  className={inputCls}
                  value={draft.llmApiKey}
                  onChange={e => setDraft({ ...draft, llmApiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>Base URL</label>
                <input
                  type="text"
                  className={inputCls}
                  value={draft.llmBaseUrl}
                  onChange={e => setDraft({ ...draft, llmBaseUrl: e.target.value })}
                />
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>Model</label>
                <select
                  className={`${inputCls} bg-base`}
                  value={draft.llmModel}
                  onChange={e => setDraft({ ...draft, llmModel: e.target.value })}
                >
                  {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  {!MODEL_OPTIONS.includes(draft.llmModel as typeof MODEL_OPTIONS[number]) && (
                    <option value={draft.llmModel}>
                      {draft.llmModel}
                      {" (custom)"}
                    </option>
                  )}
                </select>
              </div>
            </div>
          )}

          {activeTab === "email" && (
            <div>
              <div className={fieldCls}>
                <label className={labelCls}>Resend API Key</label>
                <input
                  type="password"
                  className={inputCls}
                  value={draft.resendApiKey}
                  onChange={e => setDraft({ ...draft, resendApiKey: e.target.value })}
                  placeholder="re_..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className={labelCls}>发件邮箱（已验证域名）</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={draft.fromEmail}
                    onChange={e => setDraft({ ...draft, fromEmail: e.target.value })}
                    placeholder="news@dengjiabei.cn"
                  />
                </div>
                <div>
                  <label className={labelCls}>发件人显示名</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={draft.fromName}
                    onChange={e => setDraft({ ...draft, fromName: e.target.value })}
                    placeholder="信息速递员"
                  />
                </div>
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>收件邮箱</label>
                <input
                  type="text"
                  className={inputCls}
                  value={draft.toEmail}
                  onChange={e => setDraft({ ...draft, toEmail: e.target.value })}
                  placeholder="bello96@163.com"
                />
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>
                  主题模板
                  <span className="op-50 ml-1">
                    （
                    {"{date}"}
                    {" 替换为日期）"}
                  </span>
                </label>
                <input
                  type="text"
                  className={inputCls}
                  value={draft.subjectTemplate}
                  onChange={e => setDraft({ ...draft, subjectTemplate: e.target.value })}
                />
              </div>
            </div>
          )}

          {activeTab === "schedule" && (
            <div>
              <label className={$([
                "flex items-center gap-2 p-3 rounded-lg mb-3 cursor-pointer transition-colors",
                draft.enabled === 1 ? "bg-primary/15" : "bg-primary/5 hover:bg-primary/10",
              ])}
              >
                <input
                  type="checkbox"
                  checked={draft.enabled === 1}
                  onChange={e => setDraft({ ...draft, enabled: e.target.checked ? 1 : 0 })}
                />
                <span className="text-sm font-medium">启用定时发送</span>
                <span className="ml-auto text-xs">
                  {draft.enabled === 1
                    ? <span className="color-primary">● 已启用</span>
                    : <span className="op-50">○ 关闭</span>}
                </span>
              </label>
              <div className={fieldCls}>
                <label className={labelCls}>发送时间（北京时间，每 30 分钟）</label>
                <select
                  className={`${inputCls} bg-base`}
                  value={`${String(draft.sendHour).padStart(2, "0")}:${String(draft.sendMinute).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number)
                    setDraft({ ...draft, sendHour: h, sendMinute: m })
                  }}
                >
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = Math.floor(i / 2)
                    const m = i % 2 === 0 ? 0 : 30
                    const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
                    return <option key={label} value={label}>{label}</option>
                  })}
                </select>
              </div>
              <div className="text-xs op-50">
                实际触发可能延迟 5-10 分钟（GitHub Actions 调度）
              </div>
              {draft.lastSentDate && (
                <div className="text-xs op-60 mt-2 flex items-center gap-1">
                  <span className="i-ph:check-circle" />
                  <span>
                    上次发送：
                    {draft.lastSentDate}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 p-2 text-sm text-red-500 bg-red-500/10 rounded">
            <span className="i-ph:warning-circle inline-block align-middle mr-1" />
            {error}
          </div>
        )}

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
            disabled={loading}
            className="px-4 py-1.5 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50"
          >
            {loading ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  )
}
