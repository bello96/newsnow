import { describe, expect, it } from "vitest"
import { joinChatCompletionsUrl } from "#/utils/llm-url"

describe("joinChatCompletionsUrl", () => {
  it("deepSeek 根域名追加 /v1", () => {
    expect(joinChatCompletionsUrl("https://api.deepseek.com"))
      .toBe("https://api.deepseek.com/v1/chat/completions")
  })

  it("deepSeek 末尾斜杠去除后追加 /v1", () => {
    expect(joinChatCompletionsUrl("https://api.deepseek.com/"))
      .toBe("https://api.deepseek.com/v1/chat/completions")
  })

  it("kimi 带 /v1 不重复追加", () => {
    expect(joinChatCompletionsUrl("https://api.moonshot.cn/v1"))
      .toBe("https://api.moonshot.cn/v1/chat/completions")
  })

  it("智谱 /api/paas/v4 直接拼 chat/completions", () => {
    expect(joinChatCompletionsUrl("https://open.bigmodel.cn/api/paas/v4"))
      .toBe("https://open.bigmodel.cn/api/paas/v4/chat/completions")
  })

  it("/v2 也识别为版本路径不重复加 /v1", () => {
    expect(joinChatCompletionsUrl("https://example.com/v2"))
      .toBe("https://example.com/v2/chat/completions")
  })

  it("带 trailing slash 的版本路径正确处理", () => {
    expect(joinChatCompletionsUrl("https://api.moonshot.cn/v1/"))
      .toBe("https://api.moonshot.cn/v1/chat/completions")
  })

  it("前后空白被 trim 掉", () => {
    expect(joinChatCompletionsUrl("  https://api.deepseek.com  "))
      .toBe("https://api.deepseek.com/v1/chat/completions")
  })
})
