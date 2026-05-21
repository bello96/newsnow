export function joinChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "")
  // 已经有 /v\d+ 路径段（如 v1 / v4 等），不再追加 /v1
  if (/\/v\d+(?:\/|$)/.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }
  return `${trimmed}/v1/chat/completions`
}
