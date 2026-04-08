# Reconstructed `typescript/claude-api/files-api.md`

这份页面可以高置信恢复成 TypeScript SDK 的 Files API 专页。内容依据官方生成资源、示例和 beta files service 整理，抓取时间为 2026-04-07。

## 1. Files API 在 TypeScript SDK 里的位置

TypeScript SDK 把 hosted files 放在：

- `client.beta.files.list(...)`
- `client.beta.files.retrieveMetadata(...)`
- `client.beta.files.download(...)`
- `client.beta.files.delete(...)`
- `client.beta.files.upload(...)`

从生成资源可以直接确认，Files API 仍然是 beta surface，并且会自动带上 `files-api-2025-04-14` 这类 beta header。

## 2. 最小上传示例

```ts
import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const file = await client.beta.files.upload({
  file: fs.createReadStream('report.pdf'),
})

console.log(file.id)
```

## 3. 上传后的典型用法

Files API 的意义不是单独存储，而是让后续 beta message 请求能引用 hosted file：

```ts
await client.beta.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Summarize this PDF.' },
        {
          type: 'document',
          source: {
            type: 'file',
            file_id: file.id,
          },
        },
      ],
    },
  ],
})
```

## 4. 这一页应该强调的工程点

- 上传是 multipart/mixed file transport，而不是普通 JSON body
- 下载接口返回的是原始文件响应，适合你自己决定落盘还是转发
- list 是分页接口，不是一次性把所有 hosted files 拉回来
- delete 与 metadata retrieval 都属于文件生命周期管理的一部分

## 5. 和其它主题的关系

- 如果你只是把文档内容直接内联到消息里，这页不重要
- 如果你做长期对象存储、PDF / image 重复复用、server-side workflow，这页就成了必读项
- 与 batch 结合时，hosted file ID 可以避免在每个请求里重复传同一大对象