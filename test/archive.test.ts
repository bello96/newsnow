import { beforeEach, describe, expect, it } from "vitest"
import { createDatabase } from "db0"
import sqlite from "db0/connectors/better-sqlite3"
import type { NewsItem } from "@shared/types"
import { Archive } from "#/database/archive"

describe("archive", () => {
  let archive: Archive

  beforeEach(async () => {
    const db = createDatabase(sqlite({ name: ":memory:" }))
    archive = new Archive(db)
    await archive.init()
  })

  it("upsert 保留 first_seen 并更新 last_seen", async () => {
    const item: NewsItem = { id: "n1", title: "T1", url: "https://t" }
    await archive.upsert("zhihu", [item], 1000)
    await archive.upsert("zhihu", [item], 2000)
    const rows = await archive.range(0, 9999, ["zhihu"])
    expect(rows).toHaveLength(1)
    expect(rows[0].firstSeen).toBe(1000)
    expect(rows[0].lastSeen).toBe(2000)
  })

  it("range 按 first_seen 时间过滤", async () => {
    await archive.upsert("zhihu", [{ id: "n1", title: "T1", url: "u" }], 1000)
    await archive.upsert("zhihu", [{ id: "n2", title: "T2", url: "u" }], 5000)
    const rows = await archive.range(3000, 9999, ["zhihu"])
    expect(rows.map(r => r.newsId)).toEqual(["n2"])
  })

  it("range 不传 sourceIds 返回全部源", async () => {
    await archive.upsert("zhihu", [{ id: "a", title: "x", url: "u" }], 1000)
    await archive.upsert("weibo", [{ id: "b", title: "y", url: "u" }], 1000)
    const rows = await archive.range(0, 9999)
    expect(rows).toHaveLength(2)
  })

  it("cleanup 删除 first_seen < cutoff 的项", async () => {
    await archive.upsert("zhihu", [{ id: "old", title: "x", url: "u" }], 1000)
    await archive.upsert("zhihu", [{ id: "new", title: "y", url: "u" }], 8000)
    await archive.cleanup(5000)
    const rows = await archive.range(0, 9999, ["zhihu"])
    expect(rows.map(r => r.newsId)).toEqual(["new"])
  })

  it("upsert 字符串 pubDate 被解析为数字", async () => {
    await archive.upsert("zhihu", [
      { id: "n1", title: "T1", url: "u", pubDate: "2026-05-19T10:00:00Z" },
    ], 1000)
    const rows = await archive.range(0, 9999, ["zhihu"])
    expect(typeof rows[0].pubDate).toBe("number")
    expect(rows[0].pubDate).toBe(Date.parse("2026-05-19T10:00:00Z"))
  })

  it("upsert 写入 extra 字段后 range 返回原始 JSON 字符串", async () => {
    await archive.upsert("zhihu", [
      { id: "n1", title: "T1", url: "u", extra: { info: "hot", diff: 5 } },
    ], 1000)
    const rows = await archive.range(0, 9999, ["zhihu"])
    expect(rows[0].extra).toBe(JSON.stringify({ info: "hot", diff: 5 }))
  })

  it("pruneSources 删除不在源列表里的归档行", async () => {
    await archive.upsert("zhihu", [{ id: "a", title: "x", url: "u" }], 1000)
    await archive.upsert("weibo", [{ id: "b", title: "y", url: "u" }], 1000)
    await archive.pruneSources(["zhihu"])
    const rows = await archive.range(0, 9999)
    expect(rows.map(r => r.sourceId)).toEqual(["zhihu"])
  })

  it("pruneSources 源列表为空时不动（安全护栏）", async () => {
    await archive.upsert("zhihu", [{ id: "a", title: "x", url: "u" }], 1000)
    await archive.pruneSources([])
    const rows = await archive.range(0, 9999)
    expect(rows).toHaveLength(1)
  })
})
