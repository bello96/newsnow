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

## 信息速递员 - 定时口播稿生成 + 邮件投递

### 工作流

```
GitHub Actions
  ├─ 每 2 小时  POST /api/cron/fetch     → 抓取 12 源新闻 upsert 到 news_archive
  ├─ 每日 02:00  POST /api/cron/cleanup  → 删除 30 天前归档
  └─ 每小时整点  POST /api/cron/analyze
        ├─ 检查 user_settings.enabled
        ├─ 检查当前北京小时 == user_settings.send_hour
        ├─ 检查 last_sent_date != 今日
        ├─ 拉今日 news_archive 全量
        ├─ 调 LLM（内嵌 server/assets/prompts/douyin.md 作 system prompt）
        ├─ 调 Resend HTTP API 发邮件到 to_email
        └─ 写 analysis_history + markSent
```

### 一次性配置

1. **GitHub Secrets** (Settings → Secrets and variables → Actions)：
   - `PROD_URL` = 部署域名
   - `CRON_TOKEN` = `openssl rand -hex 16` 生成的 32 字符

2. **Cloudflare Pages env**（D1 binding `NEWSNOW_DB` + 以下变量）：
   - `CRON_TOKEN`（同 GH）
   - `INIT_TABLE=true`、`ENABLE_CACHE=true`

3. **Resend** (resend.com)：
   - 注册账号 → API key
   - Add domain → `dengjiabei.cn`（或你的域名）
   - 按提示加 SPF / DKIM / DMARC 三条 DNS 记录到 Cloudflare
   - 等 Resend 验证通过

4. **浏览器** 访问 `/summary` → 点配置 → 填写：
   - 管理 Token = 上面的 `CRON_TOKEN`
   - LLM API Key / Model（deepseek-v4-pro 等）
   - Resend API Key / 发件邮箱（如 `news@dengjiabei.cn`）/ 收件邮箱
   - 发送小时（北京时间 0-23）
   - 勾选「启用定时」→ 保存

### 编辑 prompt 模板

prompt 在 `server/assets/prompts/douyin.md`，作为 server-side asset 编译进 Nitro。修改后必须重新部署生效（`pnpm run deploy`）。

### 数据库表

**`news_archive`** — 跨次抓取累积去重的新闻库
```sql
CREATE TABLE news_archive (
  source_id TEXT, news_id TEXT, title TEXT, url TEXT,
  pub_date INTEGER, extra TEXT,
  first_seen INTEGER, last_seen INTEGER,
  PRIMARY KEY (source_id, news_id)
);
```

**`user_settings`** — 单行表，存运行时配置（LLM key、Resend key、邮箱、定时小时等）。CHECK 约束保证只有一行。

**`analysis_history`** — 历史口播稿。每次 cron/analyze（含 dryRun）都会插入一行，记录 text、模型、新闻条数、邮件状态。

### Cron 调度（UTC）

| 任务 | 表达式 | 北京时间 |
|---|---|---|
| 抓取新闻 | `0 */2 * * *` | 每 2 小时 |
| 清理归档 | `0 18 * * *` | 每日 02:00 |
| 生成 + 发邮件 | `0 * * * *` | 每小时整点（命中 send_hour 才执行） |

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
