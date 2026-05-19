![](/public/og-image.png)

***优雅地阅读实时热门新闻***

> 本项目基于 [ourongxing/newsnow](https://github.com/ourongxing/newsnow) 精简改造：移除 GitHub OAuth 登录、Docker 部署、关注/搜索栏功能，数据源从 44 个精简到 12 个。

## 功能特性

- 优雅的阅读界面，实时聚合中文互联网热点
- 默认缓存 30 分钟，超时自动刷新；任何用户可点击卡片强制刷新
- 根据内容源更新频率动态调整抓取间隔（最快每 2 分钟），避免 IP 被封禁
- 智能降级：源站访问失败时自动返回上次缓存
- 支持 MCP server，可被 Claude 等 AI 客户端调用

```json
{
  "mcpServers": {
    "newsnow": {
      "command": "npx",
      "args": [
        "-y",
        "newsnow-mcp-server"
      ],
      "env": {
        "BASE_URL": "https://newsnow.busiyi.world"
      }
    }
  }
}
```

你可以将 `BASE_URL` 修改为你的部署域名。

## 已支持的数据源（12 个）

| 分类 | 数据源 |
|---|---|
| 国内 | 知乎、微博、抖音、今日头条、澎湃新闻、凤凰网、腾讯新闻（综合早报）|
| 科技 | 酷安（今日最热）、少数派、稀土掘金 |
| 财经 | 华尔街见闻（最热）、财联社（热门）|

## 部署指南

### 基础部署

1. Fork 本仓库
2. 导入至目标平台

### Cloudflare Pages 配置

- 构建命令：`pnpm run build`
- 输出目录：`dist/output/public`

### 环境变量配置

参考 `example.env.server`，本地运行时重命名为 `.env.server` 并填写：

```env
# 初始化数据库，首次运行必须设置为 true，之后可关闭
INIT_TABLE=true
# 是否启用缓存
ENABLE_CACHE=true
```

### 数据库支持

本项目主推 Cloudflare Pages 部署，Vercel Edge 无内置数据库（缓存层失效），其他可选数据库可参考 https://db0.unjs.io/connectors 。

1. 在 Cloudflare 控制台创建 D1 数据库
2. 将 `example.wrangler.toml` 重命名为 `wrangler.toml`
3. 填入 `database_id` 和 `database_name`
4. 重新部署生效

## 开发

> 需要 Node.js >= 20

```bash
corepack enable
pnpm i
pnpm dev
```

启动后访问 http://localhost:5173

### 添加数据源

需要三处同步修改：

1. 在 `shared/pre-sources.ts` 的 `originSources` 中添加配置
2. 在 `server/sources/` 创建对应 `<id>.ts`，`export default defineSource(async () => NewsItem[])`
3. 在 `public/icons/` 提供同名 png 图标
4. 跑 `pnpm run presource` 重新生成 `shared/sources.json`、`shared/pinyin.json`

### 删除数据源

在 `pre-sources.ts` 对应源对象里加 `disable: true`，然后跑 `pnpm run presource`。不要直接从 `originSources` 删条目——会破坏 `AllSourceID` 类型派生导致 server/sources 全项目类型错误。

### 缓存策略

`server/api/s/index.ts` 三层判定：

- `now - cache.updated < source.interval` → 强冷却期，直接返回缓存（防 IP 封禁）
- `now - cache.updated < TTL(30 分钟) && !latest` → 软兜底期，返回缓存
- 其他情况 → 调用 getter 实际爬源站

加上 `?latest=true` 可跳过 TTL 软兜底（任何用户都可，不需登录）。

## 项目结构

```
shared/                共享代码（前后端）
├── pre-sources.ts     源的唯一手写配置
├── sources.json       生成产物（不要直接改）
├── types.ts           NewsItem / Source 类型定义
├── metadata.ts        列定义和默认元数据
└── consts.ts          TTL / Interval 常量

server/                Nitro 服务端
├── api/s/             单源 / 批量缓存 API
├── database/cache.ts  SQLite 缓存表
├── sources/           12 个数据源适配器
└── utils/source.ts    defineSource 工厂函数

src/                   React 前端
├── routes/            TanStack Router file-based 路由
├── components/        卡片、Header、NavBar
├── atoms/             Jotai 全局状态
└── hooks/             刷新、PWA、Toast
```

## License

[MIT](./LICENSE) © ourongxing
