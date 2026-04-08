# Agent 系统架构设计参考

> 基于 claude-code 代码库的架构模式分析，为"对接多 LLM/多模态模型、处理文本需求、返回代码/Markdown"的 agent 系统提炼的设计参考。

---

## 1. 系统总体框图

```mermaid
flowchart TD
    subgraph Entry["入口层"]
        API["API / SDK 入口"]
        CLI["CLI 入口"]
        Web["Web / 远端入口"]
    end

    subgraph Session["会话编排层"]
        SE["SessionEngine<br/>会话外壳"]
        TK["TurnKernel<br/>单轮执行内核"]
        SE -->|"每轮调用"| TK
    end

    subgraph Model["模型适配层"]
        Router["ModelRouter<br/>模型路由"]
        LLM1["LLM Adapter A"]
        LLM2["LLM Adapter B"]
        MM["多模态 Adapter"]
        Router --> LLM1
        Router --> LLM2
        Router --> MM
    end

    subgraph Tool["工具流水线"]
        TR["ToolRegistry<br/>注册"]
        TP["PermissionGate<br/>权限"]
        TE["ToolExecutor<br/>执行"]
        TR --> TP --> TE
    end

    subgraph Cap["能力装载"]
        Skills["Skills<br/>.md 工作流"]
        Plugins["Plugins<br/>扩展包"]
        MCP["MCP Servers<br/>外部能力"]
    end

    subgraph State["状态分层"]
        BS["BootstrapState<br/>进程级"]
        SS["SessionState<br/>会话级"]
        SM["SessionMemory<br/>摘要"]
        TS["TaskState<br/>任务级"]
    end

    subgraph Context["上下文管理"]
        PA["PromptAssembler<br/>系统提示组装"]
        AC["AutoCompactor<br/>自动压缩"]
        MR["MemoryRecall<br/>记忆召回"]
    end

    subgraph Agent["多 Agent 协调"]
        AD["AgentDefinition<br/>静态定义"]
        Coord["Coordinator<br/>协调器"]
        TM["TaskManager<br/>任务追踪"]
    end

    Entry --> SE
    TK --> Router
    TK --> Tool
    Cap --> TR
    TK --> Context
    SE --> State
    Coord --> SE
    Agent --> Tool
```

## 2. 分层架构图

```mermaid
flowchart TD
    subgraph L1["⬡ 入口层 — 协议适配，不含业务逻辑"]
        direction LR
        A1["CLI Handler"]
        A2["HTTP/API Handler"]
        A3["SDK Binding"]
    end

    subgraph L2["⬡ 会话编排层 — 系统的中枢"]
        direction LR
        B1["SessionEngine<br/>持有对话历史、跨轮状态、模型选择"]
        B2["TurnKernel<br/>驱动单轮 model→tool→recovery 循环"]
    end

    subgraph L3["⬡ 模型适配层 — 屏蔽模型差异"]
        direction LR
        C1["ModelRouter<br/>按策略选模型"]
        C2["统一 ModelAdapter 接口<br/>chat / stream / vision"]
        C3["Adapter 实例<br/>OpenAI / Claude / Gemini / 本地"]
    end

    subgraph L4["⬡ 工具与能力层 — 定义 agent 能做什么"]
        direction LR
        D1["ToolRegistry<br/>注册 + 可见性过滤"]
        D2["PermissionGate<br/>规则判定 + 模式调制"]
        D3["ToolExecutor<br/>实际调用 + 流式 + 并发"]
        D4["CapabilityLoader<br/>Skills / Plugins / MCP"]
    end

    subgraph L5["⬡ 状态与上下文层 — 记忆与延续"]
        direction LR
        E1["BootstrapState<br/>进程级不可变"]
        E2["SessionState<br/>会话级响应式"]
        E3["SessionMemory<br/>会话摘要"]
        E4["AutoCompactor<br/>+ MemoryRecall"]
    end

    subgraph L6["⬡ 协调层 — 多 Agent 调度"]
        direction LR
        F1["AgentDefinition<br/>静态能力声明"]
        F2["Coordinator<br/>主控分发 + 结果聚合"]
        F3["TaskManager<br/>pending→running→completed"]
    end

    L1 --> L2
    L2 --> L3
    L2 --> L4
    L2 --> L5
    L2 --> L6
```

## 3. 核心链路：单轮请求处理

```mermaid
sequenceDiagram
    participant User as 用户/调用方
    participant SE as SessionEngine
    participant CTX as ContextManager
    participant TK as TurnKernel
    participant MR as ModelRouter
    participant LLM as LLM Adapter
    participant TP as ToolPipeline
    participant State as SessionState

    User->>SE: 提交用户输入
    SE->>State: 追加 user message 到历史
    SE->>CTX: 请求构建本轮上下文
    CTX->>CTX: 组装 system prompt + 召回记忆 + 判断是否需压缩
    CTX-->>SE: 返回 QueryContext（messages + systemPrompt + tools）

    SE->>TK: 调用单轮内核（传入不可变 QueryContext）

    loop 模型-工具循环（直到模型不再请求工具）
        TK->>MR: 请求模型推理（携带模型偏好 / 路由策略）
        MR->>LLM: 选择合适 adapter，发起 chat/stream 请求
        LLM-->>TK: 返回 assistant message（可能含 tool_use blocks）

        alt 模型请求调用工具
            TK->>TP: 提交 tool_use 请求
            TP->>TP: 注册检查 → 权限判定 → 实际执行
            TP-->>TK: 返回 tool_result message
            TK->>TK: 将 tool_result 追加到本轮 messages
        end

        alt 遇到 token 超限
            TK->>CTX: 触发反应式压缩
            CTX-->>TK: 返回压缩后的 messages
            TK->>TK: 用压缩后上下文重试
        end
    end

    TK-->>SE: 返回本轮结果（messages + usage + terminal reason）
    SE->>State: 合并结果到会话历史 + 更新累积状态
    SE->>CTX: 触发 post-turn hooks（更新 SessionMemory 摘要）
    SE-->>User: 输出最终响应
```

## 4. 模型适配层设计

```mermaid
flowchart LR
    subgraph TurnKernel
        REQ["推理请求<br/>{messages, tools, modelHint}"]
    end

    subgraph ModelRouter["ModelRouter — 路由决策"]
        Strategy["路由策略"]
        Strategy -->|"按任务类型"| TaskRoute["代码生成 → 强模型<br/>简单问答 → 轻模型<br/>图片理解 → 多模态模型"]
        Strategy -->|"按成本/延迟"| CostRoute["fast/balanced/quality"]
        Strategy -->|"按可用性"| Fallback["主模型不可用 → fallback"]
    end

    subgraph Adapters["统一 ModelAdapter 接口"]
        direction TB
        IF["interface ModelAdapter"]
        IF --- M1["chat(params): Message"]
        IF --- M2["stream(params): AsyncIterator"]
        IF --- M3["countTokens(messages): number"]
        IF --- M4["supportsTool(): boolean"]
        IF --- M5["supportsVision(): boolean"]
    end

    subgraph Implementations["适配器实现"]
        I1["ClaudeAdapter"]
        I2["OpenAIAdapter"]
        I3["GeminiAdapter"]
        I4["LocalModelAdapter"]
    end

    REQ --> ModelRouter
    ModelRouter --> Adapters
    Adapters --> Implementations
```

```
// 伪代码：统一模型接口
interface ModelAdapter {
  id: string
  chat(params: ChatParams): Promise<AssistantMessage>
  stream(params: ChatParams): AsyncIterable<StreamChunk>
  countTokens(messages: Message[]): Promise<number>
  maxContextTokens: number
  supportsTool: boolean
  supportsVision: boolean
}

interface ChatParams {
  messages: Message[]
  systemPrompt: string
  tools?: ToolDefinition[]
  temperature?: number
  maxOutputTokens?: number
}

// 路由器只负责选择，不负责调用细节
interface ModelRouter {
  resolve(hint: ModelHint, context: RoutingContext): ModelAdapter
}
```

## 5. 工具流水线详细设计

```mermaid
flowchart TD
    subgraph Registration["第一层：注册与可见性"]
        BuiltIn["内建工具"]
        MCPTools["MCP 远程工具"]
        PluginTools["插件工具"]
        BuiltIn --> Merge["合并"]
        MCPTools --> Merge
        PluginTools --> Merge
        Merge --> Filter["可见性过滤<br/>deny 规则 / 模型能力匹配"]
        Filter --> VisibleTools["当前可见工具列表<br/>→ 写入 model prompt"]
    end

    subgraph Permission["第二层：权限判定"]
        ToolReq["模型请求 tool_use"]
        ToolReq --> InnerCheck["内层规则判定"]
        InnerCheck -->|"1. deny 规则"| D1{"命中?"}
        D1 -->|"是"| Deny["→ deny"]
        D1 -->|"否"| D2{"ask 规则命中?"}
        D2 -->|"是"| AskInner["→ ask"]
        D2 -->|"否"| D3["工具自检<br/>tool.checkPermissions()"]
        D3 --> D4{"bypass 规则?"}
        D4 -->|"是"| Allow["→ allow"]
        D4 -->|"否"| AskInner

        AskInner --> OuterMode["外层模式调制"]
        OuterMode -->|"auto 模式"| Classify["分类器判定"]
        OuterMode -->|"headless 模式"| AutoDecline["自动拒绝"]
        OuterMode -->|"interactive"| UserPrompt["弹出确认"]
    end

    subgraph Execution["第三层：执行编排"]
        Allowed["权限通过"]
        Allowed --> Exec["tool.call(context)"]
        Exec --> Stream{"支持流式?"}
        Stream -->|"是"| SE["StreamingExecutor<br/>提前执行 + 按序回放"]
        Stream -->|"否"| Sync["同步等待结果"]
        SE --> Wrap["结果包装为 tool_result message"]
        Sync --> Wrap
    end

    Filter -.->|"可见工具"| ToolReq
    Allow --> Allowed
    Classify -->|"allow"| Allowed
```

## 6. 状态分层与生命周期

```mermaid
flowchart TB
    subgraph Process["进程生命周期"]
        BS["BootstrapState<br/>━━━━━━━━━━━━━<br/>sessionId<br/>projectRoot<br/>modelConfig<br/>featureFlags<br/>━━━━━━━━━━━━━<br/>只读，进程启动时设置"]
    end

    subgraph SessionLife["会话生命周期"]
        SS["SessionState<br/>━━━━━━━━━━━━━<br/>messages: Message[]<br/>totalUsage: TokenUsage<br/>permissionMode<br/>mcpConnections<br/>activeTasks<br/>━━━━━━━━━━━━━<br/>响应式，会话期间可变"]

        SM["SessionMemory<br/>━━━━━━━━━━━━━<br/>summary: string<br/>keyFacts: string[]<br/>━━━━━━━━━━━━━<br/>每轮后更新<br/>压缩时作为恢复锚点"]
    end

    subgraph TurnLife["单轮生命周期"]
        TC["TurnContext<br/>━━━━━━━━━━━━━<br/>当前轮快照<br/>不可变传入 TurnKernel<br/>轮结束后丢弃"]
    end

    subgraph TaskLife["任务生命周期"]
        TS["TaskState<br/>━━━━━━━━━━━━━<br/>taskId<br/>status: pending→running→done<br/>agentId<br/>result<br/>━━━━━━━━━━━━━<br/>独立于会话状态<br/>多 agent 场景下尤为重要"]
    end

    subgraph Persist["跨会话持久化"]
        History["InputHistory<br/>用户输入历史"]
        LTM["LongTermMemory<br/>项目级/用户级记忆文件"]
    end

    BS -.->|"初始化"| SS
    SS -->|"快照"| TC
    TC -->|"结果合并回"| SS
    SS -->|"post-turn hook"| SM
    SS -->|"任务创建"| TS
    SS -->|"会话结束时持久化"| Persist
```

## 7. 长会话上下文管理链路

```mermaid
flowchart TD
    subgraph PreTurn["轮前准备"]
        SPA["SystemPrompt 组装<br/>（缓存 + 按需失效）"]
        MEM["记忆召回<br/>（并行预取 + 去重）"]
        TOK["Token 预算计算<br/>messages + system + tools"]
    end

    subgraph TurnExec["轮内执行"]
        Send["发送到模型"]
        Recv["接收响应"]
    end

    subgraph PostTurn["轮后处理"]
        Update["更新 SessionMemory 摘要"]
        Check["检查 token 水位"]
    end

    subgraph Compact["压缩策略"]
        Auto["自动压缩<br/>token 超过阈值时触发"]
        Reactive["反应式压缩<br/>prompt-too-long 错误时触发"]
        Auto --> Build["构建压缩边界"]
        Reactive --> Build
        Build --> Summary["生成历史摘要<br/>（利用 SessionMemory）"]
        Summary --> Replace["替换旧 messages<br/>为 [摘要 + 近期消息]"]
    end

    PreTurn --> TurnExec
    TurnExec --> PostTurn
    PostTurn -->|"水位正常"| PreTurn
    PostTurn -->|"水位告警"| Auto
    TurnExec -->|"模型拒绝：上下文过长"| Reactive
    Replace -->|"压缩后重试"| TurnExec

    style Compact fill:#fff3cd,stroke:#ffc107
```

```
// 伪代码：压缩决策
function checkCompaction(state: SessionState): CompactDecision {
  const usage = countTokens(state.messages)
  const budget = state.model.maxContextTokens

  if (usage > budget * 0.85) return { action: 'compact-now' }
  if (usage > budget * 0.70) return { action: 'compact-soon', turnsRemaining: 3 }
  return { action: 'none' }
}

function buildCompactedMessages(
  messages: Message[],
  sessionMemory: SessionMemory
): Message[] {
  const summary = sessionMemory.summary  // 已有的会话摘要
  const recentMessages = messages.slice(-N) // 保留最近 N 条
  return [
    { role: 'system', content: `[会话压缩边界] 此前的对话摘要：\n${summary}` },
    ...recentMessages
  ]
}
```

## 8. 多 Agent 协调链路

```mermaid
sequenceDiagram
    participant User as 用户
    participant Main as MainAgent<br/>(SessionEngine)
    participant Coord as Coordinator
    participant TM as TaskManager
    participant W1 as Worker Agent A
    participant W2 as Worker Agent B

    User->>Main: 复杂需求（如：重构整个模块）

    Main->>Coord: 需求超出单 agent 范围，切换为协调模式
    Coord->>Coord: 分析需求，拆分子任务

    par 并行分发
        Coord->>TM: 创建 Task A（重构文件 X）
        TM->>W1: 启动 Worker A
        Coord->>TM: 创建 Task B（重构文件 Y）
        TM->>W2: 启动 Worker B
    end

    Note over TM: Task A: running<br/>Task B: running

    W1-->>TM: Task A 完成
    Note over TM: Task A: completed<br/>Task B: running

    W2-->>TM: Task B 完成
    Note over TM: Task A: completed<br/>Task B: completed

    TM-->>Coord: 所有任务完成，汇报结果
    Coord->>Coord: 聚合结果 + 一致性检查
    Coord-->>Main: 返回综合结果
    Main-->>User: 输出最终响应
```

```mermaid
flowchart TD
    subgraph Definition["Agent 静态定义"]
        AD["AgentDefinition<br/>━━━━━━━━━━━━━<br/>name: string<br/>description: string<br/>allowedTools: string[]<br/>modelHint: ModelHint<br/>permissionMode: Mode<br/>mcpServers: string[]"]
    end

    subgraph Entry["执行入口 — 根据类型分发"]
        Sync["同步执行<br/>（简单子任务）"]
        Async["异步执行<br/>（后台长任务）"]
        InProc["进程内协作<br/>（共享状态的队友）"]
        Remote["远程执行<br/>（跨进程/跨机器）"]
    end

    subgraph Tracking["统一任务追踪"]
        Task["Task<br/>━━━━━━━━━━━━━<br/>taskId<br/>agentId<br/>status: TaskStatus<br/>input / output<br/>startTime / endTime"]
        Task --> Pending["pending"]
        Pending --> Running["running"]
        Running --> Completed["completed"]
        Running --> Failed["failed"]
        Running --> Killed["killed（超时/取消）"]
    end

    Definition -->|"实例化"| Entry
    Entry -->|"每次执行创建"| Tracking
```

## 9. 推荐实现优先级路线图

```mermaid
flowchart LR
    subgraph P1["Phase 1 — 骨架"]
        direction TB
        p1a["SessionEngine + TurnKernel<br/>双层会话编排"]
        p1b["统一 ModelAdapter 接口<br/>+ 首个 LLM 适配器"]
        p1c["Tool 接口 + 基础注册<br/>+ 同步执行"]
        p1a --- p1b --- p1c
    end

    subgraph P2["Phase 2 — 能力扩展"]
        direction TB
        p2a["ModelRouter<br/>多模型路由"]
        p2b["权限层<br/>PermissionGate"]
        p2c["Skill/Plugin 装载<br/>能力归一化"]
        p2a --- p2b --- p2c
    end

    subgraph P3["Phase 3 — 规模化"]
        direction TB
        p3a["长会话压缩<br/>AutoCompactor + SessionMemory"]
        p3b["多 Agent 协调<br/>Coordinator + TaskManager"]
        p3c["MCP 集成<br/>外部能力动态发现"]
        p3a --- p3b --- p3c
    end

    P1 -->|"可运行 MVP"| P2 -->|"生产可用"| P3
```

## 10. 关键设计原则总结

| 原则 | 来自 claude-code 的实践 | 对你系统的意义 |
|------|------------------------|---------------|
| **会话与单轮分离** | QueryEngine 持有状态，query 无状态执行 | 换模型、加重试、做压缩都不影响会话管理 |
| **工具三层流水线** | 注册（可见性）→ 权限（安全）→ 执行（实际调用） | 三个关注点独立演进，安全策略不侵入工具实现 |
| **多源能力归一化** | Skills/Plugins/MCP 各自加载，在消费点汇聚 | 不同模型看到不同工具子集成为可能 |
| **状态按生命周期分层** | 进程级/会话级/任务级/跨会话，不混在一个 store | 避免状态纠缠，各层可独立测试和持久化 |
| **上下文主动管理** | 自动压缩 + 反应式压缩 + 摘要锚点 | 文本密集型输出必须有压缩策略 |
| **Agent 定义 ≠ 执行 ≠ 追踪** | 静态定义 → 执行入口 → Task 投影 | 解耦定义和运行时，支持多种执行模式 |
| **能力是多视角的** | 同一能力对用户是 Command、对模型是 Tool、对复用是 Skill | 避免 "这到底算什么" 的分类困境 |
