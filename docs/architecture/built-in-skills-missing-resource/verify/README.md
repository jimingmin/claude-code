# `verify` 缺失资源目录

这个子目录镜像 `src/skills/bundled/verify/` 下缺失的 markdown 资源路径。

源码入口：[src/skills/bundled/verify.ts](../../../src/skills/bundled/verify.ts)、[src/skills/bundled/verifyContent.ts](../../../src/skills/bundled/verifyContent.ts)

## 1. 缺失事实

当前 workspace 里不存在 `src/skills/bundled/verify/` 目录；`verifyContent.ts` 仍然引用：

- `verify/SKILL.md`
- `verify/examples/cli.md`
- `verify/examples/server.md`

结合 git 历史和公开 raw URL 检查，可以确认这三份 markdown 当前都缺失。

## 2. 运行时仍然可确认的装配逻辑

从源码可以完全确认：

- wrapper 会读取 frontmatter，提取 `description`，然后把 `SKILL_BODY` 与可选 `User Request` 拼成最终 prompt。
- `files` 字段仍然保留两个 example 页：`examples/cli.md` 与 `examples/server.md`。
- `verify` 不是“单纯执行测试命令”的别名；同仓 `init-verifiers` 与 built-in verification agent 已经说明它属于独立的功能验证工作流。

## 3. 目录导航

- [SKILL.md](./SKILL.md)
- [examples/cli.md](./examples/cli.md)
- [examples/server.md](./examples/server.md)

## 4. 置信边界

- `SKILL.md` 的行为目标、报告格式、验证原则与同仓 verification agent 高度一致，因此主规则可高置信恢复。
- 两个 example 页的“工作流配方”也可以从 `init-verifiers` 与官方文档恢复出来。
- 但原始 frontmatter 文案、示例命令模板和段落组织方式，仍然无法声称已经逐字恢复。
