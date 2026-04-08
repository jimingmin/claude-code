# Reconstructed `shared/models.md`

这份缺失文档可以高置信恢复成一份“当前推荐模型与能力速查表”。内容依据 Anthropic 官方 Models overview 页面整理，抓取时间为 2026-04-07。

## 1. 当前最重要的模型档位

| 模型定位 | Claude API ID | Alias | 输入价格 | 输出价格 | 上下文窗口 | 同步最大输出 | 典型用途 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 最强推理 / 复杂 agent / 重度 coding | `claude-opus-4-6` | `claude-opus-4-6` | `$5 / MTok` | `$25 / MTok` | `1M` tokens | `128k` tokens | 复杂多步推理、重型代码生成、长上下文代理 |
| 速度与能力平衡 | `claude-sonnet-4-6` | `claude-sonnet-4-6` | `$3 / MTok` | `$15 / MTok` | `1M` tokens | `64k` tokens | 默认工程场景、通用 API 集成、较快交互 |
| 最快、成本最低 | `claude-haiku-4-5-20251001` | `claude-haiku-4-5` | `$1 / MTok` | `$5 / MTok` | `200k` tokens | `64k` tokens | 高频轻量请求、低延迟分类 / 提取 / 简答 |

## 2. 可直接恢复的模型选择规则

- Opus 4.6 适合最复杂的 coding、agent orchestration 和长上下文场景。
- Sonnet 4.6 是默认工程型平衡点，适合大多数 Claude API 集成。
- Haiku 4.5 面向更低延迟、更高吞吐和更低成本场景。
- 当前 Claude 4 系列都支持文本与图像输入、文本输出、vision 和多语言能力。
- Opus 4.6 与 Sonnet 4.6 支持 adaptive thinking；Haiku 4.5 支持 thinking，但不支持 adaptive thinking。

## 3. 与当前仓库 wrapper 的对应关系

`claudeApiContent.ts` 里的模型变量当前固定为：

- `OPUS_ID = claude-opus-4-6`
- `SONNET_ID = claude-sonnet-4-6`
- `HAIKU_ID = claude-haiku-4-5`

这说明缺失资源原本会把这些变量替换进语言页和顶层 `SKILL.md`，而不是把模型名散落硬编码在多个地方。

## 4. 程序化能力探测

如果调用方不想手写模型能力矩阵，这份文档还应该提示：可以通过 Models API 读取下列字段，而不是在客户端长期硬编码：

- `display_name`
- `max_input_tokens`
- `max_tokens`
- `capabilities`

## 5. 仍不可恢复的边界

- 原始 `shared/models.md` 是否包含完整 legacy model catalog，目前无法确认。
- 当前可恢复的是“现行模型推荐与能力速查”，不是旧版本模型的逐页全文。
