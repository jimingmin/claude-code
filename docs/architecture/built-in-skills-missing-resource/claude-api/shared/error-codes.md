# Reconstructed `shared/error-codes.md`

这份缺失文档可以高置信恢复成“错误类型 + 请求限制 + 调试建议”的组合手册。内容依据 Anthropic 官方 Errors 页面整理，抓取时间为 2026-04-07。

## 1. HTTP 错误类型

| HTTP 状态码 | `error.type` | 含义 |
| --- | --- | --- |
| `400` | `invalid_request_error` | 请求格式、参数或内容有问题 |
| `401` | `authentication_error` | API key 无效或认证失败 |
| `402` | `billing_error` | 账单或支付信息异常 |
| `403` | `permission_error` | 当前 key 对资源或功能没有权限 |
| `404` | `not_found_error` | 请求对象不存在 |
| `413` | `request_too_large` | 请求字节数超限 |
| `429` | `rate_limit_error` | 命中速率限制或加速限制 |
| `500` | `api_error` | Anthropic 内部错误 |
| `529` | `overloaded_error` | 服务暂时过载 |

## 2. 标准错误 JSON 结构

```json
{
  "type": "error",
  "error": {
    "type": "not_found_error",
    "message": "The requested resource could not be found."
  },
  "request_id": "req_011CSHoEeqs5C35K2UUqR7Fy"
}
```

## 3. 请求体大小限制

| 接口 | 限制 |
| --- | --- |
| Messages API | `32 MB` |
| Token Counting API | `32 MB` |
| Message Batches API | `256 MB` |
| Files API | `500 MB` |

## 4. 调试与恢复建议

- 所有响应都带 `request-id` header；官方 SDK 通常也会把它暴露为公开字段，例如 `_request_id`。
- 对长请求，不要默认继续走非流式调用；优先考虑 streaming 或 batches。
- SSE 流式响应即使起始 HTTP 状态是 `200`，后续 event stream 里仍可能出现 `error` 事件，因此错误处理不能只看首个 HTTP 状态。
- 如果看到 `429`，除了常规速率限制，还要考虑 acceleration limits；官方建议逐步升高流量而不是瞬时冲高。

## 5. 已公开的验证细节

Anthropic 官方还明确提到一个模型级验证约束：Claude Opus 4.6 不支持 prefilling 最后一个 assistant message。遇到这类需求时，应改用 structured outputs、system prompt 指令，或 `output_config.format`。

## 6. 仍不可恢复的边界

- 原始文档是否包含语言 SDK 异常类的逐项映射表，当前无法确认。
- 但 HTTP error taxonomy、JSON shape、request-id 与 size limits 已经可以较高置信恢复。
