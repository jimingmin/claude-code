# Reconstructed `python/claude-api/README.md`

这份页面可以高置信恢复成 Python Client SDK 的入口页。内容依据 Anthropic 官方 Python SDK 页面整理，抓取时间为 2026-04-07。

## 1. 安装与环境

```bash
pip install anthropic
```

平台集成与附加能力：

```bash
pip install anthropic[bedrock]
pip install anthropic[vertex]
pip install anthropic[aiohttp]
```

官方要求 Python `3.9+`。

## 2. 最小同步调用

```python
import os
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

message = client.messages.create(
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}],
    model="claude-opus-4-6",
)
print(message.content)
```

## 3. 异步调用

```python
import os
import asyncio
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

async def main() -> None:
    message = await client.messages.create(
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello, Claude"}],
        model="claude-opus-4-6",
    )
    print(message.content)

asyncio.run(main())
```

如果要提升 async 并发性能，官方还提供 `DefaultAioHttpClient()`。

## 4. 这页还应承担的主题

从官方 Python SDK 页面可直接恢复出，这个入口页原本至少会覆盖：

- 基本 `messages.create(...)` 调用
- async 用法
- streaming 入口
- token counting
- tool use 入口
- message batches 入口
- file uploads 入口
- error handling
- request IDs
- retries / timeouts / long requests
- auto-pagination
- raw response / streaming response body
- beta features

## 5. Python SDK 特有的实用细节

- 默认会自动重试连接错误、`408`、`409`、`429` 和 `>=500` 两次。
- 默认超时为 `10` 分钟。
- 可以用 `with_raw_response` 直接读取响应头，再 `.parse()` 成标准对象。
- 可以用 `with_streaming_response` 逐步读取响应体。
- list 型接口支持自动分页。
- `_request_id` 在官方文档里被明确标为公开字段，可用于日志和报障。

## 6. 与其它页面的关系

- 流式事件细节：见 [streaming.md](./streaming.md)
- 工具调用：见 [tool-use.md](./tool-use.md)
- Files API：见 [files-api.md](./files-api.md)
- Batches：见 [batches.md](./batches.md)
