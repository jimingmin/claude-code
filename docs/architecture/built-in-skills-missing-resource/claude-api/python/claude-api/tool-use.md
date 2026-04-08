# Reconstructed `python/claude-api/tool-use.md`

这份页面可以高置信恢复成 Python SDK 下的工具调用说明。内容依据 Anthropic 官方 Python SDK 页面与 Tool use overview 页面整理，抓取时间为 2026-04-07。

## 1. 工具调用的两种层级

- 原始层：自己处理 `tool_use` / `tool_result`，手写 agent loop。
- helper 层：使用 Python SDK 提供的 `@beta_tool` 和 `tool_runner`，让 SDK 自动执行业务函数并回填结果。

## 2. 官方 helper 示例

```python
import json
from anthropic import Anthropic, beta_tool

client = Anthropic()

@beta_tool
def get_weather(location: str) -> str:
    return json.dumps(
        {
            "location": location,
            "temperature": "68°F",
            "condition": "Sunny",
        }
    )

runner = client.beta.messages.tool_runner(
    max_tokens=1024,
    model="claude-opus-4-6",
    tools=[get_weather],
    messages=[
        {"role": "user", "content": "What is the weather in SF?"},
    ],
)

for message in runner:
    print(message)
```

## 3. 这份页面要解释的核心概念

- `tools` 参数会进入上下文并参与计费。
- 如果模型决定调用本地工具，响应会停在 `stop_reason: "tool_use"`。
- 你的应用需要执行工具，再把结果作为 `tool_result` 继续发回消息接口。
- helper 的本质不是新能力，而是替你自动完成这层循环。

## 4. 什么时候该用 helper

适合用 helper 的情况：

- 工具是纯 Python 函数。
- 你希望快速构建 tool loop，而不手写消息状态机。
- 你需要更像“agent”而不是“单次请求”的交互方式。

不适合只靠 helper 的情况：

- 你需要自己严控每一步请求和计费。
- 你要把工具执行嵌进已有 orchestration 系统。
- 你要处理复杂的权限、审计、跨进程执行。

## 5. 与共享概念页的关系

语言无关的 client-vs-server tool、strict tool use、额外 token 成本，见 [../../shared/tool-use-concepts.md](../../shared/tool-use-concepts.md)。
