import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
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

export const MODEL_OPTIONS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "deepseek-reasoner",
] as const

const DEFAULT_LLM_CONFIG: LLMConfig = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
}

export const llmConfigAtom = atomWithStorage<LLMConfig>("newsnow-llm-config", DEFAULT_LLM_CONFIG)
export const historyAtom = atom<HistoryRow[]>([])
