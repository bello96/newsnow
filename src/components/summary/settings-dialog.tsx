import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODELS, MAX_RECIPIENTS, llmSettingsAtom } from "~/atoms/settings"
import type { EmailConfig, LLMConfig, LLMSettings } from "~/atoms/settings"
import { apiFetch, llmFetch } from "~/utils/api"

// 收件邮箱白名单正则（域名分段不含点，避免超线性回溯）
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
// 每天发送时间 HH:MM（24 小时制）
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

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
  const [dailyTime, setDailyTime] = useState("07:00")
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState("")
  const [error, setError] = useState("")
  const [okMsg, setOkMsg] = useState("")

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setDailyTime(`${pad(settings.email.sendHour)}:${pad(settings.email.sendMinute)}`)
      setError("")
      setOkMsg("")
    }
  }, [open, settings])

  const cfg = draft.llm
  const email = draft.email
  // 「发送」按钮可点条件：已填 API Key + 至少一个收件邮箱
  const canSend = cfg.apiKey.trim() !== "" && email.toEmails.some(e => e.trim() !== "")

  function setCfg<K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) {
    setDraft({ ...draft, llm: { ...draft.llm, [key]: value } })
  }

  function setEmail<K extends keyof EmailConfig>(key: K, value: EmailConfig[K]) {
    setDraft({ ...draft, email: { ...email, [key]: value } })
  }

  // 校验收件邮箱：返回清洗后的列表，非法时抛出错误信息
  function validateEmails(): string[] {
    const cleaned = email.toEmails.map(e => e.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      throw new Error("请至少填写一个收件邮箱")
    }
    const bad = cleaned.find(e => !EMAIL_RE.test(e))
    if (bad) {
      throw new Error(`收件邮箱格式无效：${bad}`)
    }
    return cleaned
  }

  // 未开启定时：分析后立即发送，并作废历史定时任务
  async function onImmediateSend() {
    setError("")
    setOkMsg("")
    const apiKey = cfg.apiKey.trim()
    if (!apiKey) {
      setError("请先填写 DeepSeek API Key")
      return
    }
    let cleanedEmails: string[]
    try {
      cleanedEmails = validateEmails()
    } catch (e: any) {
      setError(e.message)
      return
    }

    setBusy(true)
    try {
      // 作废历史定时任务（单行表，enabled=0 即停）并持久化邮箱
      await apiFetch("settings", {
        method: "PUT",
        body: { enabled: 0, toEmails: cleanedEmails, llmApiKey: "" },
      })
      setPhase("分析中…")
      const data = await llmFetch<{ text: string }>("analyze", apiKey, {
        method: "POST",
        body: { baseUrl: DEEPSEEK_BASE_URL, model: cfg.model },
      })
      setPhase("发送中…")
      await apiFetch("send", {
        method: "POST",
        body: { text: data.text, toEmails: cleanedEmails },
      })
      setSettings({ ...draft, email: { ...email, enabled: false, toEmails: cleanedEmails } })
      setOkMsg(`已分析并发送到 ${cleanedEmails.length} 个邮箱`)
    } catch (e: any) {
      setError(e?.data?.message || e?.message || "发送失败，请重试")
    } finally {
      setBusy(false)
      setPhase("")
    }
  }

  // 开启定时：校验时间后保存为唯一定时任务，覆盖历史任务
  async function onScheduledSend() {
    setError("")
    setOkMsg("")
    const apiKey = cfg.apiKey.trim()
    if (!apiKey) {
      setError("请先填写 DeepSeek API Key")
      return
    }
    let cleanedEmails: string[]
    try {
      cleanedEmails = validateEmails()
    } catch (e: any) {
      setError(e.message)
      return
    }

    let sendHour = email.sendHour
    let sendMinute = email.sendMinute
    if (email.scheduleMode === "daily") {
      const m = TIME_RE.exec(dailyTime.trim())
      if (!m) {
        setError("每天发送时间格式不正确，请输入 00:00 ~ 23:59")
        return
      }
      sendHour = Number(m[1])
      sendMinute = Number(m[2])
    } else {
      if (!email.sendAt) {
        setError("请选择一次性发送的时间")
        return
      }
      if (email.sendAt <= Date.now()) {
        setError("一次性发送时间必须晚于当前时间")
        return
      }
    }

    setBusy(true)
    try {
      await apiFetch<{ ok: boolean }>("settings", {
        method: "PUT",
        body: {
          enabled: 1,
          toEmails: cleanedEmails,
          scheduleMode: email.scheduleMode,
          sendHour,
          sendMinute,
          sendAt: email.scheduleMode === "once" ? email.sendAt : null,
          llmApiKey: apiKey,
          llmBaseUrl: DEEPSEEK_BASE_URL,
          llmModel: cfg.model,
        },
      })
      setSettings({ ...draft, email: { ...email, enabled: true, toEmails: cleanedEmails, sendHour, sendMinute } })
      onClose()
    } catch (e: any) {
      setError(e?.message || "保存失败，请重试")
    } finally {
      setBusy(false)
    }
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
          使用 DeepSeek 模型。API Key 仅保存在浏览器本地；开启定时发送后，将上传到服务器以便定时调用。
        </div>

        <div className="mb-3">
          <label className={labelCls}>DeepSeek API Key</label>
          <input
            type="password"
            className={inputCls}
            value={cfg.apiKey}
            onChange={e => setCfg("apiKey", e.target.value)}
            placeholder="sk-..."
            autoFocus
          />
        </div>

        <div className="mb-3">
          <label className={labelCls}>Model</label>
          <select
            className={inputCls}
            value={cfg.model}
            onChange={e => setCfg("model", e.target.value)}
          >
            {DEEPSEEK_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            {!DEEPSEEK_MODELS.includes(cfg.model) && (
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
              <span className="text-xs op-50">填好收件邮箱与 API Key 后，点下方「发送」即可立即分析并发送</span>
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
                  { id: "daily", label: "每天", icon: "i-ph:repeat" },
                  { id: "once", label: "一次", icon: "i-ph:calendar-check" },
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
                      <label className={labelCls}>每天发送时间（24 小时制，如 09:00）</label>
                      <input
                        type="text"
                        className={inputCls}
                        value={dailyTime}
                        onChange={e => setDailyTime(e.target.value)}
                        placeholder="09:00"
                        maxLength={5}
                        inputMode="numeric"
                      />
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
                  ? "服务器每天到点用 DeepSeek 生成口播稿，发到上面所有收件邮箱。"
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
        {okMsg && (
          <div className="mt-3 p-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded">
            <span className="i-ph:check-circle inline-block align-middle mr-1" />
            {okMsg}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded hover:bg-primary/10 text-sm disabled:op-50"
          >
            {okMsg ? "关闭" : "取消"}
          </button>
          {email.enabled
            ? (
                <button
                  type="button"
                  onClick={onScheduledSend}
                  disabled={busy}
                  className="px-4 py-1.5 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span className="i-ph:clock" />
                  {busy ? "保存中…" : "定时发送"}
                </button>
              )
            : (
                <button
                  type="button"
                  onClick={onImmediateSend}
                  disabled={!canSend || busy}
                  className="px-4 py-1.5 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span className="i-ph:paper-plane-tilt" />
                  {busy ? (phase || "处理中…") : "发送"}
                </button>
              )}
        </div>
      </div>
    </div>
  )
}
