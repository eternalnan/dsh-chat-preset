# Chat preset

Adds an agent mode, **Chat模式**, that keeps a chat-style conversation with exactly one capability: web search. No file access, no shell, no subagents, no todo list, no goal — only `web_search`, so the model can answer with current information the way a vendor's web chat does when it turns on 联网搜索.

## What the mode contains

- `@deepseek-ai/dsh-persona` with `complete: true`: the written persona is the entire system prompt. Tool guidance, runtime context, and other prompt sections are suppressed; the persona itself states when to search and how to cite.
- `@deepseek-ai/dsh-tool-web` with `fetch: false`: registers `web_search` only. Search returns an optional answer, source lines with URLs and snippets, and a citation instruction. `web_fetch` is deliberately off — it would be a second tool and would let the model reach arbitrary URLs.
- `tool-lock` (`@local/dsh-chat-preset`): masks every tool that profile-level plugins registered globally and keeps a monotonic guard that admits only `web_search`. A preset only chooses what it mounts; without this row the mode inherits the profile's tools (Zotero, AI4Scholar, Agentero, session delete, and so on) like any other mode.
- `@deepseek-ai/dsh-compaction-basic` and `/compact`: long conversations are summarized automatically instead of failing at the context limit.

`/compact` is a command, not a tool.

## Using it

1. Open the agent-mode roster in a new session and choose **Chat模式**.
2. Talk. Answers arrive as ordinary chat replies; ask for something current and the model calls `web_search` and cites the URLs it used.
3. Return to another mode (Standard, PTC, Minimal, Creator) for work that needs files, a shell, or the rest of the system.

Existing sessions keep the mode they started with; the new mode applies to sessions created after installation.

## Search readiness

`web_search` is admitted per request only while the selected search provider can authenticate. It is withheld, with its guidance, from a request whose provider has no credential — no error card, the tool simply is not offered. The provider is whichever the deployment mounts and selects (`dsh-web-search-deepseek` or the dedicated Search API in `dsh-web-deepseek-api`); a DeepSeek account sign-in or a configured `DEEPSEEK_API_KEY` makes search ready. Chat does not configure a provider of its own, so it inherits the deployment's choice under Settings → Web search and fetch.

## Limitations

- Only `web_search` is available. The model cannot read the workspace, run commands, fetch a specific page beyond the snippets the search returns, or act on the machine. It receives no runtime context, so it does not know the current date, the working directory, or any file contents unless you paste them.
- Because the persona is complete, no future prompt section from other plugins reaches this mode, including the tool packages' own guidance sections. The persona carries the equivalent instructions instead.
- The tool lock covers tools registered in the global registry and is rebuilt whenever that registry changes. A tool a plugin injects only into its own private scope is outside the mask's reach, but the guard still denies its execution.