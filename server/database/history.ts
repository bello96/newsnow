import process from "node:process"
import type { Database } from "db0"

export interface HistoryRow {
  id: number
  generatedAt: number
  text: string
  model: string | null
  newsCount: number | null
  sentTo: string | null
  emailStatus: string
  emailError: string | null
}

export interface HistoryInsert {
  generatedAt: number
  text: string
  model: string | null
  newsCount: number | null
  sentTo: string | null
  emailStatus: string
  emailError: string | null
}

function toCamel(row: any): HistoryRow {
  return {
    id: row.id,
    generatedAt: row.generated_at,
    text: row.text,
    model: row.model,
    newsCount: row.news_count,
    sentTo: row.sent_to,
    emailStatus: row.email_status,
    emailError: row.email_error,
  }
}

export class History {
  constructor(private db: Database) {}

  async init() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        generated_at INTEGER NOT NULL,
        text TEXT NOT NULL,
        model TEXT,
        news_count INTEGER,
        sent_to TEXT,
        email_status TEXT NOT NULL,
        email_error TEXT
      );
    `).run()
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_history_generated_at ON analysis_history(generated_at DESC);
    `).run()
    logger.success("init history table")
  }

  async insert(row: HistoryInsert): Promise<number> {
    const res = await this.db.prepare(`
      INSERT INTO analysis_history (generated_at, text, model, news_count, sent_to, email_status, email_error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(row.generatedAt, row.text, row.model, row.newsCount, row.sentTo, row.emailStatus, row.emailError) as any
    return Number(res?.lastInsertRowid ?? res?.meta?.last_row_id ?? 0)
  }

  async recent(limit = 7): Promise<HistoryRow[]> {
    const res = await this.db.prepare(`
      SELECT * FROM analysis_history ORDER BY generated_at DESC LIMIT ?
    `).all(limit) as any
    const rows = (res.results ?? res) as any[]
    return rows.map(toCamel)
  }

  async cleanup(cutoffMs: number): Promise<void> {
    await this.db.prepare(`DELETE FROM analysis_history WHERE generated_at < ?`).run(cutoffMs)
  }
}

export async function getHistoryTable() {
  try {
    const db = useDatabase()
    if (process.env.ENABLE_CACHE === "false") {
      return
    }
    const history = new History(db)
    if (process.env.INIT_TABLE !== "false") {
      await history.init()
    }
    return history
  } catch (e) {
    logger.error("failed to init history ", e)
  }
}
