# Reconstructed `ruby/claude-api.md`

这份页面可以高置信恢复成 Ruby SDK 的语言页。内容依据官方 Ruby SDK README、examples 和公开类型定义整理，抓取时间为 2026-04-07。

## 1. 安装与最小调用

官方 README 给出的安装方式是把 gem 加进 `Gemfile`：

```ruby
gem "anthropic", "~> 1.28.0"
```

最小调用形式如下：

```ruby
require "bundler/setup"
require "anthropic"

anthropic = Anthropic::Client.new(
  api_key: ENV["ANTHROPIC_API_KEY"]
)

message = anthropic.messages.create(
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude" }],
  model: "claude-opus-4-6"
)

puts(message.content)
```

官方要求 Ruby `3.2+`。

## 2. Ruby SDK 的风格特点

Ruby 版的公开 API 非常符合 Ruby 生态直觉：

- `Anthropic::Client.new`
- `messages.create`
- `messages.stream`
- `messages.count_tokens`

同时，官方还为 Sorbet 用户提供了更严格的类型化 params 类，这一点在 examples 里有专门演示。

## 3. 流式 helper 很完整

Ruby examples 直接证明了这些 helper：

- `stream.each`
- `stream.text`
- `stream.accumulated_text`
- `stream.accumulated_message`

这意味着 Ruby 页本来要强调的不是“能不能流式”，而是“流式包装已经足够 Ruby-ish，不需要你自己写 SSE 解析器”。

## 4. Tool use、structured output 和 batches

官方 examples 还明确覆盖了：

- 手动 tool loop
- `client.beta.messages.tool_runner(...)` 这类自动 loop helper
- 结构化输出：`output_config: { format: OutputClass }`
- batch 结果流：`messages.batches.results_streaming(batch_id)`

因此，这页大概率承担的是 Ruby 用户的“能力地图”角色，而不是只给一个 hello world。

## 5. Files 与平台后端

从公开资源还能确认：

- `client.beta.files` 存在
- file upload 支持 IO / `Pathname`
- `Anthropic::BedrockClient.new` 与 `Anthropic::VertexClient.new` 都有官方 examples

这也解释了为什么 `claude-api` skill 会为 Ruby 保留独立页，而不是把 Ruby 视作只支持最基础能力的次要语言。