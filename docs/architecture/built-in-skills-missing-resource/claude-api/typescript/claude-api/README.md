# Reconstructed `typescript/claude-api/README.md`

这份页面可以高置信恢复成 TypeScript / JavaScript Client SDK 的入口页。内容依据 Anthropic 官方 TypeScript SDK README、示例与生成 API 参考整理，抓取时间为 2026-04-07。

## 1. 安装与环境

```bash
npm install @anthropic-ai/sdk
```

官方 README 明确把它定位为 Node.js `18+` 的官方 SDK，同时兼容 Bun、Deno 和提供 `fetch` 的 edge/runtime 环境。

如果目标不是直接调用 Claude API，而是接 Bedrock、Vertex 或 Foundry，官方 monorepo 还提供对应 provider-specific SDK 包。

## 2. 最小调用

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const message = await client.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
})

console.log(message.content)
```

## 3. 入口面

从 README、examples 和生成资源可以直接恢复出 TypeScript SDK 的主要入口：

- `client.messages.create(...)`：普通非流式调用
- `client.messages.countTokens(...)`：预估输入 token
- `client.messages.stream(...)`：高层流式包装器
- `client.messages.parse(...)`：结构化输出 helper
- `client.messages.batches.*`：batch create / list / retrieve / cancel / results
- `client.beta.messages.*`：beta-only message 能力
- `client.beta.files.*`：hosted files 上传与读取

## 4. 这页还应承担的主题

按官方文档分层，这个入口页原本至少会覆盖：

- 基本消息调用
- streaming 两种模式
- tool use 手动 loop
- structured outputs
- Files API
- Batches
- raw response / response headers
- retries / timeouts / long requests
- beta headers 与 capability discovery

## 5. TypeScript SDK 的实用细节

- 官方示例同时保留了 `messages.create({ stream: true })` 的原始 SSE 接口和 `messages.stream(...)` 的高层接口。
- `messages.parse(...)` 与结构化输出格式 helper 配套，用于把模型输出直接解析成类型化对象。
- 非流式请求的超时策略不是固定短超时；SDK 文档和源码都表明它会根据模型与 `max_tokens` 进行更保守的设置。
- SDK 还暴露了原始 `Response` / headers 读取能力，用于日志、request id、debug 和 proxy 排障。

## 6. 与其它页面的关系

- 流式事件细节：见 [streaming.md](./streaming.md)
- 工具调用：见 [tool-use.md](./tool-use.md)
- Files API：见 [files-api.md](./files-api.md)
- Batches：见 [batches.md](./batches.md)