import { atom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"

export type ProviderId = "deepseek" | "zhipu" | "kimi"
export type ScheduleMode = "daily" | "once"

export const MAX_RECIPIENTS = 5

export interface ProviderConfig {
  apiKey: string
  baseUrl: string
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
  activeProvider: ProviderId
  providers: Record<ProviderId, ProviderConfig>
  email: EmailConfig
}

export interface ProviderPreset {
  id: ProviderId
  name: string
  baseUrl: string
  models: string[]
  defaultModel: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash", "deepseek-v4-pro"],
    defaultModel: "deepseek-v4-pro",
  },
  {
    id: "zhipu",
    name: "智谱",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-flash", "glm-4-air", "glm-4-plus", "glm-4-long", "glm-4.5", "glm-4.5-air"],
    defaultModel: "glm-4-flash",
  },
  {
    id: "kimi",
    name: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2-0905-preview"],
    defaultModel: "moonshot-v1-32k",
  },
]

function buildDefaultProviders(): Record<ProviderId, ProviderConfig> {
  const out = {} as Record<ProviderId, ProviderConfig>
  for (const p of PROVIDER_PRESETS) {
    out[p.id] = { apiKey: "", baseUrl: p.baseUrl, model: p.defaultModel }
  }
  return out
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
  activeProvider: "deepseek",
  providers: buildDefaultProviders(),
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

// 兼容旧版 localStorage：单个 toEmail → toEmails[]，并补齐新增字段
function migrate(raw: any): LLMSettings {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_SETTINGS
  }
  const email = (raw.email && typeof raw.email === "object") ? raw.email : {}
  const toEmails = Array.isArray(email.toEmails)
    ? email.toEmails.filter((e: any) => typeof e === "string")
    : (typeof email.toEmail === "string" && email.toEmail ? [email.toEmail] : [])
  return {
    activeProvider: raw.activeProvider ?? "deepseek",
    providers: { ...buildDefaultProviders(), ...(raw.providers ?? {}) },
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
