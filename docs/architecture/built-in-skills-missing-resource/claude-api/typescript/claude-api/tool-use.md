# Reconstructed `typescript/claude-api/tool-use.md`

这份页面可以高置信恢复成 TypeScript SDK 的工具调用专页。内容依据官方 README、`examples/tools.ts`、`toolRunner` helper 和生成类型整理，抓取时间为 2026-04-07。

## 1. 手动 tool loop 仍然是基础模型

官方 TypeScript SDK 明确保留了最直接的“模型出 tool_use，你自己执行工具，再把 tool_result 发回去”的循环。

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const userMessage = {
  role: 'user' as const,
  content: 'What is the weather in San Francisco?',
}

const tools = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a city',
    input_schema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
      },
      required: ['location'],
    },
  },
]

const initial = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [userMessage],
  tools,
})

const toolUse = initial.content.find((block) => block.type === 'tool_use')
if (!toolUse) throw new Error('Expected tool_use')

const followUp = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    userMessage,
    { role: initial.role, content: initial.content },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'The weather in San Francisco is 72 F and sunny.',
        },
      ],
    },
  ],
  tools,
})

console.log(followUp.content)
```

## 2. 流式场景下还要处理增量输入 JSON

TypeScript SDK 的 streaming helper 不只处理文本，它也会暴露工具输入的增量 JSON。缺失文档在这一页里大概率会强调：

- 如果工具 schema 很大，模型的工具参数可能分多段产生
- 应用侧不要只盯着文本事件
- 需要在最终聚合前接受 `input_json_delta` 一类事件

这也是为什么 `shared/tool-use-concepts.md` 需要和语言页配套阅读。

## 3. 官方还提供自动 loop helper

除了手动 loop，官方 TypeScript SDK 还提供 beta helper，用来把“schema 定义 + 工具执行 + 回传 tool_result”压缩到一个更高级的抽象里。

已知的公开元素包括：

- `betaZodTool(...)`
- `client.beta.messages.toolRunner(...)`
- `max_iterations` 一类循环控制参数

这条路径的定位是：

- 手动 loop：你完全掌控消息流、权限、重试和外部副作用
- helper loop：你接受 SDK 帮你跑完整工具回路

## 4. 这页本来要解决的不是“怎么写 schema”，而是“谁负责循环”

从官方示例组织方式看，这一页的关键结论应当是：

- tool use 的核心边界不是 JSON schema，而是 tool loop 的控制权
- 如果你要做 agent、审批、审计、回放，通常应该保留手动 loop
- 如果只是把 Claude 接成一个带工具的应用助手，可以直接用官方 helper 降低样板代码

## 5. 和共享概念页的关系

- 概念层：见 [../../shared/tool-use-concepts.md](../../shared/tool-use-concepts.md)
- TypeScript 侧 streaming 细节：见 [streaming.md](./streaming.md)