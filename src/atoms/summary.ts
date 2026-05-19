import { atom } from "jotai"

export interface SummaryResult {
  loading: boolean
  text: string
  error?: string
}

export const summaryResultAtom = atom<SummaryResult>({ loading: false, text: "" })
