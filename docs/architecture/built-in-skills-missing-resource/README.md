# Built-in Skills 缺失资源目录化复原

这个目录替代了原先单文件附录的承载方式。目标不是继续把 `claude-api`、`verify` 的全部缺失 markdown 复原内容堆在一个文件里，而是按原始缺失路径拆成可导航、可维护、可逐页补充的文档树。

目录结构尽量镜像原始缺失路径：

- `claude-api/` 对应 `src/skills/bundled/claude-api/`
- `verify/` 对应 `src/skills/bundled/verify/`

## 1. 复原方法

每个文件都只使用三类信息来源：

- 源码可证实：当前仓库中仍存在的 wrapper、装配函数、注释、命令与 agent 实现。
- 官方文档可回填：Anthropic 官方文档站点在 2026-04-07 可公开获取的页面。
- 不可恢复边界：原始 markdown 的逐字措辞、章节顺序，以及本仓库是否对官方文档做过本地改写。

因此，这个目录中的文件不是伪装成“已找回的原文”，而是“按缺失文件粒度整理的高置信复原版”。

## 2. `claude-api` 目录

源码入口：[src/skills/bundled/claudeApi.ts](../../src/skills/bundled/claudeApi.ts)、[src/skills/bundled/claudeApiContent.ts](../../src/skills/bundled/claudeApiContent.ts)

子目录入口：[claude-api/README.md](./claude-api/README.md)

当前已按文件拆出的复原页：

- [claude-api/SKILL.md](./claude-api/SKILL.md)
- [claude-api/shared/models.md](./claude-api/shared/models.md)
- [claude-api/shared/error-codes.md](./claude-api/shared/error-codes.md)
- [claude-api/shared/prompt-caching.md](./claude-api/shared/prompt-caching.md)
- [claude-api/shared/tool-use-concepts.md](./claude-api/shared/tool-use-concepts.md)
- [claude-api/shared/live-sources.md](./claude-api/shared/live-sources.md)
- [claude-api/python/claude-api/README.md](./claude-api/python/claude-api/README.md)
- [claude-api/python/claude-api/streaming.md](./claude-api/python/claude-api/streaming.md)
- [claude-api/python/claude-api/tool-use.md](./claude-api/python/claude-api/tool-use.md)
- [claude-api/python/claude-api/files-api.md](./claude-api/python/claude-api/files-api.md)
- [claude-api/python/claude-api/batches.md](./claude-api/python/claude-api/batches.md)
- [claude-api/python/agent-sdk/README.md](./claude-api/python/agent-sdk/README.md)
- [claude-api/python/agent-sdk/patterns.md](./claude-api/python/agent-sdk/patterns.md)
- [claude-api/typescript/claude-api/README.md](./claude-api/typescript/claude-api/README.md)
- [claude-api/typescript/claude-api/streaming.md](./claude-api/typescript/claude-api/streaming.md)
- [claude-api/typescript/claude-api/tool-use.md](./claude-api/typescript/claude-api/tool-use.md)
- [claude-api/typescript/claude-api/files-api.md](./claude-api/typescript/claude-api/files-api.md)
- [claude-api/typescript/claude-api/batches.md](./claude-api/typescript/claude-api/batches.md)
- [claude-api/typescript/agent-sdk/README.md](./claude-api/typescript/agent-sdk/README.md)
- [claude-api/typescript/agent-sdk/patterns.md](./claude-api/typescript/agent-sdk/patterns.md)
- [claude-api/go/claude-api.md](./claude-api/go/claude-api.md)
- [claude-api/ruby/claude-api.md](./claude-api/ruby/claude-api.md)
- [claude-api/php/claude-api.md](./claude-api/php/claude-api.md)
- [claude-api/java/claude-api.md](./claude-api/java/claude-api.md)
- [claude-api/csharp/claude-api.md](./claude-api/csharp/claude-api.md)
- [claude-api/curl/examples.md](./claude-api/curl/examples.md)

## 3. `verify` 目录

源码入口：[src/skills/bundled/verify.ts](../../src/skills/bundled/verify.ts)、[src/skills/bundled/verifyContent.ts](../../src/skills/bundled/verifyContent.ts)

子目录入口：[verify/README.md](./verify/README.md)

当前已按文件拆出的复原页：

- [verify/SKILL.md](./verify/SKILL.md)
- [verify/examples/cli.md](./verify/examples/cli.md)
- [verify/examples/server.md](./verify/examples/server.md)

## 4. 仍不可恢复的部分

即使目录已经按文件拆开，下面这些边界仍然存在：

- 原始 `SKILL.md` 和语言页的逐字原文仍然不存在于当前 workspace、git 历史和公开远端中。
- 某些语言页，尤其 TypeScript / Java / C#，在当前抓取环境里拿不到完整官方逐页正文，因此只能恢复高置信结构与主题，不能声称恢复了官方页全文。
- `verify` 的两个 example 页可以恢复出规则和 recipe，但不能断言原始命令模板与措辞完全一致。
