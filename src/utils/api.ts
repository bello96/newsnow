import { $fetch } from "ofetch"

const baseFetch = $fetch.create({
  baseURL: "/api",
  timeout: 30000,
  retry: 0,
})

export async function authedFetch<T>(
  path: string,
  token: string,
  opts: Parameters<typeof baseFetch>[1] = {},
): Promise<T> {
  if (!token) {
    throw new Error("请先在配置中填写管理 Token")
  }
  return await baseFetch(path, {
    ...opts,
    headers: {
      ...(opts?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  }) as T
}
