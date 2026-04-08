# Reconstructed `shared/tool-use-concepts.md`

这份缺失文档可以高置信恢复成一份“Claude 的工具循环是怎么工作的”的概念说明。内容依据 Anthropic 官方 Tool use overview 页面整理，抓取时间为 2026-04-07。

## 1. 工具的两种执行位置

- client tools：Claude 只返回 `tool_use` 调用，你的应用负责实际执行，再把 `tool_result` 发回模型。
- server tools：工具在 Anthropic 侧执行；官方当前公开的典型例子有 `web_search`、`code_execution`、`web_fetch`、`tool_search`。

## 2. client tool loop 的核心语义

当 Claude 需要本地工具时，响应会停在：

- `stop_reason: "tool_use"`
- 一个或多个 `tool_use` content block

你的应用需要：

1. 解析工具名与参数。
2. 在本地执行工具。
3. 把结果作为 `tool_result` 再送回 `messages.create(...)`。

这本质上是一个 agentic loop。Client SDK 给你的是原始控制权；Agent SDK 与 Claude Code 则把这层循环封装掉。

## 3. server tool 的最小示例

```python
import anthropic

client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    tools=[{"type": "web_search_20260209", "name": "web_search"}],
    messages=[{"role": "user", "content": "What's the latest on the Mars rover?"}],
)
print(response.content)
```

## 4. strict tool use

如果需要工具调用严格匹配 schema，可以在 tool definition 上加：

```json
{"strict": true}
```

这会把“尽量接近 schema”提升为“必须严格符合 schema”。

## 5. 定价与上下文成本

工具调用的成本不仅来自普通 input/output token，还来自：

- `tools` 参数本身
- `tool_use` block
- `tool_result` block

此外，只要请求里提供了 `tools`，Anthropic 还会自动拼接一段启用工具能力的内部 system prompt。Claude 4.x 当前公布的额外 token 常数为：

- `auto` / `none`: `346` tokens
- `any` / `tool`: `313` tokens

## 6. 这份文档在原技能中的作用

当前仓库的 `claude-api` 技能把这份文档与：

- 语言入口页
- 语言专属 `tool-use.md`
- `shared/prompt-caching.md`

组合使用，说明它原本承担的是“统一工具概念底座”的角色，而不是某个单语言代码示例页。
