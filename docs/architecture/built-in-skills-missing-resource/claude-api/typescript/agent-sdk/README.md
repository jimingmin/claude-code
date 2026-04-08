# Reconstructed `typescript/agent-sdk/README.md`

这份页面可以高置信恢复成 TypeScript Claude Agent SDK 的入口页。内容依据官方 Agent SDK overview、TypeScript 包 README 和 changelog 整理，抓取时间为 2026-04-07。

## 1. Agent SDK 的定位

TypeScript Agent SDK 的公开定位非常明确：

- 不是把 Claude 当裸 `messages.create(...)` 模型端点来用
- 而是把 Claude Code 的能力作为一个可编程 agent runtime 来用

官方 README 原文强调的是：它可以让你“programmatically build AI agents with Claude Code's capabilities”。

## 2. 安装与迁移

```bash
npm install @anthropic-ai/claude-agent-sdk
```

README 同时明确说明：Claude Code SDK 已更名为 Claude Agent SDK，因此旧文档或旧集成里出现 `Claude Code SDK` 时，需要按 migration guide 理解为新包名。

## 3. 可直接确认的公开能力

从 overview 和 changelog 可以直接确认出这批能力：

- `query()`：主查询 / 流式交互入口
- `startup()`：预热 Claude 子进程，降低第一次调用冷启动成本
- `listSessions()`：列出历史 session
- `getSessionMessages()`：读取 session transcript
- `supportedAgents()`：列出可用 subagents
- `getContextUsage()`：读取上下文窗口使用情况分解
- `reloadPlugins()`：重新加载 plugins，并刷新 commands / agents / MCP 状态

这些 API 说明：TypeScript Agent SDK 不是“只有 query 的薄包装”，而是包含会话、插件、上下文与运行时 introspection 的完整宿主接口。

## 4. 文件系统配置默认不自动加载

TypeScript changelog 在 `0.1.0` 非常明确地写出了一条关键行为变化：

- 默认不再自动加载 `settings.json`、`CLAUDE.md`、slash commands、subagents
- 要通过 `settingSources` 显式声明想加载哪些设置来源

这点对缺失技能文档非常重要，因为它解释了为什么官方 overview 会单独强调：

- `settingSources: ['project']`

只有显式启用 project settings，Claude Code 的本地项目能力才会一起进入 Agent SDK 运行时。

## 5. 打开 `settingSources: ['project']` 之后会发生什么

官方 overview 和 changelog 共同表明，project settings 打开后，Agent SDK 会把 Claude Code 的文件系统能力一起带进来，包括：

- skills：`.claude/skills/*/SKILL.md`
- slash commands：`.claude/commands/*.md`
- memory：`CLAUDE.md` / `.claude/CLAUDE.md`
- project MCP servers：例如 `.mcp.json`
- plugins：通过 runtime 插件机制暴露的附加能力

这也就是 `claude-api` 技能把 Agent SDK 单独分成一套子文档的原因：它不是普通 Client SDK 的附录，而是另一条能力装载路线。

## 6. 这页在原技能里的角色

对 `claude-api` skill 来说，这一页本来承担的是“先建立心智模型”的职责：

- 如果你要自己掌控消息循环，用 Client SDK
- 如果你想直接获得 Claude Code 的 built-in tools、session runtime 和 settings loading，用 Agent SDK