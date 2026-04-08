# Reconstructed `python/agent-sdk/README.md`

这份页面可以高置信恢复成 Python Claude Agent SDK 的入口页。内容依据 Anthropic 官方 Agent SDK overview 页面整理，抓取时间为 2026-04-07。

## 1. Agent SDK 的定位

Agent SDK 的核心含义是：把 Claude Code 当库来用，而不是只把 Claude 当一个裸 Messages API 模型端点来用。

与 Client SDK 相比：

- Client SDK：你自己写 tool loop。
- Agent SDK：Claude 自己处理 built-in tools、agent loop 和上下文管理。

## 2. 安装与认证

官方给出的安装方式：

```bash
npm install @anthropic-ai/claude-agent-sdk
```

以及 Python 侧包名：

```python
from claude_agent_sdk import query, ClaudeAgentOptions
```

认证方式仍然是设置 `ANTHROPIC_API_KEY`。官方也提到可以通过 Bedrock、Vertex、Azure Foundry 环境变量走第三方平台。

## 3. 最小示例

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="What files are in this directory?",
        options=ClaudeAgentOptions(allowed_tools=["Bash", "Glob"]),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

## 4. 可用能力

官方概览页明确列出 Agent SDK 暴露的 Claude Code 内置工具能力，例如：

- `Read`
- `Write`
- `Edit`
- `Bash`
- `Glob`
- `Grep`
- `WebSearch`
- `WebFetch`
- `AskUserQuestion`

## 5. Claude Code project features 的加载

如果设置：

- Python: `setting_sources=["project"]`

那么 Agent SDK 还会读取 Claude Code 的文件系统配置，包括：

- skills: `.claude/skills/*/SKILL.md`
- slash commands: `.claude/commands/*.md`
- memory: `CLAUDE.md` 或 `.claude/CLAUDE.md`
- plugins: 通过 plugins 选项提供

## 6. 这份页面在原技能中的角色

在 `claude-api` 技能的阅读指南里，这一页只对 Python 和 TypeScript 出现，说明原始缺失资源把 Agent SDK 视为独立于普通 Client SDK 的第二条集成路线。
