import { atom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"

export type ScheduleMode = "daily" | "once"

export const MAX_RECIPIENTS = 5

// DeepSeek 固定配置：baseUrl 确定，不再让用户填写
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com"
export const DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash", "deepseek-v4-pro"]
export const DEFAULT_MODEL = "deepseek-v4-pro"

export interface LLMConfig {
  apiKey: string
  model: string
}

export interface EmailConfig {
  enabled: boolean
  toEmails: string[]
  scheduleMode: ScheduleMode
  sendHour: number
  sendMinute: number
  sendAt: number | null
}

export interface LLMSettings {
  llm: LLMConfig
  email: EmailConfig
}

const DEFAULT_EMAIL: EmailConfig = {
  enabled: false,
  toEmails: [],
  scheduleMode: "daily",
  sendHour: 7,
  sendMinute: 0,
  sendAt: null,
}

const DEFAULT_SETTINGS: LLMSettings = {
  llm: { apiKey: "", model: DEFAULT_MODEL },
  email: DEFAULT_EMAIL,
}

export interface HistoryRow {
  id: number
  generatedAt: number
  text: string
  model: string | null
  newsCount: number | null
  sentTo: string | null
  emailStatus: string
  emailError: string | null
}

// 兼容旧版 localStorage：
// - 旧多 Provider 结构（providers.deepseek / activeProvider）→ 单一 llm
// - 旧单个 toEmail → toEmails[]
function migrate(raw: any): LLMSettings {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_SETTINGS
  }
  const llmSrc = (raw.llm && typeof raw.llm === "object")
    ? raw.llm
    : (raw.providers?.deepseek ?? {})
  const llm: LLMConfig = {
    apiKey: typeof llmSrc.apiKey === "string" ? llmSrc.apiKey : "",
    model: typeof llmSrc.model === "string" && llmSrc.model ? llmSrc.model : DEFAULT_MODEL,
  }
  const email = (raw.email && typeof raw.email === "object") ? raw.email : {}
  const toEmails = Array.isArray(email.toEmails)
    ? email.toEmails.filter((e: any) => typeof e === "string")
    : (typeof email.toEmail === "string" && email.toEmail ? [email.toEmail] : [])
  return {
    llm,
    email: {
      enabled: !!email.enabled,
      toEmails,
      scheduleMode: email.scheduleMode === "once" ? "once" : "daily",
      sendHour: typeof email.sendHour === "number" ? email.sendHour : 7,
      sendMinute: email.sendMinute === 30 ? 30 : 0,
      sendAt: typeof email.sendAt === "number" ? email.sendAt : null,
    },
  }
}

const baseStorage = createJSONStorage<LLMSettings>(() => localStorage)
const migratingStorage = {
  ...baseStorage,
  getItem: (key: string, initialValue: LLMSettings): LLMSettings => {
    return migrate(baseStorage.getItem(key, initialValue))
  },
}

export const llmSettingsAtom = atomWithStorage<LLMSettings>(
  "newsnow-llm-settings",
  DEFAULT_SETTINGS,
  migratingStorage,
)
export const historyAtom = atom<HistoryRow[]>([])
