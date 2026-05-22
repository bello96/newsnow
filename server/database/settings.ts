import process from "node:process"
import type { Database } from "db0"

export interface UserSettings {
  id: number
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  toEmail: string
  sendHour: number
  sendMinute: number
  scheduleMode: "daily" | "once"
  sendAt: number | null
  enabled: number
  lastSentDate: string | null
  updatedAt: number
}

const DEFAULTS: Omit<UserSettings, "id" | "lastSentDate" | "updatedAt"> = {
  llmApiKey: "",
  llmBaseUrl: "https://api.deepseek.com",
  llmModel: "deepseek-v4-pro",
  toEmail: "",
  sendHour: 7,
  sendMinute: 0,
  scheduleMode: "daily",
  sendAt: null,
  enabled: 0,
}

function toCamel(row: any): UserSettings {
  return {
    id: row.id,
    llmApiKey: row.llm_api_key ?? "",
    llmBaseUrl: row.llm_base_url ?? "",
    llmModel: row.llm_model ?? "",
    toEmail: row.to_email ?? "",
    sendHour: row.send_hour ?? 0,
    sendMinute: row.send_minute ?? 0,
    scheduleMode: row.schedule_mode === "once" ? "once" : "daily",
    sendAt: row.send_at ?? null,
    enabled: row.enabled ?? 0,
    lastSentDate: row.last_sent_date ?? null,
    updatedAt: row.updated_at ?? 0,
  }
}

const SNAKE_MAP: Record<keyof Omit<UserSettings, "id">, string> = {
  llmApiKey: "llm_api_key",
  llmBaseUrl: "llm_base_url",
  llmModel: "llm_model",
  toEmail: "to_email",
  sendHour: "send_hour",
  sendMinute: "send_minute",
  scheduleMode: "schedule_mode",
  sendAt: "send_at",
  enabled: "enabled",
  lastSentDate: "last_sent_date",
  updatedAt: "updated_at",
}

export class Settings {
  constructor(private db: Database) {}

  async init() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY,
        llm_api_key TEXT NOT NULL DEFAULT '',
        llm_base_url TEXT NOT NULL DEFAULT 'https://api.deepseek.com',
        llm_model TEXT NOT NULL DEFAULT 'deepseek-v4-pro',
        to_email TEXT NOT NULL DEFAULT '',
        send_hour INTEGER NOT NULL DEFAULT 7,
        send_minute INTEGER NOT NULL DEFAULT 0,
        schedule_mode TEXT NOT NULL DEFAULT 'daily',
        send_at INTEGER,
        enabled INTEGER NOT NULL DEFAULT 0,
        last_sent_date TEXT,
        updated_at INTEGER NOT NULL DEFAULT 0
      );
    `).run()
    // 兼容旧表：缺列则补（列已存在会抛错，忽略即可）
    for (const ddl of [
      `ALTER TABLE user_settings ADD COLUMN schedule_mode TEXT NOT NULL DEFAULT 'daily'`,
      `ALTER TABLE user_settings ADD COLUMN send_at INTEGER`,
    ]) {
      try {
        await this.db.prepare(ddl).run()
      } catch {
        // 列已存在，忽略
      }
    }
    await this.db.prepare(`
      INSERT OR IGNORE INTO user_settings (id, updated_at) VALUES (1, ?)
    `).run(Date.now())
    logger.success("init settings table")
  }

  async get(): Promise<UserSettings> {
    const res = await this.db.prepare(`SELECT * FROM user_settings WHERE id = 1`).get() as any
    if (!res) {
      return { id: 1, ...DEFAULTS, lastSentDate: null, updatedAt: 0 }
    }
    return toCamel(res)
  }

  async put(partial: Partial<Omit<UserSettings, "id">>): Promise<void> {
    const entries = Object.entries(partial).filter(([k]) => k !== "id" && k in SNAKE_MAP)
    if (entries.length === 0) {
      return
    }
    const sets: string[] = []
    const values: any[] = []
    for (const [k, v] of entries) {
      const col = SNAKE_MAP[k as keyof typeof SNAKE_MAP]
      sets.push(`${col} = ?`)
      values.push(v)
    }
    sets.push("updated_at = ?")
    values.push(Date.now())
    await this.db.prepare(`UPDATE user_settings SET ${sets.join(", ")} WHERE id = 1`).run(...values)
  }

  async markSent(dateStr: string): Promise<void> {
    await this.db.prepare(`UPDATE user_settings SET last_sent_date = ?, updated_at = ? WHERE id = 1`)
      .run(dateStr, Date.now())
  }
}

export async function getSettingsTable() {
  try {
    const db = useDatabase()
    if (process.env.ENABLE_CACHE === "false") {
      return
    }
    const settings = new Settings(db)
    if (process.env.INIT_TABLE !== "false") {
      await settings.init()
    }
    return settings
  } catch (e) {
    logger.error("failed to init settings ", e)
  }
}
