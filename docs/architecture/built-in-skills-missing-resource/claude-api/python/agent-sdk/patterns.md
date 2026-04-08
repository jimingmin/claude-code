# Reconstructed `python/agent-sdk/patterns.md`

这份页面的官方逐页正文当前不可得，但结合 Agent SDK overview、`claude-api` 技能的阅读指南和 Claude Code 能力模型，可以高置信恢复出它应讲的模式层内容。

## 1. 什么时候用 Agent SDK，而不是 Client SDK

适合 Agent SDK：

- 你要的是“像 Claude Code 那样自主使用工具”的 agent。
- 你不想自己维护 `tool_use` / `tool_result` 循环。
- 你希望复用 Claude Code 的 skills、commands、memory、plugins 生态。

适合 Client SDK：

- 你只需要直接调用模型。
- 你要自己精确控制工具执行、权限和消息循环。
- 你需要更低层、更可审计的执行链路。

## 2. 工具范围要显式收窄

Agent SDK 不应该默认放开所有工具。最重要的模式之一，是根据任务只开放必要工具，例如：

- 搜索代码：`Read`、`Glob`、`Grep`
- 简单自动化：`Bash`、`Read`
- 文档检索：`WebFetch`、`WebSearch`

## 3. 何时启用 project settings

如果你希望 agent 读取团队约定与项目扩展能力，应打开 `setting_sources=["project"]`。这样 agent 能继承：

- 项目 skills
- slash commands
- memory
- plugins

如果你只想要一个最小、可控、不受项目本地规则影响的 agent，则不应启用这层设置源。

## 4. 模式层的真正差别

这份文件最可能强调的一点是：Agent SDK 并不是“另一个 API client”，而是“带工具、带上下文、带 Claude Code 配置语义的执行容器”。它适合自主工作流，而不是单次纯文本补全。

## 5. 仍不可恢复的边界

- 原始页面里的完整代码模式示例当前无法逐字恢复。
- 但“何时选 Agent SDK、如何收窄工具、何时打开 project settings”这三条主线已经可以高置信恢复。
