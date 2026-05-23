import process from "node:process"
import type { Database } from "db0"
import type { NewsItem, SourceID } from "@shared/types"

export interface ArchiveRow {
  sourceId: SourceID
  newsId: string
  title: string
  url: string
  pubDate: number | null
  extra: string | null
  firstSeen: number
  lastSeen: number
}

export class Archive {
  constructor(private db: Database) {}

  async init() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS news_archive (
        source_id TEXT NOT NULL,
        news_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        pub_date INTEGER,
        extra TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        PRIMARY KEY (source_id, news_id)
      );
    `).run()
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_archive_first_seen ON news_archive(first_seen);
    `).run()
    logger.success("init archive table")
  }

  async upsert(sourceId: SourceID, items: NewsItem[], now: number) {
    for (const item of items) {
      const pubDate = typeof item.pubDate === "number"
        ? item.pubDate
        : item.pubDate
          ? Date.parse(item.pubDate) || null
          : null
      const extra = item.extra ? JSON.stringify(item.extra) : null
      await this.db.prepare(`
        INSERT INTO news_archive (source_id, news_id, title, url, pub_date, extra, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_id, news_id) DO UPDATE SET
          title = excluded.title,
          url = excluded.url,
          pub_date = excluded.pub_date,
          extra = excluded.extra,
          last_seen = excluded.last_seen
      `).run(sourceId, String(item.id), item.title, item.url, pubDate, extra, now, now)
    }
  }

  async range(fromMs: number, toMs: number, sourceIds?: SourceID[]): Promise<ArchiveRow[]> {
    const whereSrc = sourceIds?.length ? ` AND source_id IN (${sourceIds.map(() => "?").join(",")})` : ""
    const params = [fromMs, toMs, ...(sourceIds ?? [])]
    const res = await this.db.prepare(`
      SELECT source_id, news_id, title, url, pub_date, extra, first_seen, last_seen
      FROM news_archive
      WHERE first_seen >= ? AND first_seen <= ?${whereSrc}
      ORDER BY first_seen DESC
    `).all(...params) as any
    /**
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#return-object
     * cloudflare d1 .all() will return
     * {
     *   success: boolean
     *   meta:
     *   results:
     * }
     */
    const rows = (res.results ?? res) as any[]
    return rows.map(r => ({
      sourceId: r.source_id as SourceID,
      newsId: r.news_id as string,
      title: r.title as string,
      url: r.url as string,
      pubDate: r.pub_date as number | null,
      extra: r.extra as string | null,
      firstSeen: r.first_seen as number,
      lastSeen: r.last_seen as number,
    }))
  }

  async cleanup(cutoffMs: number) {
    await this.db.prepare(`DELETE FROM news_archive WHERE first_seen < ?`).run(cutoffMs)
  }

  // 删除已不在源列表里的归档行（删源后自动清掉孤儿数据，如已移除的 juejin）。
  // validIds 为空时不动，避免误清空整张表。
  async pruneSources(validIds: SourceID[]): Promise<number> {
    if (!validIds.length) {
      return 0
    }
    const placeholders = validIds.map(() => "?").join(",")
    const res: any = await this.db
      .prepare(`DELETE FROM news_archive WHERE source_id NOT IN (${placeholders})`)
      .run(...validIds)
    return res?.changes ?? res?.meta?.changes ?? 0
  }
}

export async function getArchiveTable() {
  try {
    const db = useDatabase()
    if (process.env.ENABLE_CACHE === "false") {
      return
    }
    const archive = new Archive(db)
    if (process.env.INIT_TABLE !== "false") {
      await archive.init()
    }
    return archive
  } catch (e) {
    logger.error("failed to init archive ", e)
  }
}
