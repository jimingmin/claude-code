# Reconstructed `python/claude-api/files-api.md`

这份页面可以高置信恢复成 Python SDK 语境下的 Files API 说明。内容依据 Anthropic 官方 Files API 页面与 Python SDK 页面整理，抓取时间为 2026-04-07。

## 1. Files API 的基本定位

Files API 提供的是“上传一次，多次引用”的文件工作流：

- 上传文件到 Anthropic 托管存储
- 获取 `file_id`
- 在后续 Messages 请求里用 `file_id` 引用文件
- 对文件做 list / metadata / delete 管理

## 2. 必须带的 beta header

使用 Files API 需要启用：

```text
anthropic-beta: files-api-2025-04-14
```

Python SDK 里则通过 `betas=["files-api-2025-04-14"]` 打开相关功能。

## 3. Python SDK 上传示例

```python
from pathlib import Path
from anthropic import Anthropic

client = Anthropic()

client.beta.files.upload(
    file=Path("/path/to/file"),
    betas=["files-api-2025-04-14"],
)
```

官方还支持这些上传形态：

- `PathLike`
- `(filename, content, content_type)` tuple
- `BinaryIO`
- `toFile` helper 的返回值

## 4. 在消息里引用文件

官方 `document` block 形态：

```json
{
  "type": "document",
  "source": {
    "type": "file",
    "file_id": "file_011CNha8iCJcU1wXNR6q4V8w"
  },
  "title": "Document Title",
  "context": "Context about the document",
  "citations": { "enabled": true }
}
```

图像文件则用 `image` block。

## 5. 限制与下载规则

- 单文件大小上限：`500 MB`
- 组织总存储：`500 GB`
- 只有由 skills 或 code execution tool 生成的文件允许下载
- 自己上传的文件不能通过下载接口再取回

## 6. 常见错误

- `404`: `file_id` 不存在或无权限
- `400`: 文件类型与 content block 不匹配
- `400`: 文件内容超过上下文窗口可承载范围
- `413`: 文件超过 `500 MB`
- `403`: 组织存储配额已满

## 7. 这份页面在原技能中的角色

原 `claude-api` 技能把这页与语言入口页并列，用于回答“什么时候该用 file_id 引用文件，而不是把内容直接塞进 prompt”这一类问题。
