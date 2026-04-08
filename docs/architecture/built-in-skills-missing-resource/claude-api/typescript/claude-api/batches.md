# Reconstructed `typescript/claude-api/batches.md`

这份页面可以高置信恢复成 TypeScript SDK 的 batch processing 专页。内容依据官方 README、batch examples 和生成 service 结构整理，抓取时间为 2026-04-07。

## 1. TypeScript SDK 里的 batch 入口

已知入口分成两层：

- `client.messages.batches.*`
- `client.beta.messages.batches.*`

其中 beta surface 会自动携带 `message-batches-2024-09-24` 之类的 header，用来访问尚未完全下沉到 GA 的功能。

## 2. 创建 batch

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: 'summary-1',
      params: {
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        messages: [{ role: 'user', content: 'Summarize this issue.' }],
      },
    },
  ],
})

console.log(batch.id)
```

## 3. Batch 的核心语义

从官方 examples 和生成资源可以恢复出几条关键语义：

- 每个请求都应该有稳定的 `custom_id`，方便把结果映射回业务侧任务
- create 只是提交工作，不等于立即拿到结果
- retrieve / list 用于查询状态
- cancel / delete 属于生命周期管理，而不是调用结果本身
- 结果通常通过 JSONL 流式结果集读取，而不是单个大数组一次返回

## 4. 结果读取为什么是单独页面主题

TypeScript SDK 对 batch results 的设计重点不是“再发一个普通 GET”，而是：

- 按行消费结果
- 避免大批量任务一次性载入内存
- 允许业务侧把完成结果边读边落库或继续处理

因此，缺失原文里这页大概率会强调 JSONL / incremental consumption，而不只是 create API。

## 5. 什么时候该用 batch

- 大量相互独立的离线任务
- 统一提交后异步收割结果
- 不要求交互式 latency

反过来说，聊天产品、同步 API、中间有人机确认的 tool loop，并不适合直接转成 batch。