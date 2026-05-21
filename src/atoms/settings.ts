import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export type ProviderId = "deepseek" | "zhipu" | "kimi"

export interface ProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface LLMSettings {
  activeProvider: ProviderId
  providers: Record<ProviderId, ProviderConfig>
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

const DEFAULT_SETTINGS: LLMSettings = {
  activeProvider: "deepseek",
  providers: buildDefaultProviders(),
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

export const llmSettingsAtom = atomWithStorage<LLMSettings>("newsnow-llm-settings", DEFAULT_SETTINGS)
export const historyAtom = atom<HistoryRow[]>([])
