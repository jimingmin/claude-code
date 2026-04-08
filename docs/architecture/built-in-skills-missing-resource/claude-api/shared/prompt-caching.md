# Reconstructed `shared/prompt-caching.md`

这份缺失文档可以高置信恢复成一份“缓存怎么放、为什么不命中、usage 字段怎么看”的实战手册。内容依据 Anthropic 官方 Prompt caching 页面整理，抓取时间为 2026-04-07。

## 1. 两种缓存模式

- 自动缓存：在请求顶层放 `cache_control`，系统自动把断点放到最后一个可缓存 block。
- 显式断点：在具体 block 上放 `cache_control`，适合静态前缀与动态后缀混合的 prompt。

```json
{
  "model": "claude-opus-4-6",
  "max_tokens": 1024,
  "cache_control": {"type": "ephemeral"},
  "system": "You are a helpful assistant.",
  "messages": [
    {"role": "user", "content": "What did I say I work on?"}
  ]
}
```

## 2. 缓存前缀的计算顺序

缓存按固定顺序覆盖整个 prefix：

1. `tools`
2. `system`
3. `messages`

这意味着 tool 定义一旦变化，后续 system 和 messages 的缓存也可能失效。

## 3. TTL、价格与阈值

- 默认 TTL 是 `5m`。
- 扩展 TTL 可以写成：

```json
{
  "cache_control": {
    "type": "ephemeral",
    "ttl": "1h"
  }
}
```

- 5 分钟 cache write 的价格是基础输入价的 `1.25x`。
- 1 小时 cache write 的价格是基础输入价的 `2x`。
- cache read 的价格是基础输入价的 `0.1x`。

最少可缓存 token 数与模型有关：

- Opus 4.6 / Opus 4.5: `4096`
- Sonnet 4.6: `2048`
- Sonnet 4.5 / Opus 4.1 / Opus 4 / Sonnet 4 / Sonnet 3.7: `1024`
- Haiku 4.5: `4096`
- Haiku 3.5 / Haiku 3: `2048`

低于阈值不会报错，但也不会真正建立缓存。

## 4. 命中规则

- 命中要求 breakpoint 之前的内容 `100% identical`。
- 系统每个 breakpoint 最多向前回看 `20` 个 block。
- 最多可以定义 `4` 个断点。
- 一个典型误用是把 breakpoint 放在“每次都变”的 block 上，例如带时间戳的 user message；这样不会产生稳定命中。
- 正确做法是把 breakpoint 放在“最后一个稳定 block”上。

## 5. 什么可以缓存

可以缓存：

- tool definitions
- system 内容
- user / assistant 文本块
- image / document block
- tool use 与 tool result block

不能直接显式缓存：

- thinking block
- citation 的 sub-content block
- 空文本块

thinking block 虽然不能直接打 `cache_control`，但在后续工具循环请求里会随上下文一起进入缓存并计费。

## 6. 如何读 usage

缓存场景下：

```text
total_input_tokens = cache_read_input_tokens + cache_creation_input_tokens + input_tokens
```

这里的 `input_tokens` 只是“最后一个断点之后”的输入，不是整次请求的总输入。

## 7. 常见失效因素

- 修改 tool definitions
- 开关 web search 或 citations
- 改变 `tool_choice`
- 修改图像输入或 thinking 参数
- 某些语言对 `tool_use.input` 的 JSON key 顺序不稳定

## 8. 官方推荐策略

- 多轮对话先用自动缓存。
- 需要精细控制时，再用 block 级断点分离 tool、system、历史上下文。
- agentic tool use、长文档问答、编码助手、多示例 prompt 都很适合缓存。
- 如果要让并发请求命中同一缓存，需要等第一条请求开始返回响应之后，再发送后续请求。

## 9. 仍不可恢复的边界

- 原始文档是否包含更多 cookbook 级案例，目前无法确认。
- 但缓存机制、TTL、价格、阈值、lookback 和 invalidation 规则已经足够高置信恢复。
