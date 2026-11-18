# dsh-chat-preset

为 DeepSeek Harness 增加一个 **Chat模式**：像网页版聊天一样直接对话，只开放**一个**工具——联网搜索 `web_search`，其余工具（文件、shell、子代理、待办、目标、Zotero、AI4Scholar、Agentero……）全部屏蔽。

A DeepSeek Harness agent preset for plain chat with web search as its only tool. Everything else — filesystem, shell, subagents, todos, goals, third-party research tools — is masked out.

---

## 它做了什么

预设声明（`cordis.patch.yml`）只挂四行：

| 行 | 包 | 作用 |
| --- | --- | --- |
| `persona` | `@deepseek-ai/dsh-persona` | `complete: true`，人设即全部 system prompt：工具指引、运行时上下文、其他插件的提示词段落都不注入 |
| `tool-web` | `@deepseek-ai/dsh-tool-web` | `search: true`、`fetch: false`：只注册 `web_search`，不注册 `web_fetch` |
| `tool-lock` | 本仓库 `index.js` | 把 profile 级插件注册的全局工具整体屏蔽，并保留守卫，只放行 `web_search` |
| `compaction` | `@deepseek-ai/dsh-compaction-basic` + `/compact` | 长对话自动压缩 |

### 为什么需要 `tool-lock`

预设只能决定“自己挂什么”，决定不了“全局有什么”。工具注册表按作用域解析：profile 级插件（例如装了 `dsh-zotero`、`dsh-ai4scholar`、`agentero-dsh`）注册的工具属于全局层，每个 Agent 都会继承。只写人设说“你没有工具”，请求里照样会带上几十个工具的 schema，而且真的能调用——`persona.complete` 只清 system prompt，清不掉 `tools` 字段。

`index.js` 因此做两件事：

- `ctx.tools.restrict({ deny: [...] })`：把全局注册表里的工具名整体列进拒绝表，从 Chat模式 的可见工具集中移除（schema 不再发送，也省 token）。因为 `restrict` 只认确切名字，它订阅 `tools/change`，注册表一变就重算拒绝表。
- `ctx.tools.guard(...)`：单调否决，不看名字。只放行 `web_search`，其余调用一律拒绝，作为 mask 够不到时的兜底。

预设自己的 scoped 注册不受 restriction 影响（`web_search` 就是这样保留下来的），所以白名单里写它的名字即可。

### 为什么不要 `web_fetch`

那是第二个工具，而且 `dsh-tool-web` 的文档写明 fetch 不请求审批、HTTP provider 不限制目标地址，模型可以访问 loopback 与内网地址。纯聊天模式不该带这个能力，所以 `fetch: false`。

## 安装

要求：DSH Desktop（或带 Web 界面的 profile），其工具注册表提供 `ctx.tools.restrict`、`ctx.tools.guard` 与 `tools/change`，persona 支持 `complete`——本仓库在 DSH `0.2.2-rc.3` 上开发并校验。

二选一：

1. **命令式**：在 DSH 对话里让 agent 用 `plugin_manager`（`action: install_bundle`，`target` 指向本目录）；
2. **图形界面**：**插件 → 添加插件**，选择本目录。

安装会把它以 `link:` 依赖写进 profile，**之后不要移动或删除本目录**，否则模式失效。

装完**完全退出并重开 DeepSeek Harness**，新会话的模式列表里出现 **Chat模式**（排在最后，`order: 6`）。已有会话沿用启动时的模式，不受影响。

## 使用

新建会话 → 模式选 **Chat模式** → 直接聊。问时效性问题（新闻、版本号、价格、某人的现任职位）或明确要求“查一下”时，它会调用 `web_search` 并用 Markdown 链接引用来源。需要读写文件、跑命令时，切回 Standard / PTC / Minimal / Creator。

### 搜索能不能用

`web_search` 按每一步的 provider readiness 判定，不可用时**静默撤回**（不报错，模型根本看不到这个工具），而不是给一张报错卡。Chat模式 不指定 provider，跟随 profile 里已挂载并经“设置 → 网页搜索与抓取”选定的后端（`dsh-web-search-deepseek` 走 DeepSeek 原生搜索，或 `dsh-web-deepseek-api` 的 Search API）；DeepSeek 账号登录或配置 `DEEPSEEK_API_KEY` 即可就绪。

## 自定义

- **改人设／改搜索何时触发**：编辑 `cordis.patch.yml` 的 `persona.config.prefix`。注意 `complete: true` 会屏蔽其他插件的提示词段，所以 `dsh-tool-web` 自带的“外部内容不可信、要引用链接”那段进不了 prompt，本仓库把这套规则直接写在人设里，改人设时别把这些丢了。
- **调搜索预算**：`tool-web.config` 支持 `searchMaxResults`（默认 10）、`searchMaxQueries`（默认 10）、`searchSummaryMaxChars`（默认 800）、`searchTimeoutMs`（本仓库设 60000，因为 DeepSeek 原生搜索跑在一次完整模型回合里）。`fetch: true` 可开启 `web_fetch`，但那样就不止一个工具了，且要相应放宽 `index.js` 的白名单。
- **改显示名**：`config.name`（当前 `Chat模式`）；`config.id: chat` 是会话记录的稳定身份，改了会断开已有会话的模式绑定。

## 文件结构

```
dsh-chat-preset/
├── cordis.patch.yml   # bundle 补丁层：插入 preset-chat 一行预设声明
├── index.js           # tool-lock：restriction + guard（ESM，无依赖）
├── package.json       # dsh.bundle.patch 指向 cordis.patch.yml
├── locale/{en,zh}.json# 插件页显示用的 title / description / detail
├── docs/DETAIL.md     # 插件详情页正文
├── icon.svg           # 插件图标（36×36 聊天气泡）
└── README.md
```

调试提示：改完 `cordis.patch.yml` 或 `index.js` 都需要重启 DSH 才生效（profile 的补丁层只在启动时合成）；插件页里 `@local/dsh-chat-preset` 的激活诊断比日志更可信。

## 已知限制

- 只有一个工具：读不了工作区、跑不了命令、拿不到完整网页正文（只有搜索返回的摘要），也没有运行时上下文（不知道当前日期、工作目录、文件内容，除非你贴给它）。
- 因为人设是 `complete`，以后装的插件即使自带提示词段也进不了这个模式——这是“纯聊天”的代价，能力变化只能靠改这份预设表达。
- `tool-lock` 覆盖的是全局注册表里的工具，并在注册表变化时重建。某个插件若只在自己的私有作用域注册工具，mask 按设计盖不到（`scoped registrations stay visible`），此时靠 guard 拦住执行——模型可能看见一张用不了的工具卡。

## License

MIT — 见 [LICENSE](LICENSE)。版权署名为 `EternalNaN`（取自本仓库的 git 提交身份），需要改成别的名字/主体时，改 `LICENSE` 里的 `Copyright (c) 2026 EternalNaN` 一行即可。

`package.json` 里的 `license` 与 `repository` 字段已填：`repository.url` 是 `git+https://github.com/eternalnan/dsh-chat-preset.git`，与远程 `origin` 一致。