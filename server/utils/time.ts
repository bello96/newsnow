// 北京时间工具：统一处理 UTC ↔ 北京时区（UTC+8）换算
export const BEIJING_OFFSET_MS = 8 * 3600 * 1000

// 北京时区「当天 0 点」对应的 UTC 毫秒
export function getBeijingMidnightUtcMs(nowMs: number) {
  const beijing = new Date(nowMs + BEIJING_OFFSET_MS)
  return Date.UTC(
    beijing.getUTCFullYear(),
    beijing.getUTCMonth(),
    beijing.getUTCDate(),
    0,
    0,
    0,
  ) - BEIJING_OFFSET_MS
}

// 北京时区的年月日（YYYY-MM-DD）/ 小时 / 分钟
export function getBeijingNow(nowMs: number) {
  const beijing = new Date(nowMs + BEIJING_OFFSET_MS)
  return {
    ymd: beijing.toISOString().slice(0, 10),
    hour: beijing.getUTCHours(),
    minute: beijing.getUTCMinutes(),
  }
}
