# Reconstructed `java/claude-api.md`

这份页面可以高置信恢复成 Java SDK 的语言页。内容依据官方 Java SDK README、examples 和公开后端实现整理，抓取时间为 2026-04-07。

## 1. 安装与最小调用

官方 README 给出了 Gradle 与 Maven 两种安装方式：

```kotlin
implementation("com.anthropic:anthropic-java:2.20.0")
```

```xml
<dependency>
  <groupId>com.anthropic</groupId>
  <artifactId>anthropic-java</artifactId>
  <version>2.20.0</version>
</dependency>
```

最小调用形式如下：

```java
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;

AnthropicClient client = AnthropicOkHttpClient.fromEnv();

MessageCreateParams params = MessageCreateParams.builder()
    .maxTokens(1024L)
    .addUserMessage("Hello, Claude")
    .model(Model.CLAUDE_OPUS_4_6)
    .build();

client.messages().create(params);
```

官方要求 Java `8+`。

## 2. Java SDK 的风格特点

Java 版的 API 设计明显偏 builder + immutable params：

- `AnthropicOkHttpClient.fromEnv()`
- `MessageCreateParams.builder()`
- `client.messages().create(...)`

因此，这页本来应当告诉 Java 用户：主入口不是手写 JSON，而是 builder-based request objects。

## 3. Streaming 与 accumulator

官方 examples 直接证明了这些流式能力：

- `client.messages().createStreaming(...)`
- `StreamResponse<RawMessageStreamEvent>`
- `MessageAccumulator` / `BetaMessageAccumulator`

这说明 Java SDK 和 Go 一样，都把“逐事件流式处理”和“聚合回完整 message”分成两个显式层次。

## 4. 除了 messages 之外，这页还必须覆盖什么

从 examples 和 changelog 可以恢复出：

- `countTokens(...)`
- tool use examples
- batch create / batch result streaming
- Bedrock backend
- Vertex backend
- Foundry backend

因此，这页原本的作用不会只是 hello world，而是告诉 Java 用户“官方已经提供完整平台后端和流式处理入口”。

## 5. 平台后端的公开形态

examples 明确给出了这些构造方式：

- `BedrockBackend.fromEnv()`
- `VertexBackend.builder().googleCredentials(...).region(...).project(...).build()`
- `FoundryBackend.fromEnv()`

这也说明 Java 语言页理应和 Python / TypeScript 一样，明确区分“直连 Claude API”与“经云平台后端接入”的两种运行方式。