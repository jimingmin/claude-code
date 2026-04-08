# `claude-api` 缺失资源目录

这个子目录镜像 `src/skills/bundled/claude-api/` 下缺失的 markdown 资源路径。

源码入口：[src/skills/bundled/claudeApi.ts](../../../src/skills/bundled/claudeApi.ts)、[src/skills/bundled/claudeApiContent.ts](../../../src/skills/bundled/claudeApiContent.ts)

## 1. 缺失事实

当前 workspace 里不存在 `src/skills/bundled/claude-api/` 目录；`claudeApiContent.ts` 仍然通过 Bun text loader 引用了大量 `./claude-api/**/*.md` 资源。结合本地 git 历史检查和公开 raw URL 结果，可以确认这些路径不是“当前工作区漏检出”，而是当前快照里确实缺失。

## 2. 运行时仍然可确认的装配逻辑

从源码可以完全确认：

- 这个 skill 只在 Claude API / Anthropic SDK / Agent SDK 相关场景触发。
- `buildPrompt()` 会把 `SKILL_PROMPT`、语言检测结果、`INLINE_READING_GUIDE`、按语言过滤后的 `SKILL_FILES` 和 `User Request` 组装成最终 prompt。
- 整套缺失资源原本是一份按语言和主题组织的参考手册，而不是少量分散的提示词碎片。

## 3. 目录导航

### 核心入口

- [SKILL.md](./SKILL.md)
- [shared/models.md](./shared/models.md)
- [shared/error-codes.md](./shared/error-codes.md)
- [shared/prompt-caching.md](./shared/prompt-caching.md)
- [shared/tool-use-concepts.md](./shared/tool-use-concepts.md)
- [shared/live-sources.md](./shared/live-sources.md)

### Python

- [python/claude-api/README.md](./python/claude-api/README.md)
- [python/claude-api/streaming.md](./python/claude-api/streaming.md)
- [python/claude-api/tool-use.md](./python/claude-api/tool-use.md)
- [python/claude-api/files-api.md](./python/claude-api/files-api.md)
- [python/claude-api/batches.md](./python/claude-api/batches.md)
- [python/agent-sdk/README.md](./python/agent-sdk/README.md)
- [python/agent-sdk/patterns.md](./python/agent-sdk/patterns.md)

### TypeScript

- [typescript/claude-api/README.md](./typescript/claude-api/README.md)
- [typescript/claude-api/streaming.md](./typescript/claude-api/streaming.md)
- [typescript/claude-api/tool-use.md](./typescript/claude-api/tool-use.md)
- [typescript/claude-api/files-api.md](./typescript/claude-api/files-api.md)
- [typescript/claude-api/batches.md](./typescript/claude-api/batches.md)
- [typescript/agent-sdk/README.md](./typescript/agent-sdk/README.md)
- [typescript/agent-sdk/patterns.md](./typescript/agent-sdk/patterns.md)

### 其他语言与 curl

- [go/claude-api.md](./go/claude-api.md)
- [ruby/claude-api.md](./ruby/claude-api.md)
- [php/claude-api.md](./php/claude-api.md)
- [java/claude-api.md](./java/claude-api.md)
- [csharp/claude-api.md](./csharp/claude-api.md)
- [curl/examples.md](./curl/examples.md)

## 4. 置信边界

- `shared/*` 与 Python 页的可恢复度最高，因为官方文档内容最完整。
- TypeScript / Java / C# 页在当前抓取环境中缺少完整逐页正文，因此这里只给出高置信结构与已证实细节。
- 所有文件都明确区分“可直接证实的源码事实”和“依据官方文档回填的等价内容”。
