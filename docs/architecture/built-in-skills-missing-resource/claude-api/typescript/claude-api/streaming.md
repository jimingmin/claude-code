# Reconstructed `typescript/claude-api/streaming.md`

这份页面可以高置信恢复成 TypeScript SDK 的 streaming 专页。内容依据官方 README、`examples/streaming.ts` 一类示例和生成流式类型整理，抓取时间为 2026-04-07。

## 1. 两条流式路径

官方 TypeScript SDK 实际提供两种流式调用方式。

### 1.1 高层 helper：`client.messages.stream(...)`

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const stream = client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Tell me a story' }],
})

stream.on('text', (text) => process.stdout.write(text))

const finalMessage = await stream.finalMessage()
```

这条路径的重点不是“原样暴露 SSE”，而是把流式事件聚合成更适合应用侧消费的 helper API。

### 1.2 原始 SSE：`messages.create({ stream: true })`

```ts
const eventStream = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  stream: true,
  messages: [{ role: 'user', content: 'Tell me a story' }],
})

for await (const event of eventStream) {
  console.log(event.type)
}
```

这条路径更接近协议层，适合你自己接管事件分发、录制或代理转发。

## 2. `messages.stream(...)` 实际帮你做了什么

从官方 helper 设计可以恢复出它承担了几件事：

- 聚合多个 `content_block_*` 事件
- 提供文本增量级别的便捷回调
- 在流结束后通过 `finalMessage()` 返回完整 message 对象
- 在结构化输出场景下，把最终聚合后的结果继续暴露给上层解析

## 3. 什么时候用哪条路径

- 做聊天 UI、终端流式输出、实时 token 渲染：优先 `messages.stream(...)`
- 做协议代理、精细化事件持久化、需要 1:1 观察 SSE 帧：优先 `stream: true`

这正是缺失技能文档里应当强调的区别：helper 是“应用开发友好层”，原始 SSE 是“协议控制层”。

## 4. 与工具调用和结构化输出的关系

- 如果输出里包含 tool use，流里不只有文本 delta，还会出现工具输入相关事件。
- 如果你启用了结构化输出格式，最终聚合出来的 message 仍然是后续解析的基准对象。

因此，这页本来不是一个孤立主题，而是 tool use / structured outputs 的共同基础页。