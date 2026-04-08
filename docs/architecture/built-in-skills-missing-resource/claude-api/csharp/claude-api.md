# Reconstructed `csharp/claude-api.md`

这份页面可以高置信恢复成 C# SDK 的语言页。内容依据官方 C# SDK README、examples 和公开 provider 包整理，抓取时间为 2026-04-07。

## 1. 安装与最小调用

```bash
dotnet add package Anthropic
```

```csharp
using Anthropic;
using Anthropic.Models.Messages;

AnthropicClient client = new();

MessageCreateParams parameters = new()
{
    MaxTokens = 1024,
    Messages =
    [
        new() { Role = Role.User, Content = "Hello, Claude" },
    ],
    Model = "claude-opus-4-6",
};

var message = await client.Messages.Create(parameters);
Console.WriteLine(message);
```

官方 README 明确要求 `.NET Standard 2.0+`。

## 2. C# SDK 的风格特点

C# 版是非常标准的 .NET object model：

- `AnthropicClient client = new();`
- `MessageCreateParams` 作为 request object
- `client.Messages.Create(...)`

因此，这页原本需要说明的重点是：它不是 REST wrapper，而是带类型模型、provider 包和 streaming helpers 的正式 .NET SDK。

## 3. Streaming 与 aggregation

官方 examples 直接展示了两种流式消费方式：

- `client.Messages.CreateStreaming(parameters)` 逐事件 `await foreach`
- 对 `IAsyncEnumerable<RawMessageStreamEvent>` 调用 `Aggregate()`

此外还存在更细粒度的聚合 helper，例如：

- `MessageContentAggregator`
- `BetaMessageContentAggregator`

这说明 C# 页本来不仅要说“支持 streaming”，还要强调 SDK 已经为常见聚合场景准备好了 LINQ / async enumerable 友好的工具。

## 4. 平台后端与生态集成

公开 examples 和 provider 包还能直接确认：

- `AnthropicBedrockClient`
- `AnthropicVertexClient`
- `AnthropicFoundryClient`
- `AsIChatClient(...)` 与 `Microsoft.Extensions.AI` 集成

因此，C# 语言页大概率还会把它描述成一个既能直连 Anthropic，又能嵌入 .NET AI host abstraction 的 SDK。

## 5. 这页应当提醒的特殊点

- `Anthropic` NuGet 包在 `10+` 版本开始是 Anthropic 官方 SDK，不再是旧社区包的延续
- provider 后端各自有独立的 credentials helper 与环境变量约定
- beta surfaces 里已经能看到 hosted files、skills、更多工具与 provider-specific 扩展

这正是为什么 `claude-api` skill 会保留单独的 C# 页，而不是只让 C# 用户参考通用 HTTP 文档。