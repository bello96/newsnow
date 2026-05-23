import process from "node:process"
import { Interval } from "./consts"
import { typeSafeObjectFromEntries } from "./type.util"
import type { OriginSource, Source, SourceID } from "./types"

const Time = {
  Test: 1,
  Realtime: 2 * 60 * 1000,
  Fast: 5 * 60 * 1000,
  Default: Interval, // 10min
  Common: 30 * 60 * 1000,
  Slow: 60 * 60 * 1000,
}

export const originSources = {
  zhihu: {
    name: "知乎",
    type: "hottest",
    column: "china",
    color: "blue",
    home: "https://www.zhihu.com",
  },
  weibo: {
    name: "微博",
    title: "实时热搜",
    type: "hottest",
    column: "china",
    color: "yellow",
    interval: Time.Realtime,
    home: "https://weibo.com",
  },
  coolapk: {
    name: "酷安",
    type: "hottest",
    column: "tech",
    color: "green",
    title: "今日最热",
    home: "https://coolapk.com",
  },
  wallstreetcn: {
    name: "华尔街见闻",
    color: "indigo",
    column: "finance",
    home: "https://wallstreetcn.com/",
    type: "hottest",
    title: "最热",
    interval: Time.Common,
  },
  douyin: {
    name: "抖音",
    type: "hottest",
    column: "china",
    color: "cyan",
    home: "https://www.douyin.com",
  },
  toutiao: {
    name: "今日头条",
    type: "hottest",
    column: "china",
    color: "pink",
    home: "https://www.toutiao.com",
  },
  thepaper: {
    name: "澎湃新闻",
    interval: Time.Common,
    type: "hottest",
    column: "china",
    title: "热榜",
    color: "teal",
    home: "https://www.thepaper.cn",
  },
  cls: {
    name: "财联社",
    color: "red",
    column: "finance",
    home: "https://www.cls.cn",
    type: "hottest",
    title: "热门",
  },
  sspai: {
    name: "少数派",
    column: "tech",
    color: "rose",
    type: "hottest",
    home: "https://sspai.com",
  },
  ifeng: {
    name: "凤凰网",
    column: "china",
    color: "orange",
    type: "hottest",
    title: "热点资讯",
    home: "https://www.ifeng.com",
  },
  tencent: {
    name: "腾讯新闻",
    column: "china",
    color: "sky",
    home: "https://news.qq.com/tag/aEWqxLtdgmQ=",
    type: "hottest",
    title: "综合早报",
    interval: Time.Common,
  },
  aihot: {
    name: "AIHOT",
    title: "AI 热点",
    type: "hottest",
    column: "tech",
    color: "purple",
    home: "https://aihot.virxact.com",
    interval: Time.Common,
  },
} as const satisfies Record<string, OriginSource>

export function genSources() {
  const _: [SourceID, Source][] = []

  Object.entries(originSources).forEach(([id, source]: [any, OriginSource]) => {
    _.push([
      id,
      {
        name: source.name,
        type: source.type,
        disable: source.disable,
        desc: source.desc,
        column: source.column,
        home: source.home,
        color: source.color ?? "primary",
        interval: source.interval ?? Time.Default,
        title: source.title,
      },
    ])
  })

  return typeSafeObjectFromEntries(
    _.filter(([_, v]) => {
      if (v.disable === "cf" && process.env.CF_PAGES) {
        return false
      } else {
        return v.disable !== true
      }
    }),
  )
}
