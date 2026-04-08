# Reconstructed `verify/SKILL.md`

这份文件可以高置信恢复成 `verify` skill 的主说明页。内容依据 `verify.ts` wrapper、`init-verifiers` 生成模板和 built-in verification agent 的 system prompt 整理，抓取时间为 2026-04-07。

## 1. wrapper 可直接证实的事实

当前仓库源码已经能直接确认这些行为：

- `verify.ts` 会先解析 `SKILL.md` frontmatter
- 如果 frontmatter 没有 `description`，默认描述回退为：`Verify a code change does what it should by running the app.`
- 运行时最终 prompt 由 `SKILL_BODY` 加上可选的 `## User Request` 组成
- 这个技能会随 `examples/cli.md` 与 `examples/server.md` 一起下发
- 当前实现只在 `USER_TYPE === 'ant'` 时注册

## 2. 这份 skill 的真实职责

从 wrapper、`init-verifiers` 和 verification agent prompt 三方对照，可以高置信恢复出这份技能的核心定位：

- 不是读代码后给口头判断
- 不是只跑单元测试或 typecheck
- 核心目标是通过运行应用、调用接口、操作 UI 或执行 CLI，确认改动是否真的生效

换句话说，`verify` 的重点不是“代码是否看起来对”，而是“行为是否真的被跑通”。

## 3. 高置信恢复的主体规则

### 3.1 验证思维

这份技能大概率会先建立一个与 verification agent 一致的思维模式：

- 默认假设实现可能有漏洞
- 主动寻找边界条件和失败路径
- 不能把“代码阅读”当成验证证据
- 不能把“测试套件通过”当成验证终点

### 3.2 基本执行流程

从同仓 prompt 可以恢复出一套稳定流程：

1. 先读项目文档、README、`CLAUDE.md`、变更计划或任务描述，明确成功标准。
2. 跑构建、测试、lint / typecheck，把项目基础健康状况先查清。
3. 启动与改动直接相关的程序或服务。
4. 直接执行受影响的行为路径，而不是只看源码。
5. 至少做一个对抗性探针，例如边界值、非法输入、重复调用、并发或不存在资源。
6. 把每一步都记录成可复现的 PASS / FAIL 证据。

### 3.3 不应做的事

同仓 verification agent 明确禁止修改项目，因此这份 `SKILL.md` 高概率也会强调：

- 不要在项目目录里改代码来“帮助验证通过”
- 不要把缺失依赖、环境错误或服务起不来包装成 PASS
- 不要在没有命令输出的情况下声称验证成功

### 3.4 报告格式

虽然缺失原文无法逐字恢复，但格式要求可以高置信恢复成下面这种结构：

```text
### Check: <what is being verified>
Command run:
  <exact command>
Output observed:
  <actual output>
Result: PASS | FAIL
```

最后还应有总 verdict，并明确区分：

- `PASS`：行为已实际验证且结果符合预期
- `FAIL`：行为已实际验证且结果不符合预期
- `PARTIAL`：只因环境、工具或账号等外部限制无法完成全部验证

## 4. 为什么还要附带 example 页

`verify` skill 本身只解决“验证原则”，而不会把所有执行 recipe 都写死在主体里。因此 wrapper 还带上两个 example 页：

- [examples/cli.md](./examples/cli.md)：终端 / 交互式 CLI 验证 recipe
- [examples/server.md](./examples/server.md)：dev server、Web UI、API 验证 recipe

这与 `init-verifiers` 的生成逻辑完全一致：不同应用形态要套不同的执行模板。

## 5. 置信边界

- 运行时拼装方式、默认描述、example 文件清单可以直接由源码证实。
- “验证思维”“禁止事项”“报告结构”来自同仓 verification prompt 与 `init-verifiers` 的一致约束，属于高置信恢复。
- 原始 frontmatter 文案和段落措辞仍然无法声称逐字找回。