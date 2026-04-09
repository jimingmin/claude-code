# 与原生 Claude Code 的能力缺口

## 1. 文档定位

这篇文档只回答一个问题：相对于 Anthropic 官方原生 Claude Code，这个仓库当前还缺哪些能力，哪些只是“有代码残留但在当前构建里不会启用”。

它不重复 [README.md](../../README.md) 里的完整能力矩阵，而是把差异按“已移除 / stub / 简化 / 被 feature flag 固定关闭”四类收口，方便判断这份 reverse-engineered 版本的边界。

## 2. 总体结论

这不是一份功能等价的官方源码，而是一份以“恢复核心 CLI 与主会话链路”为目标的裁剪版。按照 [CLAUDE.md](../../CLAUDE.md) 的约束：

- 项目明确是 reverse-engineered / decompiled 版本，目标是恢复核心能力，同时裁掉次要能力。
- `feature()` 在当前构建里被 polyfill 成始终返回 `false`，因此所有依赖 Anthropic 内部 feature flag 的能力都不会在这个构建里启用。
- 一部分模块是明确 removed，一部分模块只保留接口或 stub，一部分基础设施还在，但已经不是官方原生能力面的完整实现。

如果只看当前可用面，这个仓库更接近：

- 核心 CLI / REPL / QueryEngine / tools / MCP 主链路可运行。
- 与官方内部平台、实验开关、原生桌面/浏览器/语音/远程控制生态相关的能力大量缺失。

## 3. 明确缺失或被裁剪掉的原生能力

### 3.1 已移除或只剩残留入口

这些能力在仓库说明里被明确标成 removed，或者只剩零散残留代码，不构成当前构建中的完整产品能力：

| 能力面 | 当前状态 | 说明 |
| --- | --- | --- |
| Magic Docs | 已移除 | 官方原生的文档辅助链路不在当前构建目标内。 |
| Voice Mode | 已移除 / 不可用 | [CLAUDE.md](../../CLAUDE.md) 将其列为 removed；[README.md](../../README.md) 也说明 `VOICE_MODE` 关闭。 |
| LSP Server | 原生形态已移除 | 仓库里仍有 `services/lsp/` 和 `LSPTool` 残留，但不是默认开启、也不是官方完整能力面。 |
| Plugins Marketplace | 已移除 | 插件基础设施部分保留，但官方 Marketplace / 分发生态不在这个仓库里。 |

### 3.2 仅保留 stub 的原生能力

这类能力的接口、包名或目录结构还在，但关键实现已经被替换成空行为：

| 能力面 | 证据 | 结果 |
| --- | --- | --- |
| Computer Use / Chrome MCP | `packages/@ant/*` 下多个包是 stub | 无法提供原生的屏幕截图、鼠标键盘控制、浏览器侧桥接等能力。 |
| 原生音频捕获 | `audio-capture-napi` 是 stub | 语音输入链路没有原生底座。 |
| 原生图片处理 | `image-processor-napi` 是 stub | 与官方原生图片处理相关的能力不可用。 |
| 原生修饰键检测 | `modifiers-napi` 是 stub | 终端外设/快捷键相关的原生检测能力不完整。 |
| URL 事件集成 | `url-handler-napi` 是 stub | 深度链接、URL 回调这类原生集成能力缺底座。 |

### 3.3 仍然存在，但被简化的能力

这些模块不是完全消失，而是与官方原生形态相比明显缩水：

| 能力面 | 当前状态 | 说明 |
| --- | --- | --- |
| MCP OAuth | Simplified | 支持基础 MCP 能力，但 OAuth 链路被简化，不等价于官方托管体验。 |
| Analytics / GrowthBook / Sentry | Empty implementations | 框架入口还在，但 sink 为空，不具备官方的实验、分析和遥测闭环。 |
| Plugins runtime | 基础设施保留 | 可以看作“自托管插件框架”，不等于官方原生插件生态或 Marketplace。 |

## 4. 因 feature flag 固定关闭而不可用的能力

当前构建最重要的边界不是“源码里有没有目录”，而是 `feature()` 恒为 `false`。这意味着下面这些能力即使还有代码或文档痕迹，在当前构建里也不会被正常打开。

### 4.1 自主 Agent 与多代理扩展

| Flag | 对应能力 |
| --- | --- |
| `KAIROS` / `KAIROS_BRIEF` / `KAIROS_CHANNELS` / `KAIROS_GITHUB_WEBHOOKS` | 长期运行、自主推送、频道化通信、GitHub 事件驱动的 agent 形态 |
| `PROACTIVE` | 主动模式、定时唤醒和后台主动执行 |
| `COORDINATOR_MODE` | 多 Agent 编排调度 |
| `BUDDY` | Buddy 配对模式 |
| `FORK_SUBAGENT` | 从当前会话分叉独立子代理 |
| `AGENT_MEMORY_SNAPSHOT` | Agent 运行态记忆快照 |
| `ULTRAPLAN` | 远程协作式大规模规划 |

### 4.2 远程 / 后台 / 分布式运行面

| Flag | 对应能力 |
| --- | --- |
| `BRIDGE_MODE` | 外部客户端桥接控制 Claude Code |
| `DAEMON` | 守护进程与 supervisor / worker 形态 |
| `BG_SESSIONS` | 后台会话、`ps` / `logs` / `attach` / `kill` |
| `SSH_REMOTE` | `claude ssh <host>` 远程主机模式 |
| `DIRECT_CONNECT` | `cc://` 深链、`server` / `open` 等直连能力 |
| `CCR_REMOTE_SETUP` / `CCR_MIRROR` | 网页端远程配置与运行时镜像 |
| `UDS_INBOX` | 基于 Unix Domain Socket 的 agent 本地通信 |

### 4.3 增强工具与交互面

| Flag | 对应能力 |
| --- | --- |
| `CHICAGO_MCP` | Computer Use MCP |
| `WEB_BROWSER_TOOL` | 终端内浏览器工具 |
| `VOICE_MODE` | 原生语音输入输出 |
| `WORKFLOW_SCRIPTS` | 用户自定义工作流脚本 |
| `MCP_SKILLS` | 基于 MCP 的 Skill 装载机制 |
| `HISTORY_SNIP` | 手动历史裁剪 |

### 4.4 内部实验与官方运维能力

| Flag | 对应能力 |
| --- | --- |
| `UPLOAD_USER_SETTINGS` | 云端设置同步 |
| `TRANSCRIPT_CLASSIFIER` | 对话分类与 `auto-mode` 相关能力 |
| `EXPERIMENTAL_SKILL_SEARCH` | 实验性 Skill 搜索索引 |
| `LODESTONE` | 外部应用深度链接协议处理 |
| `ABLATION_BASELINE` / `HARD_FAIL` / `TORCH` | 内部实验或调试开关 |

## 5. 应该如何理解这些缺口

### 5.1 不要把“有目录”误判成“能力已恢复”

这个仓库里有不少目录、类型声明、命令入口和服务壳子，是为了维持主链路编译与运行，而不是表示对应产品能力已经完整恢复。判断标准应该优先看三件事：

- 是否有真实运行实现，而不是 stub。
- 是否在当前构建里能被 feature flag 打开。
- 是否还有完整的外围基础设施，而不是只剩接口层。

### 5.2 目前恢复得最好的，是核心会话主线

从当前仓库状态看，恢复重点仍然是：

- 启动与 CLI 主入口。
- QueryEngine / `query()` 主会话执行闭环。
- tools、permissions、MCP 的核心调用路径。
- 基本的模型/provider 接入与终端交互。

而官方 Claude Code 那些更依赖内部平台、灰度系统、原生宿主能力和后台运行体系的部分，当前仍然明显缺失。

## 6. 与其他文档的关系

- 如果想看完整能力矩阵，优先看 [README.md](../../README.md)。
- 如果想看当前仓库为什么会有这些缺口，直接看 [CLAUDE.md](../../CLAUDE.md) 里的运行约束和 stubbed/deleted modules 说明。
- 如果想理解当前真正恢复了哪些系统骨架，回到 [README.md](./README.md) 的架构索引，从启动、QueryEngine、capability loading、runtime modes 这些专题继续读。