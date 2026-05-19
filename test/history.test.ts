import { beforeEach, describe, expect, it } from "vitest"
import { createDatabase } from "db0"
import sqlite from "db0/connectors/better-sqlite3"
import { History } from "#/database/history"

describe("history", () => {
  let history: History

  beforeEach(async () => {
    const db = createDatabase(sqlite({ name: ":memory:" }))
    history = new History(db)
    await history.init()
  })

  it("insert 返回自增 id 且 recent 能查到", async () => {
    const id = await history.insert({
      generatedAt: 1000,
      text: "稿件一",
      model: "deepseek-v4-pro",
      newsCount: 300,
      sentTo: "x@y.com",
      emailStatus: "sent",
      emailError: null,
    })
    expect(id).toBeGreaterThan(0)
    const rows = await history.recent(10)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe("稿件一")
    expect(rows[0].emailStatus).toBe("sent")
  })

  it("recent 按 generatedAt DESC 排序", async () => {
    await history.insert({ generatedAt: 1000, text: "a", model: null, newsCount: null, sentTo: null, emailStatus: "skipped", emailError: null })
    await history.insert({ generatedAt: 3000, text: "c", model: null, newsCount: null, sentTo: null, emailStatus: "skipped", emailError: null })
    await history.insert({ generatedAt: 2000, text: "b", model: null, newsCount: null, sentTo: null, emailStatus: "skipped", emailError: null })
    const rows = await history.recent(10)
    expect(rows.map(r => r.text)).toEqual(["c", "b", "a"])
  })

  it("recent 受 limit 约束", async () => {
    for (let i = 0; i < 5; i++) {
      await history.insert({ generatedAt: i * 1000, text: `t${i}`, model: null, newsCount: null, sentTo: null, emailStatus: "skipped", emailError: null })
    }
    const rows = await history.recent(3)
    expect(rows).toHaveLength(3)
  })

  it("cleanup 删 cutoff 之前的", async () => {
    await history.insert({ generatedAt: 1000, text: "old", model: null, newsCount: null, sentTo: null, emailStatus: "skipped", emailError: null })
    await history.insert({ generatedAt: 5000, text: "new", model: null, newsCount: null, sentTo: null, emailStatus: "skipped", emailError: null })
    await history.cleanup(3000)
    const rows = await history.recent(10)
    expect(rows.map(r => r.text)).toEqual(["new"])
  })
})
