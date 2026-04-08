# Claude Code 内置 Agents 与 Skills 导航

## 1. 文档拆分说明

这份页面现在只保留为导航入口，不再承载 agent / skill 正文。原先合在一起的 agent / skill 内容已经拆成独立文档：

- [built-in-agents.md](./built-in-agents.md)：只讲 built-in agents，包含注册条件、元数据和 system prompt 原始模板。
- [built-in-skills.md](./built-in-skills.md)：只讲 bundled skills，包含 prompt 原文、section 装配逻辑、`files` 提取机制，以及当前快照缺失的 markdown 资源说明。
- [built-in-skills-missing-resource/README.md](./built-in-skills-missing-resource/README.md)：只承载 `claude-api`、`verify` 这类缺失 markdown 资源的逐文件复原内容与证据。

这样拆开之后：

- prompt 文档继续只讲 prompt 分层。
- agent 文档单独讲 agent。
- skill 文档单独讲 skill。

## 2. 阅读入口

如果你的目标是：

1. 看主会话 / 工具 / Side Query / 内置命令 prompt，读 [built-in-prompts.md](./built-in-prompts.md)。
2. 看 prompt 的一页速查图，读 [built-in-prompts-quick-reference.md](./built-in-prompts-quick-reference.md)。
3. 看 prompt 的函数级调用链，读 [built-in-prompts-source-trace.md](./built-in-prompts-source-trace.md)。
4. 看 built-in agents 的原始细节，读 [built-in-agents.md](./built-in-agents.md)。
5. 看 bundled skills 的原始细节，读 [built-in-skills.md](./built-in-skills.md)。
6. 看 `claude-api` / `verify` 等缺失 markdown 资源的逐文件复原内容，读 [built-in-skills-missing-resource/README.md](./built-in-skills-missing-resource/README.md)。

## 3. 备注

当前 workspace 快照里，部分 bundled skills 通过 Bun text loader 引用的 markdown 资源文件并不在仓库快照中；[built-in-skills.md](./built-in-skills.md) 记录缺失事实与装配逻辑，[built-in-skills-missing-resource/README.md](./built-in-skills-missing-resource/README.md) 承载逐文件复原内容。