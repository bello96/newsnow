# 项目指南 - newsnow

供 Claude Code 在本仓库工作时使用的核心约定、坑位与命令清单。

## 项目简介

newsnow 是一个实时聚合中文互联网热点的阅读器。本仓库基于 [ourongxing/newsnow](https://github.com/ourongxing/newsnow) 精简：

- 移除 GitHub OAuth 登录、JWT 鉴权、云端元数据同步
- 移除 Docker 部署、GitHub Actions workflow
- 数据源从 44 个精简到 12 个（zhihu/weibo/coolapk/wallstreetcn/douyin/toutiao/thepaper/cls/sspai/juejin/ifeng/tencent）
- 去掉关注（focus）列、卡片 star 按钮、搜索栏、顶部"更多"按钮、"实时"菜单
- 所有源统一为 hottest 类型，全部在"最热"列展示

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite 6 + TanStack Router（file-based）+ Jotai + UnoCSS |
| 后端 | Nitro + h3 + ofetch + cheerio |
| 数据库 | db0 抽象层（本地 better-sqlite3 / CF D1） |
| 测试 | Vitest 3 |

## 关键约定

### 1. 数据源配置是生成的

- `shared/pre-sources.ts` 是**唯一**人写的源配置（`originSources` 对象 + `genSources()` 函数）
- `shared/sources.json` 和 `shared/pinyin.json` 是 `pnpm run presource` 跑 `scripts/source.ts` 生成的产物
- **修改源永远改 `pre-sources.ts`，不要直接改 JSON**——下次 presource 会覆盖
- `pnpm dev` 和 `pnpm build` 启动前会自动跑 presource

### 2. 删除/禁用数据源用 `disable`，不要删条目

在 `originSources.<id>` 里加 `disable: true`（全平台禁用）或 `disable: "cf"`（仅 Cloudflare 部署时禁用）。

**切勿直接从 `originSources` 删除条目**——会让 `AllSourceID` 类型派生丢失，导致 server/sources 下所有 `defineSource({ "id": ... })` 类型错误。

### 3. 添加数据源需四处同步

1. `shared/pre-sources.ts` 增加 `originSources["xxx"]`
2. `server/sources/xxx.ts` 实现 `export default defineSource(async () => NewsItem[])`
3. `public/icons/xxx.png` 提供图标
4. 跑 `pnpm run presource` 重新生成 JSON

### 4. 缓存策略（`server/api/s/index.ts`）

三层判定：

```
age = now - cache.updated

if (age < source.interval)        return cache  // 强冷却，防 IP 封禁
if (age < TTL && !latest)         return cache  // 软兜底，30 分钟
else                              fetch + 写回 cache
fetch 失败时降级返回旧 cache
```

任何用户都可加 `?latest=true` 跳过软兜底（登录已去掉，不再判断 `event.context.user`）。

### 5. 编码风格

项目 ESLint 规则是 `style/semi: never`（**无分号**）和**双引号**字符串。

`.prettierrc` 已对齐：
```json
{
  "semi": false,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 120
}
```

编辑器保存不会再加分号。若发现冲突，先跑 `pnpm exec eslint --fix <file>` 修复。

### 6. localStorage 旧字段会自动清理

`localStorage.metadata` 可能有早期的 `focus` / `realtime` 字段（已废弃）。`src/atoms/primitiveMetadataAtom.ts:preprocessMetadata` 会用 `initialMetadata[id]` 过滤，自动剔除已废弃字段，不会报错。

## 常用命令

```bash
pnpm dev                                       # 启动 dev (5173)
pnpm run presource                             # 改 pre-sources 后必跑
pnpm build                                     # 生产构建
pnpm start                                     # 启动构建后 Node 服务 (4444)

pnpm exec tsc --noEmit -p tsconfig.app.json    # 前端类型检查
pnpm exec tsc --noEmit -p tsconfig.node.json   # 服务端类型检查
pnpm exec eslint shared/ src/ server/          # ESLint
pnpm exec eslint --fix <file>                  # 自动修分号/引号风格

pnpm test                                      # Vitest
pnpm deploy                                    # Cloudflare Pages 部署
```

## 已知坑

### Windows 上 pnpm 版本严格检查

`package.json` 锁定 `packageManager: pnpm@10.30.3`。本地版本不一致时，pnpm 启动会自动从 npmjs.org 下载，国内网络易触发 ECONNRESET。

本地 `.npmrc`（已 gitignored）提供 workaround：
```
registry=https://registry.npmmirror.com/
manage-package-manager-versions=false
package-manager-strict=false
```

### better-sqlite3 原生编译

首次 `pnpm install` 时 better-sqlite3 需要本地编译，Windows 需要 build tools，耗时 3-5 分钟。

### V2EX 国内访问超时

源站本身不稳定（本项目已删除 v2ex 源）。如再添加，可通过 `proxySource(url, defineSource(...))` 走代理。

## 部署模式（`nitro.config.ts`）

| 环境变量 | preset | DB |
|---|---|---|
| 默认 | `node-server` | `.data/db.sqlite3`（better-sqlite3）|
| `CF_PAGES=1` | `cloudflare-pages` | D1 binding `NEWSNOW_DB` |
| `VERCEL=1` | `vercel-edge` | 无（缓存失效）|
| `BUN=1` | `bun` | `bun-sqlite` |

Cloudflare Pages 推荐：
1. `cp example.wrangler.toml wrangler.toml`
2. 在 Cloudflare 控制台建 D1 数据库，回填 `database_id`
3. `pnpm deploy`

## 不要做什么

- 不要把 `.npmrc` 入库（仅本地 workaround）
- 不要直接编辑 `shared/sources.json` 或 `shared/pinyin.json`（presource 会覆盖）
- 不要直接从 `originSources` 删除源条目（用 `disable: true`）
- 不要恢复登录/Docker/搜索栏功能，除非用户明确要求

## 文件归属（精简后剩余）

```
shared/
├── pre-sources.ts        ← 源配置（手写）
├── sources.json          ← 生成产物
├── pinyin.json           ← 生成产物
├── types.ts              NewsItem / Source / Metadata 类型
├── metadata.ts           列定义（仅剩 hottest）+ fixedColumnIds
├── consts.ts             TTL=30min, Interval=10min
└── utils.ts              类型安全工具

server/
├── api/
│   ├── s/index.ts        GET /api/s?id=xxx  单源查询 + 缓存判定
│   ├── s/entire.post.ts  POST /api/s/entire 批量缓存（首屏）
│   ├── latest.ts         版本信息
│   └── mcp.post.ts       MCP 协议端点
├── database/cache.ts     SQLite cache 表 CRUD
├── sources/              12 个源适配器
├── utils/                fetch / source 工厂 / RSS 解析
├── getters.ts            glob 自动收集 source
└── mcp/server.ts         MCP 工具实现

src/
├── routes/               TanStack Router 路由
│   ├── __root.tsx        根布局（Header + Outlet + Footer）
│   ├── index.tsx         首页（始终 hottest 列）
│   └── c.$column.tsx     /c/:column 分类页
├── components/
│   ├── column/           卡片 + DnD 拖拽
│   ├── header/           Header + Menu
│   ├── common/           Toast + OverlayScrollbar
│   ├── navbar.tsx        顶部 tab（仅 "最热"）
│   └── footer.tsx
├── atoms/
│   ├── index.ts          currentColumnIDAtom / currentSourcesAtom / goToTopAtom
│   └── primitiveMetadataAtom.ts  localStorage 持久化
├── hooks/                useRefetch / usePWA / useToast / useRelativeTime
└── utils/
```

## Commit 规范

按用户全局 CLAUDE.md（`~/.claude/CLAUDE.md`）的规则：

- 中文描述，前缀（`feat:/fix:/chore:/refactor:` 等）保留英文
- 结尾用 `合作：Claude Code Opus`，不用英文 `Co-Authored-By`
- 所有 `if` 必须有花括号 `{}`
