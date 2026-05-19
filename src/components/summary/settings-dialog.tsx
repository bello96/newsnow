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
  enabled: 0,
  lastSentDate: null,
  updatedAt: 0,
}

export function SettingsDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [token, setToken] = useAtom(adminTokenAtom)
  const [settings, setSettings] = useAtom(settingsAtom)
  const [draft, setDraft] = useState<UserSettings>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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

  const inputCls = "w-full p-2 mb-2 border rounded bg-transparent text-sm"
  const labelCls = "block text-xs op-70 mb-1"
  const sectionCls = "border-t pt-3 mt-3"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-base p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-3">配置</h3>

        <div>
          <label className={labelCls}>管理 Token (即 CRON_TOKEN)</label>
          <div className="flex gap-2">
            <input
              type="password"
              className={inputCls}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="必填，用于读写配置和历史"
            />
            <button
              type="button"
              className="px-3 py-1 mb-2 rounded bg-primary/20 hover:bg-primary/30 text-xs whitespace-nowrap"
              onClick={() => load(token)}
              disabled={!token || loading}
            >
              加载
            </button>
          </div>
        </div>

        <div className={sectionCls}>
          <div className="text-sm font-bold mb-2 op-80">LLM</div>
          <label className={labelCls}>API Key</label>
          <input
            type="password"
            className={inputCls}
            value={draft.llmApiKey}
            onChange={e => setDraft({ ...draft, llmApiKey: e.target.value })}
            placeholder="sk-..."
          />
          <label className={labelCls}>Base URL</label>
          <input
            type="text"
            className={inputCls}
            value={draft.llmBaseUrl}
            onChange={e => setDraft({ ...draft, llmBaseUrl: e.target.value })}
          />
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
                {" "}
                (custom)
              </option>
            )}
          </select>
        </div>

        <div className={sectionCls}>
          <div className="text-sm font-bold mb-2 op-80">邮件 (Resend)</div>
          <label className={labelCls}>Resend API Key</label>
          <input
            type="password"
            className={inputCls}
            value={draft.resendApiKey}
            onChange={e => setDraft({ ...draft, resendApiKey: e.target.value })}
            placeholder="re_..."
          />
          <label className={labelCls}>发件邮箱 (必须在 Resend 已验证域名下)</label>
          <input
            type="text"
            className={inputCls}
            value={draft.fromEmail}
            onChange={e => setDraft({ ...draft, fromEmail: e.target.value })}
            placeholder="news@dengjiabei.cn"
          />
          <label className={labelCls}>发件人显示名 (可选)</label>
          <input
            type="text"
            className={inputCls}
            value={draft.fromName}
            onChange={e => setDraft({ ...draft, fromName: e.target.value })}
            placeholder="信息速递员"
          />
          <label className={labelCls}>收件邮箱</label>
          <input
            type="text"
            className={inputCls}
            value={draft.toEmail}
            onChange={e => setDraft({ ...draft, toEmail: e.target.value })}
            placeholder="bello96@163.com"
          />
          <label className={labelCls}>
            主题模板 (
            {"{date}"}
            {" "}
            会替换为日期)
          </label>
          <input
            type="text"
            className={inputCls}
            value={draft.subjectTemplate}
            onChange={e => setDraft({ ...draft, subjectTemplate: e.target.value })}
          />
        </div>

        <div className={sectionCls}>
          <div className="text-sm font-bold mb-2 op-80">定时任务</div>
          <label className="flex items-center gap-2 mb-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled === 1}
              onChange={e => setDraft({ ...draft, enabled: e.target.checked ? 1 : 0 })}
            />
            启用定时（每小时触发的 cron 会检查此开关）
          </label>
          <label className={labelCls}>发送小时 (北京时间 0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            className={inputCls}
            value={draft.sendHour}
            onChange={e => setDraft({ ...draft, sendHour: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
          />
          {draft.lastSentDate && (
            <div className="text-xs op-60">
              上次发送：
              {draft.lastSentDate}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-500">
            错误：
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded hover:bg-primary/10 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="px-4 py-1 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50"
          >
            {loading ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  )
}
