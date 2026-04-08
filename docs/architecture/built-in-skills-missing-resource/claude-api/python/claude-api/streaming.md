# Reconstructed `python/claude-api/streaming.md`

这份页面可以高置信恢复成 Python SDK 的流式调用说明。内容依据 Anthropic 官方 Python SDK 页面与 Streaming Messages 页面整理，抓取时间为 2026-04-07。

## 1. 两种主要流式用法

### 直接拿事件迭代器

```python
client = Anthropic()
stream = client.messages.create(
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}],
    model="claude-opus-4-6",
    stream=True,
)
for event in stream:
    print(event.type)
```

### 使用 `stream()` helper 并拿最终消息对象

```python
async with client.messages.stream(
    max_tokens=1024,
    messages=[{"role": "user", "content": "Say hello there!"}],
    model="claude-opus-4-6",
) as stream:
    async for text in stream.text_stream:
        print(text, end="", flush=True)

    message = await stream.get_final_message()
    print(message.to_json())
```

## 2. SSE 生命周期

流式响应的标准顺序是：

1. `message_start`
2. 若干 content block：`content_block_start` -> `content_block_delta` -> `content_block_stop`
3. `message_delta`
4. `message_stop`

中间可能穿插任意数量的 `ping`。

## 3. `content_block_delta` 的几类常见数据

- `text_delta`: 普通文本增量
- `input_json_delta`: 工具输入的局部 JSON 片段
- `thinking_delta`: extended thinking 文本
- `signature_delta`: thinking block 结束前的签名

## 4. 工具调用流中的特殊点

当模型在流中生成 `tool_use` 时，工具参数会通过 `input_json_delta.partial_json` 一段段流出来，而不是一次性给出完整对象。因此：

- 如果自己处理底层事件，需要先积累 JSON 片段，再在 `content_block_stop` 时解析。
- 如果使用官方 SDK helper，可以直接使用 SDK 提供的累积能力，避免手写状态机。

## 5. 长请求与恢复策略

- 如果 `max_tokens` 很大，官方建议优先使用 streaming，而不是继续走非流式请求。
- Claude 4.5 及更早模型可以通过“补上已收到的 partial assistant response”续流。
- Claude 4.6 的官方建议是追加一个 user message，请模型从中断位置继续。

## 6. 这份页面在原技能中的角色

在 `claude-api` 技能的阅读指南里，这一页是“聊天 UI、实时响应显示、长请求规避超时”的核心入口。因此它不是单纯的事件枚举页，而是让模型知道什么时候必须优先给出流式方案。
