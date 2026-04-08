# Claude Code 内置提示词源码追踪

## 1. 文档目标

这份文档回答的不是“有哪些 prompt”，而是“这些 prompt 在源码里如何一路走到模型请求里”。

读法建议如下：

- 要看 prompt 清单和用途，先读 [built-in-prompts.md](./built-in-prompts.md)。
- 要先看一页速查入口，读 [built-in-prompts-quick-reference.md](./built-in-prompts-quick-reference.md)。
- 要看 built-in agents 的来源与原始内容，读 [built-in-agents.md](./built-in-agents.md)。
- 要看 bundled skills 的来源与原始内容，读 [built-in-skills.md](./built-in-skills.md)。
- 要改某条具体链路，就从本页对应的小节直接顺着函数名追。

## 2. 总体追踪图

```mermaid
flowchart TD
    REPL[REPL turn handler] --> GSP[getSystemPrompt()]
    GSP --> Sections[resolveSystemPromptSections()]
    Sections --> Effective[buildEffectiveSystemPrompt()]
    Effective --> Query[query(...)]
    Query --> API[buildSystemPromptBlocks()]

    Tools[getAllBaseTools()] --> ToolSchema[toolToAPISchema()]
    ToolSchema --> API

    Slash[processSlashCommand()] --> CmdPrompt[getPromptForCommand()]
    CmdPrompt --> Query

    SidePrompt[services/** prompt builders] --> SideExec[runForkedAgent / runAgent / queryHaiku / queryModelWithoutStreaming / sideQuery]
```

## 3. 主会话系统 prompt 链路

### 3.1 REPL 主线程路径

这条路径是交互式会话里最常见的主链路。

| 步骤 | 函数 / 文件 | 产物 | 作用 |
| --- | --- | --- | --- |
| 1 | [src/screens/REPL.tsx](../../src/screens/REPL.tsx) | 当前 turn 的 `tools`、`mcpClients`、`toolUseContext` | 先把本轮可见能力和上下文准备好 |
| 2 | [src/constants/prompts.ts](../../src/constants/prompts.ts) `getSystemPrompt(...)` | `defaultSystemPrompt: string[]` | 生成默认主系统 prompt 的各 section |
| 3 | [src/constants/systemPromptSections.ts](../../src/constants/systemPromptSections.ts) `resolveSystemPromptSections(...)` | 动态 section 的字符串数组 | 对会话级 section 做求值、缓存和失效控制 |
| 4 | [src/utils/systemPrompt.ts](../../src/utils/systemPrompt.ts) `buildEffectiveSystemPrompt(...)` | 最终生效的 `SystemPrompt` | 在 default、custom、append 等候选之间做优先级决策 |
| 5 | [src/screens/REPL.tsx](../../src/screens/REPL.tsx) 调 `query({ systemPrompt, userContext, systemContext, ... })` | 单轮查询输入 | 把 prompt 与消息、权限、上下文一起交给执行内核 |
| 6 | [src/services/api/claude.ts](../../src/services/api/claude.ts) `buildSystemPromptBlocks(...)` | API `system` blocks | 把 `SystemPrompt` 转成带缓存标记的实际 API 请求块 |

这里最关键的事实是：

- `getSystemPrompt()` 负责生成默认 prompt 内容。
- `buildEffectiveSystemPrompt()` 负责决定“谁覆盖谁”。
- `buildSystemPromptBlocks()` 负责把字符串数组变成真正发给模型的 API 结构。

### 3.2 QueryEngine / SDK 共享前缀路径

并不是所有路径都直接走 REPL。headless、SDK、bridge 恢复和 side question fallback 还会复用一套共享前缀装配逻辑。

| 步骤 | 函数 / 文件 | 作用 |
| --- | --- | --- |
| 1 | [src/QueryEngine.ts](../../src/QueryEngine.ts) `submitMessage(...)` | 在非 REPL 路径里准备本轮查询所需的上下文部件 |
| 2 | [src/utils/queryContext.ts](../../src/utils/queryContext.ts) `fetchSystemPromptParts(...)` | 并行拉取 `defaultSystemPrompt`、`userContext`、`systemContext` |
| 3 | [src/utils/queryContext.ts](../../src/utils/queryContext.ts) `buildSideQuestionFallbackParams(...)` | 当没有现成 cache-safe params 时，重建与主线程尽量一致的 prompt 前缀 |

这一层不负责 agent 或 skill 的能力装载，而是负责把“系统 prompt 三件套”提炼成可复用的共享前缀。

## 4. 工具级 prompt 链路

工具 prompt 不走主系统 prompt 数组，而是走 API tool schema 的 `description` 字段。

| 步骤 | 函数 / 文件 | 作用 |
| --- | --- | --- |
| 1 | [src/tools.ts](../../src/tools.ts) `getAllBaseTools()` | 汇总当前 build 和 feature gate 下可能出现的所有工具 |
| 2 | 具体工具实现，典型如 [src/tools/TaskCreateTool/TaskCreateTool.ts](../../src/tools/TaskCreateTool/TaskCreateTool.ts) | 通过 `buildTool({ description(), prompt(), ... })` 暴露模型可见文本 |
| 3 | 对应的 prompt 源文件，典型如 [src/tools/TaskCreateTool/prompt.ts](../../src/tools/TaskCreateTool/prompt.ts) | 提供 `DESCRIPTION`、`getPrompt()` 之类的原始说明文本 |
| 4 | [src/utils/api.ts](../../src/utils/api.ts) `toolToAPISchema(...)` | 调 `await tool.prompt(...)`，把工具 prompt 变成 API schema 的 `description` |
| 5 | [src/services/api/claude.ts](../../src/services/api/claude.ts) 构造 `toolSchemas` | 只把当前请求允许的工具发给模型，并处理 deferred loading 等附加字段 |

需要注意两点：

1. 工具 prompt 是“工具说明书”，不是主系统 prompt 的 section。
2. 模型看见的是转换后的 tool schema，不是 `prompt.ts` 文件本身。

## 5. 内置命令 prompt 链路

用户输入 `/review`、`/commit`、`/init` 这类 prompt 命令时，prompt 会先被展开成消息，再重新进入主查询。

### 5.1 普通 prompt 命令路径

| 步骤 | 函数 / 文件 | 作用 |
| --- | --- | --- |
| 1 | [src/utils/processUserInput/processSlashCommand.tsx](../../src/utils/processUserInput/processSlashCommand.tsx) `processSlashCommand(...)` | 解析 `/command args` 并分发到具体命令对象 |
| 2 | 同文件 `getMessagesForSlashCommand(...)` | 识别命令类型，决定走本地命令、JSX 命令还是 prompt 命令 |
| 3 | 同文件 `getMessagesForPromptSlashCommand(...)` | 对 prompt 命令执行 `command.getPromptForCommand(args, context)` |
| 4 | 同文件 `createUserMessage(...)` 包装逻辑 | 把 prompt 内容包成 metadata 消息、`isMeta: true` 主消息、附件和权限附件 |
| 5 | 返回 `shouldQuery: true` | 让这些新消息进入下一轮 `query(...)`，由主模型继续执行这个工作流 |

也就是说，内置命令 prompt 的内容不是直接塞进系统 prompt，而是变成“本轮新增的用户 / meta 消息”。

### 5.2 `context: 'fork'` 的命令路径

一部分 prompt 命令不会在主线程直接展开，而是拉起子会话隔离执行。

| 步骤 | 函数 / 文件 | 作用 |
| --- | --- | --- |
| 1 | [src/utils/processUserInput/processSlashCommand.tsx](../../src/utils/processUserInput/processSlashCommand.tsx) `executeForkedSlashCommand(...)` | 命中 `command.context === 'fork'` 时切到隔离执行路径 |
| 2 | [src/utils/forkedAgent.ts](../../src/utils/forkedAgent.ts) `prepareForkedCommandContext(...)` | 生成 fork 所需的 promptMessages、状态视图与共享上下文 |
| 3 | [src/tools/AgentTool/runAgent.ts](../../src/tools/AgentTool/runAgent.ts) `runAgent(...)` | 让这段命令 prompt 在独立子会话里执行 |

> 说明：这里出现 `runAgent(...)` 只是因为 forked execution 复用了同一套执行器，不代表本页要把 built-in agents 本身并进 prompt 分层。内置 agent 的列表与内容单独见 [built-in-agents.md](./built-in-agents.md)。

## 6. 后台 / Side Query prompt 链路

这一层最适合用“prompt builder -> caller -> 模型调用 helper”去追。

| 任务 | prompt builder | caller | 模型调用 helper |
| --- | --- | --- | --- |
| Session memory 更新 | [src/services/SessionMemory/prompts.ts](../../src/services/SessionMemory/prompts.ts) `buildSessionMemoryUpdatePrompt(...)` | [src/services/SessionMemory/sessionMemory.ts](../../src/services/SessionMemory/sessionMemory.ts) | `runForkedAgent(...)` |
| Magic Docs 更新 | [src/services/MagicDocs/prompts.ts](../../src/services/MagicDocs/prompts.ts) `buildMagicDocsUpdatePrompt(...)` | [src/services/MagicDocs/magicDocs.ts](../../src/services/MagicDocs/magicDocs.ts) | `runAgent(...)` |
| 自动记忆提取 | [src/services/extractMemories/prompts.ts](../../src/services/extractMemories/prompts.ts) `buildExtractCombinedPrompt(...)` / `buildExtractAutoOnlyPrompt(...)` | [src/services/extractMemories/extractMemories.ts](../../src/services/extractMemories/extractMemories.ts) | `runForkedAgent(...)` |
| 全量 / 局部 compact | [src/services/compact/prompt.ts](../../src/services/compact/prompt.ts) `getCompactPrompt(...)` / `getPartialCompactPrompt(...)` | [src/services/compact/compact.ts](../../src/services/compact/compact.ts) | `queryModelWithStreaming(...)` |
| prompt suggestion | [src/services/PromptSuggestion/promptSuggestion.ts](../../src/services/PromptSuggestion/promptSuggestion.ts) `SUGGESTION_PROMPT` / `generateSuggestion(...)` | 同文件 | `runForkedAgent(...)` |
| 工具摘要标签 | [src/services/toolUseSummary/toolUseSummaryGenerator.ts](../../src/services/toolUseSummary/toolUseSummaryGenerator.ts) `TOOL_USE_SUMMARY_SYSTEM_PROMPT` | 同文件 | `queryHaiku(...)` |
| away summary | [src/services/awaySummary.ts](../../src/services/awaySummary.ts) `buildAwaySummaryPrompt(...)` | 同文件 | `queryModelWithoutStreaming(...)` |
| agent progress summary | [src/services/AgentSummary/agentSummary.ts](../../src/services/AgentSummary/agentSummary.ts) `buildSummaryPrompt(...)` | 同文件 | `runForkedAgent(...)` |
| session 自动命名 | [src/commands/rename/generateSessionName.ts](../../src/commands/rename/generateSessionName.ts) 内联 `systemPrompt` | 同文件 | `queryHaiku(...)` |
| auto mode 权限分类 | [src/utils/permissions/yoloClassifier.ts](../../src/utils/permissions/yoloClassifier.ts) `buildYoloSystemPrompt(...)` | 同文件 `classifyYoloAction(...)` | `sideQuery(...)` |

这张表的重点不是“有哪些 prompt”，而是“每个 prompt 实际由谁触发、走哪条模型调用通道”。

## 7. 调试 prompt 时的最短追踪法

1. 如果问题是 Claude Code 的总行为不对，从 [src/screens/REPL.tsx](../../src/screens/REPL.tsx) -> [src/constants/prompts.ts](../../src/constants/prompts.ts) -> [src/utils/systemPrompt.ts](../../src/utils/systemPrompt.ts) 开始追。
2. 如果问题是工具说明不对，从 [src/tools.ts](../../src/tools.ts) -> 对应 `src/tools/<ToolName>/prompt.ts` -> [src/utils/api.ts](../../src/utils/api.ts) 开始追。
3. 如果问题是 `/command` 工作流不对，从 [src/utils/processUserInput/processSlashCommand.tsx](../../src/utils/processUserInput/processSlashCommand.tsx) -> 对应 [src/commands/](../../src/commands) 文件开始追。
4. 如果问题是后台维护任务不对，从对应 `src/services/**/prompts.ts` 开始，再找 caller 文件里实际调用的 `runForkedAgent()`、`runAgent()`、`queryHaiku()`、`queryModelWithoutStreaming()` 或 `sideQuery()`。
5. 如果你实际上想查 built-in agents 的内容，不要继续沿本页追，直接看 [built-in-agents.md](./built-in-agents.md)。
6. 如果你实际上想查 bundled skills 的内容，不要继续沿本页追，直接看 [built-in-skills.md](./built-in-skills.md)。