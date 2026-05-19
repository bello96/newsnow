import { describe, expect, it } from "vitest"
import { verifyCronToken } from "#/utils/auth"

describe("verifyCronToken", () => {
  it("expected 未配置时，永远拒绝（防开放）", () => {
    expect(verifyCronToken(undefined, "Bearer any")).toBe(false)
    expect(verifyCronToken("", "Bearer any")).toBe(false)
  })

  it("header 缺失或格式错 → false", () => {
    expect(verifyCronToken("secret", undefined)).toBe(false)
    expect(verifyCronToken("secret", "")).toBe(false)
    expect(verifyCronToken("secret", "secret")).toBe(false)
    expect(verifyCronToken("secret", "Bearer")).toBe(false)
  })

  it("token 错 → false", () => {
    expect(verifyCronToken("secret", "Bearer wrong")).toBe(false)
  })

  it("token 对 → true", () => {
    expect(verifyCronToken("secret", "Bearer secret")).toBe(true)
  })
})
