import { ofetch } from "ofetch"

interface LLMChatRequest {
  apiKey: string
  baseUrl?: string
  model: string
  messages: Array<{ role: "system" | "user" | "assistant", content: string }>
  temperature?: number
  maxTokens?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LLMChatRequest>(event)
  if (!body?.apiKey || !body?.model || !Array.isArray(body.messages)) {
    throw createError({ statusCode: 400, message: "Missing required fields" })
  }
  const baseUrl = body.baseUrl?.replace(/\/$/, "") ?? "https://api.deepseek.com"
  try {
    const res = await ofetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${body.apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: body.model,
        messages: body.messages,
        temperature: body.temperature ?? 0.3,
        max_tokens: body.maxTokens ?? 4000,
      },
      timeout: 120000,
    })
    return res
  } catch (e: any) {
    const status = e?.response?.status ?? e?.statusCode ?? 500
    const data = e?.data ?? e?.response?._data ?? { message: String(e) }
    throw createError({
      statusCode: status,
      data,
      message: data?.error?.message ?? "LLM call failed",
    })
  }
})
