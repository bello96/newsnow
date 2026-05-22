import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODELS, MAX_RECIPIENTS, llmSettingsAtom } from "~/atoms/settings"
import type { EmailConfig, LLMConfig, ScheduleMode } from "~/atoms/settings"
import { apiFetch, llmFetch } from "~/utils/api"

// 收件邮箱白名单正则（域名分段不含点，避免超线性回溯）
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
// 每天发送时间 HH:MM（24 小时制）
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

const inputCls =
  "w-full p-2 border border-primary/20 rounded bg-zinc-200/60 dark:bg-zinc-700/40 text-sm focus:outline-none focus:border-primary transition-colors"
const labelCls = "block text-xs op-70 mb-1"
const btnCls =
  "px-4 py-2 rounded bg-primary/20 hover:bg-primary/30 text-sm font-bold disabled:op-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"

export const Route = createFileRoute("/analyze")({ component: AnalyzePage })

interface AnalyzeResult {
  text: string
  newsCount: number
  articleHits: number
}

// 服务器上「已生效」的定时任务状态（GET /api/settings，不含 apiKey）
interface ServerStatus {
  enabled: number
  scheduleMode: ScheduleMode
  sendHour: number
  sendMinute: number
  sendAt: number | null
  toEmails: string[]
  hasLlmKey: boolean
  llmModel: string
  lastSentDate: string | null
  updatedAt: number
}

interface Msg {
  ok: boolean
  text: string
}

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

// 结果弹框：渲染口播稿 + 复制 + 发送邮件
function ResultDialog({
  result,
  recipientCount,
  onClose,
  onSend,
  sending,
  sendMsg,
}: {
  result: AnalyzeResult
  recipientCount: number
  onClose: () => void
  onSend: () => void
  sending: boolean
  sendMsg: Msg | null
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 忽略复制失败
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-base rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-primary/15">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="i-ph:file-text" />
            分析结果
            <span className="text-xs op-50 font-normal">
              {result.newsCount}
              {" 条素材 · 抓取 "}
              {result.articleHits}
              {" 篇正文"}
            </span>
          </h3>
          <button type="button" onClick={onClose} className="op-50 hover:op-100 text-lg" aria-label="关闭">
            <span className="i-ph:x" />
          </button>
        </div>

        <article className="prose prose-sm dark:prose-invert max-w-none p-4 overflow-y-auto flex-1">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {result.text}
          </ReactMarkdown>
        </article>

        <div className="flex items-center gap-3 flex-wrap p-4 border-t border-primary/15">
          <button
            type="button"
            onClick={copy}
            className="px-3 py-1.5 rounded hover:bg-primary/10 text-sm flex items-center gap-1"
          >
            <span className="i-ph:copy" />
            {copied ? "已复制 ✓" : "复制原文"}
          </button>
          <button type="button" onClick={onSend} disabled={sending} className={btnCls}>
            <span className="i-ph:paper-plane-tilt" />
            {sending ? "发送中…" : `发送邮件（${recipientCount}）`}
          </button>
          {sendMsg && (
            <span
              className={`text-sm flex items-center gap-1 ${sendMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
            >
              <span className={sendMsg.ok ? "i-ph:check-circle" : "i-ph:warning-circle"} />
              {sendMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AnalyzePage() {
  const [settings, setSettings] = useAtom(llmSettingsAtom)
  const [dailyTime, setDailyTime] = useState(`${pad(settings.email.sendHour)}:${pad(settings.email.sendMinute)}`)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeErr, setAnalyzeErr] = useState("")
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [resultOpen, setResultOpen] = useState(false)

  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<Msg | null>(null)

  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState<Msg | null>(null)

  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // 加载服务器真实状态，并用「已生效的定时设置」校准草稿（apiKey / 邮箱不动）
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const s = await apiFetch<ServerStatus>("settings")
        if (!alive) {
          return
        }
        setServerStatus(s)
        setSettings((prev) => ({
          ...prev,
          email: {
            ...prev.email,
            enabled: !!s.enabled,
            scheduleMode: s.scheduleMode,
            sendHour: s.sendHour,
            sendMinute: s.sendMinute,
            sendAt: s.sendAt,
          },
        }))
        setDailyTime(`${pad(s.sendHour)}:${pad(s.sendMinute)}`)
      } catch {
        if (alive) {
          setServerStatus(null)
        }
      } finally {
        if (alive) {
          setStatusLoading(false)
        }
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [setSettings])

  const cfg = settings.llm
  const email = settings.email

  function setCfg<K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) {
    setSettings({ ...settings, llm: { ...settings.llm, [key]: value } })
  }

  function setEmail<K extends keyof EmailConfig>(key: K, value: EmailConfig[K]) {
    setScheduleMsg(null)
    setSettings({ ...settings, email: { ...settings.email, [key]: value } })
  }

  function cleanEmails(): string[] {
    return email.toEmails.map((e) => e.trim()).filter(Boolean)
  }

  // 校验收件邮箱：合法返回清洗后的列表，否则抛错
  function requireValidEmails(): string[] {
    const cleaned = cleanEmails()
    if (cleaned.length === 0) {
      throw new Error("请至少填写一个收件邮箱")
    }
    const bad = cleaned.find((e) => !EMAIL_RE.test(e))
    if (bad) {
      throw new Error(`收件邮箱格式无效：${bad}`)
    }
    return cleaned
  }

  // 拉取服务器最新状态，刷新顶部「当前定时任务」徽标
  async function refreshStatus() {
    try {
      const s = await apiFetch<ServerStatus>("settings")
      setServerStatus(s)
    } catch {
      // 拉取失败则保留旧状态
    }
  }

  // 草稿与服务器已生效设置是否不一致（有未保存修改）
  function scheduleDirty(): boolean {
    if (!serverStatus) {
      return false
    }
    if (email.enabled !== !!serverStatus.enabled) {
      return true
    }
    if (!email.enabled) {
      return false
    }
    if (email.scheduleMode !== serverStatus.scheduleMode) {
      return true
    }
    if (cleanEmails().join(",") !== serverStatus.toEmails.join(",")) {
      return true
    }
    if (email.scheduleMode === "daily") {
      const m = TIME_RE.exec(dailyTime.trim())
      const h = m ? Number(m[1]) : email.sendHour
      const min = m ? Number(m[2]) : email.sendMinute
      return h !== serverStatus.sendHour || min !== serverStatus.sendMinute
    }
    return (email.sendAt ?? null) !== (serverStatus.sendAt ?? null)
  }

  // 顶部「当前定时任务」徽标文案
  function statusLabel(): string {
    if (statusLoading) {
      return "正在读取服务器定时状态…"
    }
    if (!serverStatus) {
      return "无法读取服务器状态，请刷新重试"
    }
    if (!serverStatus.enabled) {
      return "当前未开启定时任务"
    }
    const n = serverStatus.toEmails.length
    if (serverStatus.scheduleMode === "daily") {
      return `当前定时任务：每天 ${pad(serverStatus.sendHour)}:${pad(serverStatus.sendMinute)} → ${n} 个邮箱`
    }
    const at = serverStatus.sendAt ? sendAtToLocalInput(serverStatus.sendAt).replace("T", " ") : "未设时间"
    return `当前定时任务：一次性 ${at} → ${n} 个邮箱`
  }

  // 左栏：立即分析（仅生成，不发送）
  async function onAnalyze() {
    setAnalyzeErr("")
    const apiKey = cfg.apiKey.trim()
    if (!apiKey) {
      setAnalyzeErr("请先填写 DeepSeek API Key")
      return
    }
    setAnalyzing(true)
    try {
      const data = await llmFetch<AnalyzeResult>("analyze", apiKey, {
        method: "POST",
        body: { baseUrl: DEEPSEEK_BASE_URL, model: cfg.model },
      })
      setResult(data)
      setSendMsg(null)
      setResultOpen(true)
    } catch (e: any) {
      setAnalyzeErr(e?.data?.message || e?.message || "分析失败，请重试")
    } finally {
      setAnalyzing(false)
    }
  }

  // 弹框：手动发送当前分析结果（独立于定时任务）
  async function onSendEmail() {
    if (!result) {
      return
    }
    setSendMsg(null)
    let recipients: string[]
    try {
      recipients = requireValidEmails()
    } catch (e: any) {
      setSendMsg({ ok: false, text: e.message })
      return
    }
    setSending(true)
    try {
      await apiFetch("send", {
        method: "POST",
        body: { text: result.text, toEmails: recipients },
      })
      setSendMsg({ ok: true, text: `已发送到 ${recipients.length} 个邮箱` })
    } catch (e: any) {
      setSendMsg({ ok: false, text: e?.data?.message || e?.message || "发送失败，请重试" })
    } finally {
      setSending(false)
    }
  }

  // 右栏：开启 / 停用定时发送（单行表，覆盖式，保证唯一任务）
  async function onSaveSchedule() {
    setScheduleMsg(null)

    if (!email.enabled) {
      setSavingSchedule(true)
      try {
        await apiFetch("settings", { method: "PUT", body: { enabled: 0 } })
        await refreshStatus()
        setScheduleMsg({ ok: true, text: "已停用定时发送，服务器上的定时任务已清除" })
      } catch (e: any) {
        setScheduleMsg({ ok: false, text: e?.message || "保存失败，请重试" })
      } finally {
        setSavingSchedule(false)
      }
      return
    }

    const apiKey = cfg.apiKey.trim()
    if (!apiKey) {
      setScheduleMsg({ ok: false, text: "请先在左侧填写 DeepSeek API Key" })
      return
    }
    let recipients: string[]
    try {
      recipients = requireValidEmails()
    } catch (e: any) {
      setScheduleMsg({ ok: false, text: e.message })
      return
    }

    let sendHour = email.sendHour
    let sendMinute = email.sendMinute
    if (email.scheduleMode === "daily") {
      const m = TIME_RE.exec(dailyTime.trim())
      if (!m) {
        setScheduleMsg({ ok: false, text: "每天发送时间格式不正确，请输入 00:00 ~ 23:59" })
        return
      }
      sendHour = Number(m[1])
      sendMinute = Number(m[2])
    } else {
      if (!email.sendAt) {
        setScheduleMsg({ ok: false, text: "请选择一次性发送的时间" })
        return
      }
      if (email.sendAt <= Date.now()) {
        setScheduleMsg({ ok: false, text: "一次性发送时间必须晚于当前时间" })
        return
      }
    }

    setSavingSchedule(true)
    try {
      // 真实校验 key 有效性，避免定时任务凌晨用错 key 静默失败
      try {
        await llmFetch("validate-key", apiKey, {
          method: "POST",
          body: { baseUrl: DEEPSEEK_BASE_URL },
        })
      } catch (e: any) {
        setScheduleMsg({ ok: false, text: e?.data?.message || e?.message || "API Key 校验失败，请检查后重试" })
        return
      }

      await apiFetch<{ ok: boolean }>("settings", {
        method: "PUT",
        body: {
          enabled: 1,
          toEmails: recipients,
          scheduleMode: email.scheduleMode,
          sendHour,
          sendMinute,
          sendAt: email.scheduleMode === "once" ? email.sendAt : null,
          llmApiKey: apiKey,
          llmBaseUrl: DEEPSEEK_BASE_URL,
          llmModel: cfg.model,
        },
      })
      setSettings({ ...settings, email: { ...email, toEmails: recipients, sendHour, sendMinute } })
      await refreshStatus()
      setScheduleMsg({
        ok: true,
        text:
          email.scheduleMode === "daily"
            ? `已开启定时发送：每天 ${pad(sendHour)}:${pad(sendMinute)}`
            : "已开启定时发送：到点发送一次",
      })
    } catch (e: any) {
      setScheduleMsg({ ok: false, text: e?.message || "保存失败，请重试" })
    } finally {
      setSavingSchedule(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 flex flex-col gap-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <span className="i-ph:robot" />
        新闻抓取分析 · 口播稿
      </h2>

      <div className="grid gap-4 md:grid-cols-2 items-start">
        {/* 左栏：内容生成 */}
        <section className="border border-primary/15 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold op-80 flex items-center gap-1">
            <span className="i-ph:sparkle" />
            内容生成
          </h3>

          <div>
            <label className={labelCls}>DeepSeek API Key</label>
            <input
              type="password"
              className={inputCls}
              value={cfg.apiKey}
              onChange={(e) => setCfg("apiKey", e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className={labelCls}>Model</label>
            <select className={inputCls} value={cfg.model} onChange={(e) => setCfg("model", e.target.value)}>
              {DEEPSEEK_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {!DEEPSEEK_MODELS.includes(cfg.model) && (
                <option value={cfg.model}>
                  {cfg.model}
                  {" (custom)"}
                </option>
              )}
            </select>
          </div>

          <button type="button" onClick={onAnalyze} disabled={analyzing || !cfg.apiKey.trim()} className={btnCls}>
            <span className={analyzing ? "i-ph:circle-dashed animate-spin" : "i-ph:magic-wand"} />
            {analyzing ? "分析中…" : "立即分析"}
          </button>

          {analyzeErr && (
            <div className="p-2 text-sm text-red-500 bg-red-500/10 rounded">
              <span className="i-ph:warning-circle inline-block align-middle mr-1" />
              {analyzeErr}
            </div>
          )}

          {result && !analyzing && (
            <button
              type="button"
              onClick={() => setResultOpen(true)}
              className="self-start text-sm flex items-center gap-1 px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <span className="i-ph:eye" />
              查看结果
            </button>
          )}

          <div className="text-xs op-50">
            点「立即分析」让大模型从今日累积的新闻里挑出爆点生成口播稿，弹框中可查看并发送。
          </div>
        </section>

        {/* 右栏：邮件投递 */}
        <section className="border border-primary/15 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold op-80 flex items-center gap-1">
            <span className="i-ph:envelope-simple" />
            邮件投递（定时）
          </h3>

          {/* 服务器真实状态：只反映已保存生效的定时任务，与下方草稿区分 */}
          <div className="text-xs rounded-md px-3 py-2 bg-primary/5 flex items-start gap-2">
            <span
              className={$([
                "mt-0.5 shrink-0",
                statusLoading
                  ? "i-ph:circle-dashed animate-spin"
                  : serverStatus?.enabled
                    ? "i-ph:check-circle text-green-600 dark:text-green-400"
                    : "i-ph:moon op-60",
              ])}
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{statusLabel()}</span>
              {serverStatus && serverStatus.enabled === 1 && serverStatus.lastSentDate && (
                <span className="op-50">
                  上次发送日期：
                  {serverStatus.lastSentDate}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>收件邮箱（最多 {MAX_RECIPIENTS} 个 · 手动 / 定时共用）</label>
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
                      onClick={() =>
                        setEmail(
                          "toEmails",
                          email.toEmails.filter((_, j) => j !== i),
                        )
                      }
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
            </div>
          </div>

          <label
            className={$([
              "flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
              email.enabled ? "bg-primary/15" : "bg-primary/5 hover:bg-primary/10",
            ])}
          >
            <input type="checkbox" checked={email.enabled} onChange={(e) => setEmail("enabled", e.target.checked)} />
            <span className="text-sm font-medium flex items-center gap-1">
              <span className="i-ph:clock" />
              开启定时发送
            </span>
            <span className="ml-auto text-xs op-50">{email.enabled ? "草稿：开" : "草稿：关"}</span>
          </label>

          {email.enabled && (
            <>
              <div className="flex gap-2">
                {(
                  [
                    { id: "daily", label: "每天", icon: "i-ph:repeat" },
                    { id: "once", label: "一次", icon: "i-ph:calendar-check" },
                  ] as const
                ).map((m) => (
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

              {email.scheduleMode === "daily" ? (
                <div>
                  <label className={labelCls}>每天发送时间（24 小时制，如 09:00）</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={dailyTime}
                    onChange={(e) => {
                      setScheduleMsg(null)
                      setDailyTime(e.target.value)
                    }}
                    placeholder="09:00"
                    maxLength={5}
                    inputMode="numeric"
                  />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>发送时间（北京时间，发完自动关闭）</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={sendAtToLocalInput(email.sendAt)}
                    min={sendAtToLocalInput(Date.now())}
                    onChange={(e) => setEmail("sendAt", localInputToSendAt(e.target.value))}
                  />
                </div>
              )}

              <div className="text-xs op-50">
                服务器到点用 DeepSeek 自动生成并发送，实际由 GitHub Actions 调度，可能延迟最多 30 分钟。
              </div>
            </>
          )}

          {!statusLoading && scheduleDirty() && (
            <div className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="i-ph:warning shrink-0" />
              有未保存的修改，点下方按钮后才会生效
            </div>
          )}

          <button type="button" onClick={onSaveSchedule} disabled={savingSchedule} className={btnCls}>
            <span className="i-ph:clock" />
            {savingSchedule ? "处理中…" : email.enabled ? "开启定时发送" : "停用定时发送"}
          </button>

          {scheduleMsg && (
            <div
              className={`p-2 text-sm rounded flex items-center gap-1 ${scheduleMsg.ok ? "text-green-600 dark:text-green-400 bg-green-500/10" : "text-red-500 bg-red-500/10"}`}
            >
              <span className={scheduleMsg.ok ? "i-ph:check-circle" : "i-ph:warning-circle"} />
              {scheduleMsg.text}
            </div>
          )}
        </section>
      </div>

      {resultOpen && result && (
        <ResultDialog
          result={result}
          recipientCount={cleanEmails().length}
          onClose={() => setResultOpen(false)}
          onSend={onSendEmail}
          sending={sending}
          sendMsg={sendMsg}
        />
      )}
    </div>
  )
}
