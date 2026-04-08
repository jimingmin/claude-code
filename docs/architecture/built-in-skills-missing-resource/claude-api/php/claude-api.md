# Reconstructed `php/claude-api.md`

这份页面可以高置信恢复成 PHP SDK 的语言页。内容依据官方 PHP SDK README、examples 和公开类型定义整理，抓取时间为 2026-04-07。

## 1. 安装与最小调用

```bash
composer require "anthropic-ai/sdk:^0.9.0"
```

```php
<?php

use Anthropic\Client;

$client = new Client(
    apiKey: getenv('ANTHROPIC_API_KEY') ?: 'my-anthropic-api-key'
);

$message = $client->messages->create(
    maxTokens: 1024,
    messages: [['role' => 'user', 'content' => 'Hello, Claude']],
    model: 'claude-opus-4-6',
);

var_dump($message->content);
```

## 2. PHP SDK 的风格特点

官方 PHP SDK 的主要特征是：

- 主 API 以命名参数为核心
- value objects 和静态 `with(...)` 构造器大量存在
- 同时保留 array 形态，降低上手门槛

这意味着语言页本来需要告诉用户：可以先用简单数组写法入门，再逐步切到强类型 value objects。

## 3. Streaming、structured outputs 和 pagination

官方 README 与 examples 明确覆盖了：

- `messages->createStream(...)`
- 结构化输出：既支持 raw JSON Schema，也支持 PHP class / structured model
- list 型接口的自动分页：`getItems()` 与 `pagingEachItem()`

因此，这页原本不太可能只讲同步调用，而会把 streaming 和 structured outputs 一起放进“PHP 版的标准能力面”。

## 4. 错误处理是这门语言页的重要部分

官方 README 专门单列了异常模型：

- `APIConnectionException`
- `RateLimitException`
- `APIStatusException`
- 更上层的 `APIException`

这说明 PHP 页理应强调：SDK 不只是返回错误数组，而是用异常层级表达网络错误、限流和非 2xx 状态。

## 5. 平台后端与 beta 能力

公开 examples 还能直接确认：

- `Bedrock\Client::fromEnvironment()`
- `Vertex\Client::fromEnvironment(...)`
- `Foundry\Client::fromEnvironment(...)`
- `beta` namespace 下的 messages / batches / files

因此，缺失原文大概率会把 PHP 定位为“已经覆盖主流平台后端与 beta 能力的正式 SDK”，而不是一个最小社区 wrapper。