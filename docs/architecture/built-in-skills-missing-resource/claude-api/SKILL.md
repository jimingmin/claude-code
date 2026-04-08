# Reconstructed `claude-api/SKILL.md`

这份文件不是逐字原文，而是依据 `registerClaudeApiSkill()`、`INLINE_READING_GUIDE`、`buildPrompt()` 和 Anthropic 官方文档高置信恢复出的技能主体。

## 1. 何时触发

当前源码里可以直接确认的触发条件是：

- 当代码导入 `anthropic`、`@anthropic-ai/sdk`、`claude_agent_sdk`。
- 当用户明确要求使用 Claude API、Anthropic SDK 或 Agent SDK。

同时也明确给出了负触发条件：

- 不要因为代码导入 `openai` 或其他 AI SDK 就触发。
- 一般编程、通用 ML / 数据科学任务也不应默认落入这个技能。

## 2. 这份技能的工作方式

从 `buildPrompt()` 可以确认，它不是一段短 prompt，而是由几层内容拼起来：

1. 顶层 `SKILL_PROMPT`
2. 语言检测结果
3. 一段阅读指南
4. 按语言筛选后的 `<doc path="...">...</doc>` 内联文档
5. “何时使用 WebFetch”说明
6. 可选的 `User Request`

因此，这份缺失文件原本更像“索引型入口页”，而不是全部知识本体。

## 3. 高置信恢复的主体内容

### 角色定义

你在这里的角色是：帮助用户基于 Claude API、Anthropic Client SDK 或 Claude Agent SDK 构建应用，而不是处理其它模型提供商或无关的一般编程任务。

### 首先判断语言与任务类型

在项目语言可识别时，应优先查阅该语言对应的文档集；如果语言不可识别，则应先向用户确认语言，再进入相应页面。

### 任务分流阅读指南

- 单轮文本分类、摘要、抽取、问答：去看语言入口页。
- 聊天 UI、实时输出展示：去看语言入口页加 streaming 页。
- 长对话 / 上下文可能过长：去看语言入口页中的 compaction / context 管理部分。
- Prompt caching：去看 [shared/prompt-caching.md](./shared/prompt-caching.md)。
- Tool use / function calling / agents：去看 [shared/tool-use-concepts.md](./shared/tool-use-concepts.md) 加语言专属 `tool-use.md`。
- Batch processing：去看语言专属 `batches.md`。
- Files API：去看语言专属 `files-api.md`。
- Python / TypeScript 的 Agent SDK：去看各自 `agent-sdk/README.md` 与 `patterns.md`。
- 错误处理：去看 [shared/error-codes.md](./shared/error-codes.md)。
- 需要最新模型、价格、beta header 或 SDK 参数：去看 [shared/live-sources.md](./shared/live-sources.md)。

## 4. 何时使用 WebFetch

虽然原始 `## When to Use WebFetch` 正文已经缺失，但从 wrapper 结构和 `shared/live-sources.md` 的角色可以高置信恢复出下面这条运行规则：

- 当问题依赖实时变化的信息时，不应只依赖仓库内联文档。
- 尤其是模型价格、模型 ID、beta headers、区域可用性、最新 SDK 写法这类信息，应优先抓官方文档。
- WebFetch 的作用是补“动态权威值”，不是替代本地技能对结构化知识的组织。

## 5. 置信边界

- 触发语义、装配结构和阅读指南可以直接由源码证实。
- “角色定义”和“WebFetch 使用规则”是基于装配逻辑和官方文档的等价恢复，不是原始段落逐字回放。
