import { ofetch } from "ofetch"
import { joinModelsUrl } from "#/utils/llm-url"

interface ValidateBody {
  baseUrl?: string
}

// 真实校验 LLM API Key：用该 key 调 /models（免费、不耗 token）。
// 200 => 有效；401/403 => 无效（400 退回前端）；其余 => 无法连接（502）。
export default defineEventHandler(async (event) => {
  const auth = getHeader(event, "authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, message: "缺少 API Key（请在 Authorization 头携带 Bearer <key>）" })
  }
  const key = auth.slice("Bearer ".length).trim()
  if (!key) {
    throw createError({ statusCode: 401, message: "API Key 为空" })
  }

  const body = await readBody<ValidateBody>(event).catch<ValidateBody>(() => ({}))
  const baseUrl = (body && body.baseUrl) || "https://api.deepseek.com"

  try {
    await ofetch(joinModelsUrl(baseUrl), {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      timeout: 15000,
    })
    return { valid: true }
  } catch (e: any) {
    const status = e?.response?.status ?? e?.status
    if (status === 401 || status === 403) {
      throw createError({ statusCode: 400, message: "DeepSeek API Key 无效或无权限" })
    }
    const data = e?.data ?? e?.response?._data
    const msg = data?.error?.message ?? data?.message ?? "无法连接 DeepSeek 校验服务，请稍后重试"
    throw createError({ statusCode: 502, message: `Key 校验失败: ${msg}` })
  }
})
