import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export const MODEL_OPTIONS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "deepseek-reasoner",
] as const

export const llmConfigAtom = atomWithStorage<LLMConfig>("newsnow-llm-config", {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
})

export const summaryRequirementAtom = atom<string>("")

export interface SummaryResult {
  loading: boolean
  text: string
  error?: string
}

export const summaryResultAtom = atom<SummaryResult>({ loading: false, text: "" })
