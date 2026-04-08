# Reconstructed `python/claude-api/batches.md`

这份页面可以高置信恢复成 Python SDK 语境下的 Message Batches 说明。内容依据 Anthropic 官方 Create a Message Batch 页面与 Python SDK 页面整理，抓取时间为 2026-04-07。

## 1. Message Batches 的定位

Batches API 用来一次提交多条 Messages 请求，适合不追求单次低延迟、但希望提升吞吐或把大量请求交给后台批量处理的场景。

官方明确说明：batch 创建后会立即开始处理，最长可能耗时 `24` 小时。

## 2. 基本请求结构

```json
{
  "requests": [
    {
      "custom_id": "my-custom-id-1",
      "params": {
        "model": "claude-opus-4-6",
        "max_tokens": 1024,
        "messages": [
          {"role": "user", "content": "Hello, world"}
        ]
      }
    }
  ]
}
```

每个元素都由两部分组成：

- `custom_id`: 调用方自定义标识
- `params`: 与普通 Messages API 基本相同的请求参数

## 3. Python SDK 的典型用法

Python SDK 页面直接给出：

```python
client.messages.batches.create(
    requests=[
        {
            "custom_id": "my-first-request",
            "params": {
                "model": "claude-opus-4-6",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": "Hello, world"}],
            },
        }
    ]
)
```

取结果时：

```python
result_stream = client.messages.batches.results(batch_id)
for entry in result_stream:
    if entry.result.type == "succeeded":
        print(entry.result.message.content)
```

## 4. 关键返回字段

创建 batch 后，最值得关注的字段包括：

- `id`
- `processing_status`
- `request_counts.{processing,succeeded,errored,canceled,expired}`
- `results_url`
- `created_at`
- `ended_at`
- `expires_at`

## 5. 什么时候优先选 batch

适合：

- 大量独立请求
- 对完成时间容忍较高
- 需要比单条同步请求更稳定地处理大批量工作

不适合：

- 需要即时向用户流式展示结果
- 需要逐轮 agentic tool loop
- 需要人工实时介入每一步
