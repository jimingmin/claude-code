# Claude Code 架构设计总览

## 1. 文档目标

这份文档用于给 `src/` 建立一版可持续扩展的架构说明，优先解释主干模块的层级和责任，而不是实现细节。

本文聚焦以下内容：

- 启动装配与运行模式选择
- CLI 启动与交互入口
- 会话状态与主查询链路
- Command、Skill、Tool 三套能力组织方式
- 外部集成能力，如 API、MCP、LSP、插件、远程/桥接模式
- 历史、任务、状态、内存等支撑模块

本版文档优先覆盖“决定系统骨架”的重点模块，作为后续专题文档的目录页。像 `buddy/` 这类陪伴式或装饰性模块暂不纳入重点分析。

本文暂不展开的内容：

- `buddy/` 这类陪伴式或装饰性模块
- `voice/`、`stickers/`、部分视觉/UI 细节
- 具体工具、具体命令的实现算法
- 具体协议字段、网络报文、持久化格式

## 1.1 专题文档

在这份总览之外，当前已经补充了多篇聚焦主干模块的专题文档，建议配合阅读：

- [QueryEngine 与 query 职责边界](./query-engine-and-query.md)
- [tools、permissions、services/tools 协作关系](./tools-permissions-and-execution.md)
- [bridge、remote、server 运行模式关系](./runtime-modes.md)
- [技能、插件、MCP 如何汇聚成统一能力装载面](./capability-loading.md)
- [bootstrap/state、state、history、tasks、SessionMemory 的状态分工](./state-responsibilities.md)
- [context、memdir、compact 如何共同控制长会话上下文](./long-session-context.md)
- [tasks、coordinator、agents 如何形成多代理执行面](./multi-agent-execution.md)

## 2. 总体判断

从源码看，这个项目不是一个“单纯的 CLI”，而是一个以会话为中心的 agent 运行时。它的核心设计有四个特点：

1. `main.tsx` 和 `setup.ts` 负责把环境、权限、配置、工作目录、插件、技能、桥接等系统能力装配成一次可运行会话。
2. `QueryEngine.ts` 和 `query.ts` 组成主调度链路，负责把用户输入、系统上下文、模型输出、工具调用和会话持久化串成一个闭环。
3. `commands/`、`skills/`、`tools/` 分别面向不同的调用者：用户、工作流定义、模型执行器；三者共享同一运行时，但职责不同。
4. `services/`、`bridge/`、`remote/`、`server/`、`plugins/` 提供外部系统接入和运行模式扩展，使这个项目既能作为本地终端代理运行，也能作为 IDE、Web、远程会话和插件平台的执行核心。

## 3. 分层结构

```text
Claude Code
├── 0. 启动与装配层
│   ├── entrypoints/init.ts
│   ├── setup.ts
│   ├── bootstrap/
│   ├── utils/config*
│   ├── utils/settings/*
│   └── utils/permissions/*
├── 1. 入口与交互层
│   ├── main.tsx
│   ├── interactiveHelpers.tsx
│   ├── replLauncher.tsx
│   ├── commands.ts
│   ├── commands/
│   ├── screens/
│   ├── components/
│   └── ink/
├── 2. 会话编排层
│   ├── QueryEngine.ts
│   ├── query.ts
│   ├── query/
│   ├── context.ts
│   ├── bootstrap/
│   ├── state/
│   ├── history.ts
│   ├── Task.ts
│   ├── tasks.ts
│   ├── tasks/
│   └── memdir/
├── 3. 能力执行层
│   ├── Tool.ts
│   ├── tools.ts
│   ├── tools/
│   └── services/tools/
├── 4. 集成服务层
│   ├── services/api/
│   ├── services/mcp/
│   ├── services/compact/
│   ├── services/SessionMemory/
│   ├── services/lsp/
│   ├── services/oauth/
│   ├── services/analytics/
│   ├── services/policyLimits/
│   ├── services/remoteManagedSettings/
│   └── services/plugins/
├── 5. 扩展与运行模式层
│   ├── bridge/
│   ├── remote/
│   ├── server/
│   ├── coordinator/
│   ├── plugins/
│   └── skills/
└── 6. 基础设施与共享模块层
    ├── utils/
    ├── constants/
    ├── types/
    ├── schemas/
    ├── migrations/
    ├── context/
    └── hooks/
```

依赖方向上，整体应理解为：

- 启动与装配层负责把配置、策略、权限、网络、session 基础状态准备好。
- 上层负责会话组织和交互入口。
- 中层负责模型回合、工具调用和状态流转。
- 下层负责对外部系统的接入、约束和复用能力。
- `utils/`、`types/`、`schemas/` 等为全局共享基础设施。

## 4. 核心概念边界

| 概念 | 面向对象 | 在项目中的角色 |
| --- | --- | --- |
| Command | 用户 | 斜杠命令入口。既可以触发本地 UI/配置动作，也可以生成提示词工作流。 |
| Skill | 用户和模型 | 可复用的提示词型能力单元。来源可以是 bundled、磁盘目录、插件或 MCP。 |
| Tool | 模型 | 模型在单轮对话中可调用的执行能力，如读写文件、搜索、运行命令、调用子 agent。 |
| Plugin | 运行时扩展 | 插件是能力打包单位，可以贡献 skills、commands、hooks、MCP、LSP、agents。 |
| MCP Server | 外部系统 | 为运行时提供外部工具、资源和提示词的协议接入点。 |
| QueryEngine | 会话级调度器 | 维护单个会话的状态、消息、预算、工具上下文和持久化边界。 |

一个重要区分是：

- `commands/` 解决“用户如何进入能力”。
- `skills/` 解决“工作流提示如何被组织和复用”。
- `tools/` 解决“模型在回合中可以执行什么动作”。

## 5. 各层模块与责任

### 5.1 启动与入口层

| 模块 | 责任 |
| --- | --- |
| `entrypoints/init.ts` | 全局初始化入口。负责启用配置系统、预热网络与遥测、加载远程托管设置/策略限制、建立全局清理钩子，为后续运行模式选择准备公共前提。 |
| `main.tsx` | 顶层装配入口。解析 CLI、初始化配置和遥测、加载 commands/tools/skills/plugins，并决定启动 REPL、远程模式、桥接模式或其它运行路径。 |
| `setup.ts` | 为一次会话建立执行环境，包括 cwd、session、worktree、tmux、hooks 快照、目录与会话前置校验。 |
| `interactiveHelpers.tsx` | 统一交互式启动、Onboarding、Trust、对话框、渲染生命周期与退出收口。 |
| `replLauncher.tsx` | 将 App 容器与 REPL 屏幕拼装到 Ink 渲染树，形成交互式会话 UI。 |
| `commands.ts` 与 `commands/` | 维护斜杠命令注册表，并把 built-in commands、技能型命令、插件命令、工作流命令合并为统一命令面。 |
| `screens/`、`components/`、`ink/` | 负责终端 UI、输入输出、屏幕切换和可视反馈，但不是业务编排中心。 |

补充说明：`Command` 不是单一类型，源码中至少区分 `prompt`、`local`、`local-jsx` 三类。这意味着命令层本质上是“用户入口分发层”，而不是单纯的字符串到函数映射。

### 5.2 会话编排层

| 模块 | 责任 |
| --- | --- |
| `QueryEngine.ts` | 会话级编排核心。维护消息历史、预算、权限拒绝、文件读取缓存、上下文构建和单轮提交入口。 |
| `query.ts` 与 `query/` | 单轮查询循环核心。处理模型流式响应、工具调用、自动 compact、停止钩子、token budget 和回合恢复。 |
| `context.ts` | 构造系统上下文和用户上下文，如 git 状态、CLAUDE.md、日期等，对模型输入起到统一注入作用。 |
| `bootstrap/state.ts` | 保存跨模块共享的会话级全局状态，如 cwd、sessionId、模型设置、遥测句柄、权限与运行模式标记。 |
| `state/` | 维护交互式 UI 的 AppState Store，与 React/Ink 组件树对接，是 REPL 的前端状态中枢。 |
| `history.ts` | 负责用户输入历史和粘贴内容引用的持久化与回放，是交互体验和会话恢复的一部分。 |
| `Task.ts`、`tasks.ts`、`tasks/` | 定义后台任务抽象与任务注册表，承接本地 shell、agent、remote agent、workflow 等异步执行实体。 |
| `memdir/` | 管理长期记忆目录及其提示词注入规则，负责把 MEMORY.md 和记忆文件纳入模型工作上下文。 |

这里需要特别区分两套“记忆”机制：

- `memdir/` 面向长期、结构化、跨会话记忆注入。
- `services/SessionMemory/` 面向当前会话的自动摘要和持续更新。

### 5.3 能力执行层

| 模块 | 责任 |
| --- | --- |
| `Tool.ts` | 定义工具的统一契约，包括输入 schema、上下文、权限语义、进度回传和工具定位方式。 |
| `tools.ts` | 维护工具注册表，是“当前运行环境下有哪些工具可用”的唯一主入口之一。 |
| `tools/` | 各具体工具的实现目录，包括文件、搜索、bash、agent、skill、MCP、任务、计划模式等能力。 |
| `services/tools/` | 负责工具执行编排，包括串行/并发策略、流式工具执行、结果回灌、并发工具的顺序控制和中断控制。 |
| `hooks/useCanUseTool` 与 `utils/permissions/` | 提供工具权限判定、模式切换和危险能力收敛，是工具执行层的安全边界。 |

这一层的作用不是决定用户想做什么，而是负责“把模型提出的动作安全、可控地执行出来”。

### 5.4 集成服务层

| 模块 | 责任 |
| --- | --- |
| `services/api/` | 封装模型 API、文件 API、bootstrap 数据和重试逻辑，是外部大模型与平台接口的主接入层。 |
| `services/mcp/` | 管理 MCP server 连接、工具/资源发现、认证、超时、输出裁剪和资源读取，是外部能力接入核心。 |
| `services/compact/` | 负责上下文压缩、自动 compact、响应式 compact 等，是控制上下文窗口成本与可持续对话的关键模块。 |
| `services/SessionMemory/` | 在后台自动提炼当前会话的关键结论，写入 session memory 文件，减少长会话的信息丢失。 |
| `services/lsp/` | 管理语言服务集成，为代码导航、符号能力和插件注入的 LSP 服务提供统一入口。 |
| `services/oauth/` | 负责 OAuth 登录态与账户信息处理，是云端能力和部分受控功能的认证基础。 |
| `services/analytics/` | 承担指标、日志、feature gate、动态配置等横切能力，直接影响功能开关和观测面。 |
| `services/policyLimits/` 与 `services/remoteManagedSettings/` | 提供组织策略、远程托管设置和会话约束，使运行时受外部策略治理。 |
| `services/plugins/` | 为插件生命周期、市场、安装、同步等提供服务支撑，但真正的装载编排主要由 `utils/plugins/` 完成。 |

这层的设计目标是把“外部系统差异”压缩在服务边界内，让上层编排逻辑尽量围绕统一接口工作。

### 5.5 扩展与运行模式层

| 模块 | 责任 |
| --- | --- |
| `bridge/` | 管理与 IDE 或 Web 控制面的桥接，包括消息收发、权限回调、session 创建、poll/reconnect 和状态展示。 |
| `remote/` | 管理远程会话连接和 WebSocket 消息适配，使本地 UI 能作为远端会话的控制器或观察者。 |
| `server/` | 提供 direct-connect 这类服务端接入模式，使 CLI 能接入独立的会话服务端。 |
| `coordinator/` | 定义 coordinator mode 下的主控代理行为，用于多 worker 协作和任务分发。 |
| `plugins/` 与 `utils/plugins/` | 管理插件注册、装载、刷新和运行时注入。插件可影响命令、技能、hooks、MCP、LSP、agents。 |
| `skills/` | 管理技能来源与装载，包括 bundled skills、目录技能和 MCP skill builder，是高层工作流复用层。 |

这层说明了该项目并非只有“本地终端一种运行方式”，而是面向多入口、多运行模式、多扩展源进行统一编排。

### 5.6 基础设施与共享模块层

| 模块 | 责任 |
| --- | --- |
| `utils/` | 承担大量共享基础能力，包括配置、权限、文件系统、git、session storage、渲染、错误处理、工作树、模型参数等。 |
| `constants/` | 聚合系统常量、默认值和产品配置，是上层模块的稳定输入。 |
| `types/` | 提供跨目录共享的数据契约，降低循环依赖和模块耦合。 |
| `schemas/` | 承担配置和数据结构校验，是运行时防御式编程的一部分。 |
| `migrations/` | 处理设置和行为迁移，保证升级后兼容旧数据和旧配置。 |
| `context/`、`hooks/` | 分别承载 UI/运行时上下文与钩子机制，是横向连接不同层的重要桥梁。 |

## 6. 关键运行链路

### 6.1 启动装配链路

1. `entrypoints/init.ts` 先完成全局初始化，包括配置、策略、网络、遥测、代理和清理钩子。
2. `main.tsx` 解析 CLI 参数，收集 model、permission、session、remote/bridge 等运行条件。
3. `main.tsx` 汇总 commands、tools、skills、plugins、MCP 等注册面，并决定当前运行模式。
4. `setup.ts` 建立本次会话的执行环境，处理 cwd、worktree、tmux、hooks 快照和 session 上下文。
5. 交互式模式下，`interactiveHelpers.tsx`、`replLauncher.tsx`、`state/` 建立 UI；非交互式或远程模式则转入对应执行入口。

### 6.2 会话查询链路

1. 用户输入、slash command、SDK 输入或远程消息进入会话运行时。
2. `QueryEngine.ts` 负责聚合 messages、commands、tools、memory、MCP clients、预算和权限上下文。
3. `context.ts`、`memdir/` 等模块补齐系统上下文、仓库上下文和长期记忆。
4. `query.ts` 驱动单轮模型循环，处理流式响应、工具请求、compact、重试、停止钩子与恢复。
5. `services/tools/` 调度具体工具执行；本地工具由 `tools/` 承接，外部工具则继续委托给 `services/mcp/`、`services/api/`、`services/lsp/` 等服务。
6. 结果回写到 `bootstrap/state.ts`、`state/`、`history.ts`、`tasks/`、`services/SessionMemory/` 等模块，形成下一轮输入基础。

### 6.3 能力装载链路

1. 内建 command、tool、skill 在启动时先注册，构成最小可运行能力面。
2. `skills/loadSkillsDir.ts` 从项目目录、用户目录、托管目录等来源装载文件型 skills 和 prompt 型 commands。
3. `utils/plugins/pluginLoader.ts` 负责发现和装载插件，并把 plugin command、skill、hook、agent 等能力注入运行时。
4. `services/mcp/client.ts` 连接外部 MCP server，把外部 tools、resources、prompts 映射到统一运行时视图。

这个链路说明：项目真正的中心不是单个 UI 组件或单个工具，而是“会话编排循环 + 统一能力装载面”。

## 7. 重点模块关系

### 7.1 Command、Skill、Tool、Plugin 的关系

- Command 是用户入口。
- Skill 是高层工作流定义，通常表现为 prompt 型 command。
- Tool 是模型在回合内部真正调用的执行单元。
- Plugin 是打包和分发单位，可以同时向 command、skill、hook、MCP、LSP、agent 这些面注入内容。

换句话说：

- 用户通常先接触 `Command`。
- 模型在执行过程中主要接触 `Tool`。
- 团队复用工作流时主要组织 `Skill`。
- 系统扩展和生态接入主要通过 `Plugin` 和 `MCP`。

### 7.2 本地能力与外部能力的统一方式

- 本地工具通过 `tools.ts` 注册。
- 外部能力通过 `services/mcp/` 接入后，也会被映射进统一的工具/资源视图。
- `QueryEngine.ts` 和 `query.ts` 不需要理解每个外部系统的具体协议，它们只需要面向统一工具上下文工作。

### 7.3 交互式状态与会话级状态的区分

- `bootstrap/state.ts` 偏向全局、会话级、跨模块共享状态。
- `state/` 偏向交互式 UI 的响应式状态。
- 二者共同服务同一会话，但关注点不同：前者偏运行时内核，后者偏 REPL 表现层。

### 7.4 运行模式的分工

| 运行模式 | 主模块 | 责任 |
| --- | --- | --- |
| 本地交互式模式 | `main.tsx`、`interactiveHelpers.tsx`、`replLauncher.tsx` | 标准终端 REPL，会话由本地 UI 驱动。 |
| Bridge 模式 | `bridge/bridgeMain.ts` | 把 CLI 作为被外部控制面的执行引擎，负责轮询、session 生成、权限回调和状态同步。 |
| Remote 模式 | `remote/RemoteSessionManager.ts` | 作为远端会话的客户端或观察者，通过 WebSocket/HTTP 与远端 session 保持同步。 |
| Direct-connect / Server 模式 | `server/` | 让 CLI 接入独立的会话服务端，而不是只在本地直接执行业务循环。 |
| Coordinator 模式 | `coordinator/` | 在多 worker 或多 agent 协作场景下承担主控与任务分发职责。 |

这些模式共享同一套核心会话编排层，但入口、控制权和权限交互方式不同。

## 8. 横切设计点

这些不是单独一层，但会贯穿几乎所有重点模块：

| 横切点 | 说明 |
| --- | --- |
| Feature flags | 大量模块通过 `bun:bundle` 的 `feature(...)` 做裁剪和条件装配，说明该项目天然支持多发行形态和实验功能切换。 |
| Trust 与权限 | Trust dialog、工具权限、MCP server 审批、bypass/auto/plan 模式共同构成安全边界。 |
| Registry 驱动 | commands、tools、tasks、skills、plugins 都采用注册表式装配，利于扩展但也要求清晰的边界管理。 |
| 持久化与恢复 | history、session storage、session memory、memory dir、插件缓存共同支撑长会话和恢复能力。 |

## 9. 当前专题目录

当前已经完成的专题如下：

1. 已完成：[QueryEngine 与 query 职责边界](./query-engine-and-query.md)。
2. 已完成：[tools、permissions、services/tools 协作关系](./tools-permissions-and-execution.md)。
3. 已完成：[bridge、remote、server 运行模式关系](./runtime-modes.md)。
4. 已完成：[技能、插件、MCP 如何汇聚成统一能力装载面](./capability-loading.md)。
5. 已完成：[bootstrap/state、state、history、tasks、SessionMemory 的状态分工](./state-responsibilities.md)。
6. 已完成：[context、memdir、compact 如何共同控制长会话上下文](./long-session-context.md)。
7. 已完成：[tasks、coordinator、agents 如何形成多代理执行面](./multi-agent-execution.md)。

## 10. 非重点范围说明

为保持架构主线清晰，当前版本不把以下内容作为重点模块展开：

- `buddy/` 及其衍生的 companion 表现层能力。
- 纯展示型终端 UI 细节和主题样式实现。
- 单个命令、单个工具、单个技能的具体 prompt 或交互细节。
- 面向内部实验、演示或特定发布渠道的边缘功能开关。

这并不表示这些模块不重要，而是当前文档优先覆盖“决定系统骨架”的部分。