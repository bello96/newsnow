import { $fetch } from "ofetch"

const baseFetch = $fetch.create({
  baseURL: "/api",
  timeout: 240000,
  retry: 0,
})

export async function apiFetch<T>(
  path: string,
  opts: Parameters<typeof baseFetch>[1] = {},
): Promise<T> {
  return await baseFetch(path, opts) as T
}

export async function llmFetch<T>(
  path: string,
  llmKey: string,
  opts: Parameters<typeof baseFetch>[1] = {},
): Promise<T> {
  if (!llmKey) {
    throw new Error("请先在配置中填写 LLM API Key")
  }
  return await baseFetch(path, {
    ...opts,
    headers: {
      ...(opts?.headers ?? {}),
      Authorization: `Bearer ${llmKey}`,
    },
  }) as T
}
