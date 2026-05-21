import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export interface UserSettings {
  id: number
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  resendApiKey: string
  fromEmail: string
  fromName: string
  toEmail: string
  subjectTemplate: string
  sendHour: number
  sendMinute: number
  enabled: number
  lastSentDate: string | null
  updatedAt: number
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

export const adminTokenAtom = atomWithStorage<string>("newsnow-admin-token", "")
export const settingsAtom = atom<UserSettings | null>(null)
export const historyAtom = atom<HistoryRow[]>([])
