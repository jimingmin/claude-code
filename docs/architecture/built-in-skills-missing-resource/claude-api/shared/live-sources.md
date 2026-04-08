# Reconstructed `shared/live-sources.md`

这份缺失文档更像一份“WebFetch 路由表”，作用不是存放静态知识，而是告诉技能在需要最新权威信息时应该去抓哪一页。

## 1. 适合放在这里的实时来源

| 需要确认的内容 | 官方页面 | 应获取的信息 |
| --- | --- | --- |
| 最新模型、别名、价格、上下文大小 | Models overview | 当前推荐模型、alias 与 snapshot 区分、输出上限 |
| HTTP 错误与调试 | Errors | 错误类型、`request-id`、长请求建议、流内 error 说明 |
| SSE 事件流格式 | Streaming Messages | `message_start`、`content_block_delta`、`message_stop`、tool streaming、thinking streaming |
| 文件上传 / 引用 / 下载 / 限制 | Files API | beta header、`file_id` 用法、block 类型、大小与存储限制 |
| Prompt caching 命中策略 | Prompt caching | 自动缓存、显式断点、TTL、20-block lookback、计费与 invalidation |
| Message Batches 返回字段 | Create a Message Batch | `requests[{custom_id, params}]` 形状、`processing_status`、`results_url` |
| Client SDK 语言细节 | 各语言 SDK 页面 | 安装、`messages.create(...)`、streaming、errors、pagination |
| Agent SDK 作为 Claude Code library 的用法 | Agent SDK overview | `query(...)`、内置工具、`settingSources` / `setting_sources` |

## 2. 何时应该走 WebFetch 而不是依赖内联文档

以下情况应优先抓官方页面：

- 模型 ID、价格、beta header 可能已变更。
- 用户明确要“最新 SDK 写法”。
- 需要确认区域可用性、平台集成、数据保留、ZDR 等运营性信息。
- 需要确认当前模型或工具的精确 token / pricing 常数。

## 3. 与 `claude-api` wrapper 的关系

`claudeApi.ts` 会把“何时使用 WebFetch”这一层说明拼到最终 prompt 末尾。因此这份缺失文件原本不是辅助注释，而是技能的一部分运行指导：当内联资料不够新时，模型应主动去抓官方文档，而不是继续引用过时快照。
