export function joinChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "")
  // 已经有 /v\d+ 路径段（如 v1 / v4 等），不再追加 /v1
  if (/\/v\d+(?:\/|$)/.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }
  return `${trimmed}/v1/chat/completions`
}

// 模型列表端点，仅用于校验 Key 有效性（OpenAI 兼容，免费、不耗 token）
export function joinModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "")
  if (/\/v\d+(?:\/|$)/.test(trimmed)) {
    return `${trimmed}/models`
  }
  return `${trimmed}/v1/models`
}
