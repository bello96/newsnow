import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export const llmConfigAtom = atomWithStorage<LLMConfig>("newsnow-llm-config", {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
})

export const summaryRequirementAtom = atom<string>("")

export interface SummaryResult {
  loading: boolean
  text: string
  error?: string
}

export const summaryResultAtom = atom<SummaryResult>({ loading: false, text: "" })
