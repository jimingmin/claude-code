# Reconstructed `curl/examples.md`

这份页面可以高置信恢复成 `curl` 示例页。内容依据 Claude API 官方请求格式和其它语言 SDK 的等价调用面整理，抓取时间为 2026-04-07。

## 1. 最小消息调用

```bash
curl https://api.anthropic.com/v1/messages \
  --header "x-api-key: $ANTHROPIC_API_KEY" \
  --header "anthropic-version: 2023-06-01" \
  --header "content-type: application/json" \
  --data '{
    "model": "claude-opus-4-6",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, Claude"}
    ]
  }'
```

## 2. 流式输出

```bash
curl https://api.anthropic.com/v1/messages \
  --no-buffer \
  --header "x-api-key: $ANTHROPIC_API_KEY" \
  --header "anthropic-version: 2023-06-01" \
  --header "content-type: application/json" \
  --data '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {"role": "user", "content": "Stream a short poem"}
    ]
  }'
```

这里的重点不是命令本身，而是让读者知道：不用 SDK 也能直接消费 SSE，但你要自己解析 `event:` / `data:` 帧。

## 3. Tool use 的原始请求形态

```bash
curl https://api.anthropic.com/v1/messages \
  --header "x-api-key: $ANTHROPIC_API_KEY" \
  --header "anthropic-version: 2023-06-01" \
  --header "content-type: application/json" \
  --data '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "What is the weather in San Francisco?"}
    ],
    "tools": [
      {
        "name": "get_weather",
        "description": "Get the weather for a city",
        "input_schema": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          },
          "required": ["location"]
        }
      }
    ]
  }'
```

模型返回 `tool_use` 之后，后续请求要把 tool result 作为新的 user content block 发回去。这一点和各语言 SDK 的手动 tool loop 是同一套协议，只是没有 helper。

## 4. Batch 与 beta header 的角色

`curl` 示例页大概率还会承担一个教育作用：

- SDK 帮你自动加的 beta headers，在 `curl` 里都要手工写
- Files API、message batches、prompt caching 等主题，本质上都是在基础 `/v1/messages` 之上再加 header / endpoint / payload 约束

因此，`curl` 页更像“协议最小面”的对照组，方便用户理解 SDK 究竟替自己省掉了哪些样板代码。