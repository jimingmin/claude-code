# Reconstructed `go/claude-api.md`

这份页面可以高置信恢复成 Go SDK 的语言页。内容依据官方 Go SDK README、examples、`tools.md` 和生成 API 文档整理，抓取时间为 2026-04-07。

## 1. 安装与最小调用

```bash
go get -u github.com/anthropics/anthropic-sdk-go@latest
```

```go
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

func main() {
	client := anthropic.NewClient(
		option.WithAPIKey(os.Getenv("ANTHROPIC_API_KEY")),
	)

	message, err := client.Messages.New(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeOpus4_6,
		MaxTokens: 1024,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock("Hello, Claude")),
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(message.Content[0].Text)
}
```

官方要求 Go `1.22+`。

## 2. Go SDK 的风格特点

Go 版不是 JSON map 优先，而是显式 params / helper functions 风格：

- `anthropic.MessageNewParams{...}`
- `anthropic.NewUserMessage(...)`
- `anthropic.NewTextBlock(...)`

这正是缺失语言页需要解释的地方：Go SDK 倾向通过类型和 helper 函数避免你手写深层 JSON。

## 3. 流式调用与聚合

官方 examples 里使用的是：

- `client.Messages.NewStreaming(...)`
- `message.Accumulate(event)`
- `betaMessage.Accumulate(event)`

这说明 Go SDK 把 streaming 明确拆成两层：

- 逐事件消费
- 一边消费一边把事件聚合回完整 message 对象

## 4. Tool use 与 tool runner

Go SDK 同时保留两条路：

- 手动 tool loop：自己解析 `ToolUseBlock`，自己回传 `ToolResultBlock`
- helper loop：用 `toolrunner.NewBetaToolFromJSONSchema(...)` 定义工具，再交给 `client.Beta.Messages.NewToolRunner(...)` 或 `NewToolRunnerStreaming(...)`

这与 TypeScript 页强调的是同一条边界：手动 loop 负责控制权，tool runner 负责减少样板代码。

## 5. Files、多模态与平台后端

Go examples 还直接证实了这些主题：

- `client.Beta.Files.Upload(...)` 支持 hosted files
- `anthropic.File(...)` 用于构造上传文件参数
- 多模态示例直接用 base64 image block
- Bedrock 通过 `bedrock.WithLoadDefaultConfig(...)`
- Vertex 通过 `vertex.WithGoogleAuth(...)`

因此，这页在原技能中的作用应当是：快速告诉 Go 用户“这个 SDK 不只是 message create，还已经覆盖 streaming、tools、files 和 provider backends”。