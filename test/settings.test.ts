import { beforeEach, describe, expect, it } from "vitest"
import { createDatabase } from "db0"
import sqlite from "db0/connectors/better-sqlite3"
import { Settings } from "#/database/settings"

describe("settings", () => {
  let settings: Settings

  beforeEach(async () => {
    const db = createDatabase(sqlite({ name: ":memory:" }))
    settings = new Settings(db)
    await settings.init()
  })

  it("init 后 get 返回默认值", async () => {
    const row = await settings.get()
    expect(row.id).toBe(1)
    expect(row.llmModel).toBe("deepseek-v4-pro")
    expect(row.sendHour).toBe(7)
    expect(row.sendMinute).toBe(0)
    expect(row.enabled).toBe(0)
    expect(row.subjectTemplate).toBe("今日口播稿 - {date}")
  })

  it("put sendMinute 后 get 能取回", async () => {
    await settings.put({ sendHour: 20, sendMinute: 30 })
    const row = await settings.get()
    expect(row.sendHour).toBe(20)
    expect(row.sendMinute).toBe(30)
  })

  it("init 重复执行不报错（ALTER TABLE 兼容旧库）", async () => {
    await settings.init()
    await settings.init()
    const row = await settings.get()
    expect(row.id).toBe(1)
  })

  it("put 部分字段，其他字段保持不变", async () => {
    await settings.put({ llmApiKey: "sk-abc", sendHour: 18 })
    const row = await settings.get()
    expect(row.llmApiKey).toBe("sk-abc")
    expect(row.sendHour).toBe(18)
    expect(row.llmModel).toBe("deepseek-v4-pro")
  })

  it("put 多次仍是单行", async () => {
    await settings.put({ llmApiKey: "k1" })
    await settings.put({ llmApiKey: "k2" })
    const row = await settings.get()
    expect(row.llmApiKey).toBe("k2")
  })

  it("markSent 更新 lastSentDate", async () => {
    await settings.markSent("2026-05-19")
    const row = await settings.get()
    expect(row.lastSentDate).toBe("2026-05-19")
  })

  it("put 不允许更改 id", async () => {
    await settings.put({ id: 2, llmApiKey: "x" } as any)
    const row = await settings.get()
    expect(row.id).toBe(1)
    expect(row.llmApiKey).toBe("x")
  })
})
