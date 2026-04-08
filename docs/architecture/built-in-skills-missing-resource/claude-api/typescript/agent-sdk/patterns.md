# Reconstructed `typescript/agent-sdk/patterns.md`

这份页面可以高置信恢复成 TypeScript Agent SDK 的实践模式页。内容依据官方 Agent SDK overview、TypeScript changelog 和公开 README 整理，抓取时间为 2026-04-07。

## 1. 模式一：先决定要不要加载 Claude Code 的文件系统能力

最重要的模式不是代码层技巧，而是配置边界：

- 默认模式：不加载本地 `CLAUDE.md`、skills、slash commands、subagents
- 项目模式：通过 `settingSources: ['project']` 显式加载这些内容

这条边界直接决定你的 agent 是“纯程序化宿主”还是“带本地 Claude Code 语义的宿主”。

## 2. 模式二：显式限定可用工具

TypeScript changelog 明确记录过 `tools` 选项：

- `tools: ['Bash', 'Read', 'Edit']` 表示严格 allowlist
- `tools: []` 表示禁用所有 built-in tools
- `tools: { type: 'preset', preset: 'claude_code' }` 表示使用默认工具集

因此，这页应当强调的实践不是“工具默认都开着”，而是：生产环境要显式声明工具边界。

## 3. 模式三：把 session 当一等对象

公开 changelog 已经确认了完整的 session 相关能力：

- `listSessions()`
- `getSessionInfo()`
- `getSessionMessages()`
- `renameSession()`
- `tagSession()`
- `forkSession()`

这说明 Agent SDK 并不只适合一次性查询；它天然支持把对话、恢复、分叉和审计做成应用层对象。

## 4. 模式四：把 subagent 当运行时资源而不是 prompt 技巧

公开 changelog 还能确认：

- `supportedAgents()` 可以列出可用 subagents
- `skills` 与 `maxTurns` 可以作为 custom agent 定义的一部分
- background subagent progress 会通过 `task_progress` / `task_started` 一类事件暴露

因此，TypeScript Agent SDK 对 subagent 的看法更接近“runtime primitive”，而不是手工 prompt hack。

## 5. 模式五：把 plugins / MCP / hooks 当可热更新控制面

官方 changelog 已明确暴露出：

- `reloadPlugins()`
- `reconnectMcpServer()` / `toggleMcpServer()`
- 更丰富的 `McpServerStatus`
- hook lifecycle messages 与 hook event types

这意味着一个成熟的宿主应用不应只关心模型输出，还应把插件和 MCP 连接状态纳入自己的运维 / 观测面。

## 6. 模式六：为生产宿主预留 startup、debug 和 context 观测位

公开变更里已经确认：

- `startup()` 用于预热 CLI subprocess
- `debug` / `debugFile` 用于程序化 debug logging
- `getContextUsage()` 用于上下文使用量分解

因此，这页最后本来应该落在一个工程结论上：

- 在 demo 里，直接 `query()` 就够了
- 在正式应用里，至少还要考虑 startup、context usage、session 管理和 plugins / MCP 状态观测