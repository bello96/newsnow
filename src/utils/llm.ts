import { myFetch } from "~/utils"
import type { LLMConfig } from "~/atoms/summary"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatResponse {
  choices: Array<{ message: { content: string } }>
}

export async function chat(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  if (!config.apiKey) {
    throw new Error("请先在配置中填写 LLM API key")
  }
  const res = await myFetch<ChatResponse>("llm/chat", {
    method: "POST",
    body: {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages,
      temperature: 0.3,
      maxTokens: 4000,
    },
    timeout: 120000,
  })
  return res.choices?.[0]?.message?.content ?? ""
}
