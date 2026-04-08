# Claude Code 内置 Skills

## 1. 文档目标

这份文档只梳理 bundled skills，并尽量保留**原始 prompt 细节和装配逻辑**，避免再次退化成摘要。

写法约定：

- 对于 prompt 直接写在 `.ts` 里的技能，本页直接放源码级模板。
- 对于由多个 section、schema、动态表格拼出来的技能，本页记录原始 section 常量与拼装方式。
- 对于通过 Bun text loader 引入 `.md` 文件、但当前 workspace 快照里缺失这些资源文件的技能，本页明确记录缺失事实，并保留可验证的装配代码与资源清单。
- 如果只想先从统一导航入口跳转，读 [built-in-agents-and-skills.md](./built-in-agents-and-skills.md)。
- 如果要看 `claude-api`、`verify` 这类缺失 markdown 资源的逐文件复原内容，读 [built-in-skills-missing-resource/README.md](./built-in-skills-missing-resource/README.md)。

## 2. 统一注册与装配路径

bundled skills 由 [src/skills/bundled/index.ts](../../src/skills/bundled/index.ts) 的 `initBundledSkills()` 注册，由 [src/skills/bundledSkills.ts](../../src/skills/bundledSkills.ts) 归一化成 `Command`。

### 2.1 注册表

源码原文：

```ts
export function initBundledSkills(): void {
  registerUpdateConfigSkill()
  registerKeybindingsSkill()
  registerVerifySkill()
  registerDebugSkill()
  registerLoremIpsumSkill()
  registerSkillifySkill()
  registerRememberSkill()
  registerSimplifySkill()
  registerBatchSkill()
  registerStuckSkill()
  if (feature('KAIROS') || feature('KAIROS_DREAM')) {
    const { registerDreamSkill } = require('./dream.js')
    registerDreamSkill()
  }
  if (feature('REVIEW_ARTIFACT')) {
    const { registerHunterSkill } = require('./hunter.js')
    registerHunterSkill()
  }
  if (feature('AGENT_TRIGGERS')) {
    const { registerLoopSkill } = require('./loop.js')
    registerLoopSkill()
  }
  if (feature('AGENT_TRIGGERS_REMOTE')) {
    const { registerScheduleRemoteAgentsSkill } = require('./scheduleRemoteAgents.js')
    registerScheduleRemoteAgentsSkill()
  }
  if (feature('BUILDING_CLAUDE_APPS')) {
    const { registerClaudeApiSkill } = require('./claudeApi.js')
    registerClaudeApiSkill()
  }
  if (shouldAutoEnableClaudeInChrome()) {
    registerClaudeInChromeSkill()
  }
  if (feature('RUN_SKILL_GENERATOR')) {
    const { registerRunSkillGeneratorSkill } = require('./runSkillGenerator.js')
    registerRunSkillGeneratorSkill()
  }
}
```

### 2.2 统一命令对象与 `files` 提取机制

[src/skills/bundledSkills.ts](../../src/skills/bundledSkills.ts) 的关键逻辑如下：

```ts
export function registerBundledSkill(definition: BundledSkillDefinition): void {
  const { files } = definition

  let skillRoot: string | undefined
  let getPromptForCommand = definition.getPromptForCommand

  if (files && Object.keys(files).length > 0) {
    skillRoot = getBundledSkillExtractDir(definition.name)
    let extractionPromise: Promise<string | null> | undefined
    const inner = definition.getPromptForCommand
    getPromptForCommand = async (args, ctx) => {
      extractionPromise ??= extractBundledSkillFiles(definition.name, files)
      const extractedDir = await extractionPromise
      const blocks = await inner(args, ctx)
      if (extractedDir === null) return blocks
      return prependBaseDir(blocks, extractedDir)
    }
  }

  const command: Command = {
    type: 'prompt',
    name: definition.name,
    description: definition.description,
    allowedTools: definition.allowedTools ?? [],
    whenToUse: definition.whenToUse,
    model: definition.model,
    disableModelInvocation: definition.disableModelInvocation ?? false,
    userInvocable: definition.userInvocable ?? true,
    source: 'bundled',
    loadedFrom: 'bundled',
    hooks: definition.hooks,
    skillRoot,
    context: definition.context,
    agent: definition.agent,
    isEnabled: definition.isEnabled,
    isHidden: !(definition.userInvocable ?? true),
    getPromptForCommand,
  }
  bundledSkills.push(command)
}
```

这意味着：

- 每个 bundled skill 最终都被当成 `type: 'prompt'` 的命令。
- 如果 skill 定义了 `files`，这些参考文件会被懒提取到磁盘，并在 prompt 前自动加一行 `Base directory for this skill: <dir>`。
- `verify` 这类技能虽然主 prompt 正文不在 `.ts` 文件里，但它的 `files` 机制仍然能从 wrapper 层验证到。

## 3. 当前仓库可验证到的技能清单

当前 workspace 中可直接看到的 bundled skill 源文件有：

- `batch`
- `claude-api`
- `claude-in-chrome`
- `debug`
- `keybindings-help`
- `loop`
- `lorem-ipsum`
- `remember`
- `schedule`
- `simplify`
- `skillify`
- `stuck`
- `update-config`
- `verify`

## 4. 技能逐项拆解

### 4.1 `batch`

源码入口：[src/skills/bundled/batch.ts](../../src/skills/bundled/batch.ts)

元数据：

| 字段 | 值 |
| --- | --- |
| `name` | `batch` |
| `userInvocable` | `true` |
| `disableModelInvocation` | `true` |
| `argumentHint` | `<instruction>` |
| 特殊前置条件 | 必须在 git repo 内，否则直接返回 not-a-git 文本 |

原始 worker 指令：

```text
After you finish implementing the change:
1. **Simplify** — Invoke the `SkillTool` tool with `skill: "simplify"` to review and clean up your changes.
2. **Run unit tests** — Run the project's test suite (check for package.json scripts, Makefile targets, or common commands like `npm test`, `bun test`, `pytest`, `go test`). If tests fail, fix them.
3. **Test end-to-end** — Follow the e2e test recipe from the coordinator's prompt (below). If the recipe says to skip e2e for this unit, skip it.
4. **Commit and push** — Commit all changes with a clear message, push the branch, and create a PR with `gh pr create`. Use a descriptive title. If `gh` is not available or the push fails, note it in your final message.
5. **Report** — End with a single line: `PR: <url>` so the coordinator can track it. If no PR was created, end with `PR: none — <reason>`.
```

原始 prompt 模板：

```ts
function buildPrompt(instruction: string): string {
  return `# Batch: Parallel Work Orchestration

You are orchestrating a large, parallelizable change across this codebase.

## User Instruction

${instruction}

## Phase 1: Research and Plan (Plan Mode)

Call the \`${ENTER_PLAN_MODE_TOOL_NAME}\` tool now to enter plan mode, then:

1. **Understand the scope.** Launch one or more subagents (in the foreground — you need their results) to deeply research what this instruction touches. Find all the files, patterns, and call sites that need to change. Understand the existing conventions so the migration is consistent.

2. **Decompose into independent units.** Break the work into ${MIN_AGENTS}–${MAX_AGENTS} self-contained units...

3. **Determine the e2e test recipe.** Figure out how a worker can verify its change actually works end-to-end...

4. **Write the plan.** In your plan file, include:
   - A summary of what you found during research
   - A numbered list of work units
   - The e2e test recipe
   - The exact worker instructions you will give each agent

5. Call \`${EXIT_PLAN_MODE_TOOL_NAME}\` to present the plan for approval.

## Phase 2: Spawn Workers (After Plan Approval)

Once the plan is approved, spawn one background agent per work unit using the \`${AGENT_TOOL_NAME}\` tool. **All agents must use \`isolation: "worktree"\` and \`run_in_background: true\`.**

For each agent, the prompt must be fully self-contained. Include:
- The overall goal
- This unit's specific task
- Any codebase conventions you discovered
- The e2e test recipe
- The worker instructions below, copied verbatim:

\`\`\`
${WORKER_INSTRUCTIONS}
\`\`\`

## Phase 3: Track Progress

After launching all workers, render an initial status table...
When all agents have reported, render the final table and a one-line summary.
`
}
```

### 4.2 `claude-api`

源码入口：[src/skills/bundled/claudeApi.ts](../../src/skills/bundled/claudeApi.ts)、[src/skills/bundled/claudeApiContent.ts](../../src/skills/bundled/claudeApiContent.ts)

元数据：

| 字段 | 值 |
| --- | --- |
| `name` | `claude-api` |
| `allowedTools` | `['Read', 'Grep', 'Glob', 'WebFetch']` |
| `userInvocable` | `true` |
| 启用条件 | `BUILDING_CLAUDE_APPS` feature 打开 |

触发语义（`registerClaudeApiSkill()` 原文）：

```ts
description:
  'Build apps with the Claude API or Anthropic SDK.\n' +
  'TRIGGER when: code imports `anthropic`/`@anthropic-ai/sdk`/`claude_agent_sdk`, or user asks to use Claude API, Anthropic SDKs, or Agent SDK.\n' +
  'DO NOT TRIGGER when: code imports `openai`/other AI SDK, general programming, or ML/data-science tasks.'
```

#### 原始装配逻辑

这个 skill 不是单一字符串，而是由 `SKILL_PROMPT`、语言检测结果和大量内联文档拼出来的。

语言检测规则原文：

```ts
const LANGUAGE_INDICATORS: Record<DetectedLanguage, string[]> = {
  python: ['.py', 'requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
  typescript: ['.ts', '.tsx', 'tsconfig.json', 'package.json'],
  java: ['.java', 'pom.xml', 'build.gradle'],
  go: ['.go', 'go.mod'],
  ruby: ['.rb', 'Gemfile'],
  csharp: ['.cs', '.csproj'],
  php: ['.php', 'composer.json'],
  curl: [],
}
```

模型变量：

```ts
export const SKILL_MODEL_VARS = {
  OPUS_ID: 'claude-opus-4-6',
  OPUS_NAME: 'Claude Opus 4.6',
  SONNET_ID: 'claude-sonnet-4-6',
  SONNET_NAME: 'Claude Sonnet 4.6',
  HAIKU_ID: 'claude-haiku-4-5',
  HAIKU_NAME: 'Claude Haiku 4.5',
  PREV_SONNET_ID: 'claude-sonnet-4-5',
}
```

原始阅读指南模板：

```text
## Reference Documentation

The relevant documentation for your detected language is included below in `<doc>` tags. Each tag has a `path` attribute showing its original file path. Use this to find the right section:

### Quick Task Reference

**Single text classification/summarization/extraction/Q&A:**
→ Refer to `{lang}/claude-api/README.md`

**Chat UI or real-time response display:**
→ Refer to `{lang}/claude-api/README.md` + `{lang}/claude-api/streaming.md`

**Long-running conversations (may exceed context window):**
→ Refer to `{lang}/claude-api/README.md` — see Compaction section

**Prompt caching / optimize caching / "why is my cache hit rate low":**
→ Refer to `shared/prompt-caching.md` + `{lang}/claude-api/README.md` (Prompt Caching section)

**Function calling / tool use / agents:**
→ Refer to `{lang}/claude-api/README.md` + `shared/tool-use-concepts.md` + `{lang}/claude-api/tool-use.md`

**Batch processing (non-latency-sensitive):**
→ Refer to `{lang}/claude-api/README.md` + `{lang}/claude-api/batches.md`

**File uploads across multiple requests:**
→ Refer to `{lang}/claude-api/README.md` + `{lang}/claude-api/files-api.md`

**Agent with built-in tools (file/web/terminal) (Python & TypeScript only):**
→ Refer to `{lang}/agent-sdk/README.md` + `{lang}/agent-sdk/patterns.md`

**Error handling:**
→ Refer to `shared/error-codes.md`

**Latest docs via WebFetch:**
→ Refer to `shared/live-sources.md` for URLs
```

完整装配步骤原文：

```ts
function buildPrompt(lang: DetectedLanguage | null, args: string, content: SkillContent): string {
  const cleanPrompt = processContent(content.SKILL_PROMPT, content)
  const readingGuideIdx = cleanPrompt.indexOf('## Reading Guide')
  const basePrompt =
    readingGuideIdx !== -1
      ? cleanPrompt.slice(0, readingGuideIdx).trimEnd()
      : cleanPrompt

  const parts: string[] = [basePrompt]

  if (lang) {
    const filePaths = getFilesForLanguage(lang, content)
    const readingGuide = INLINE_READING_GUIDE.replace(/\{lang\}/g, lang)
    parts.push(readingGuide)
    parts.push('---\n\n## Included Documentation\n\n' + buildInlineReference(filePaths, content))
  } else {
    parts.push(INLINE_READING_GUIDE.replace(/\{lang\}/g, 'unknown'))
    parts.push('No project language was auto-detected. Ask the user which language they are using, then refer to the matching docs below.')
    parts.push('---\n\n## Included Documentation\n\n' + buildInlineReference(Object.keys(content.SKILL_FILES), content))
  }

  const webFetchIdx = cleanPrompt.indexOf('## When to Use WebFetch')
  if (webFetchIdx !== -1) {
    parts.push(cleanPrompt.slice(webFetchIdx).trimEnd())
  }

  if (args) {
    parts.push(`## User Request\n\n${args}`)
  }

  return parts.join('\n\n')
}
```

#### 当前快照与附录

`claude-api` 的运行时代码完整，但它依赖的整套 `./claude-api/**/*.md` 资源目录在当前 snapshot 中缺失。主文档这里保留结构性结论，把证据和逐文件复原细节移到目录：[built-in-skills-missing-resource/README.md](./built-in-skills-missing-resource/README.md)。其中 `claude-api` 子树入口见 [built-in-skills-missing-resource/claude-api/README.md](./built-in-skills-missing-resource/claude-api/README.md)。

这里保留三条核心结论：

- 可以完全确认的只有装配代码、语言检测、模型变量、触发语义和 `SKILL_FILES` 清单。
- 缺失资源原本是一整套按语言和主题组织的参考手册，而不是少量提示词片段。
- 通过 Anthropic 官方 Models / Errors / Prompt caching / Tool use / Files / Batches / Client SDK / Agent SDK 文档，可以较高置信回填知识层，但不能冒充原始 markdown 原文。

### 4.3 `claude-in-chrome`

源码入口：[src/skills/bundled/claudeInChrome.ts](../../src/skills/bundled/claudeInChrome.ts)、[src/utils/claudeInChrome/prompt.ts](../../src/utils/claudeInChrome/prompt.ts)

元数据：

| 字段 | 值 |
| --- | --- |
| `name` | `claude-in-chrome` |
| `allowedTools` | 所有 `mcp__claude-in-chrome__*` browser tools |
| `userInvocable` | `true` |
| 启用条件 | `shouldAutoEnableClaudeInChrome()` |

基础 prompt 原文：

```text
# Claude in Chrome browser automation

You have access to browser automation tools (mcp__claude-in-chrome__*) for interacting with web pages in Chrome. Follow these guidelines for effective browser automation.

## GIF recording

When performing multi-step browser interactions that the user may want to review or share, use mcp__claude-in-chrome__gif_creator to record them.

You must ALWAYS:
* Capture extra frames before and after taking actions to ensure smooth playback
* Name the file meaningfully to help the user identify it later (e.g., "login_process.gif")

## Console log debugging

You can use mcp__claude-in-chrome__read_console_messages to read console output...

## Alerts and dialogs

IMPORTANT: Do not trigger JavaScript alerts, confirms, prompts, or browser modal dialogs...

## Avoid rabbit holes and loops

When using browser automation tools, stay focused on the specific task...

## Tab context and session startup

IMPORTANT: At the start of each browser automation session, call mcp__claude-in-chrome__tabs_context_mcp first...
```

激活消息原文：

```text
Now that this skill is invoked, you have access to Chrome browser automation tools. You can now use the mcp__claude-in-chrome__* tools to interact with web pages.

IMPORTANT: Start by calling mcp__claude-in-chrome__tabs_context_mcp to get information about the user's current browser tabs.
```

### 4.4 `debug`

源码入口：[src/skills/bundled/debug.ts](../../src/skills/bundled/debug.ts)

关键点：

- 非 ant 用户调用时会先 `enableDebugLogging()`。
- prompt 会注入当前 session debug log 路径、尾部若干行、settings 文件位置，以及一个 5 步调查清单。

原始 prompt 主体：

```text
# Debug Skill

Help the user debug an issue they're encountering in this current Claude Code session.

## Session Debug Log

The debug log for the current session is at: `<debugLogPath>`

<tail / read result>

For additional context, grep for [ERROR] and [WARN] lines across the full file.

## Issue Description

<args or fallback>

## Settings

Remember that settings are in:
* user - <user settings path>
* project - <project settings path>
* local - <local settings path>

## Instructions

1. Review the user's issue description
2. The last 20 lines show the debug file format. Look for [ERROR] and [WARN] entries, stack traces, and failure patterns across the file
3. Consider launching the claude-code-guide subagent to understand the relevant Claude Code features
4. Explain what you found in plain language
5. Suggest concrete fixes or next steps
```

### 4.5 `keybindings-help`

源码入口：[src/skills/bundled/keybindings.ts](../../src/skills/bundled/keybindings.ts)

元数据：

| 字段 | 值 |
| --- | --- |
| `name` | `keybindings-help` |
| `allowedTools` | `['Read']` |
| `userInvocable` | `false` |
| `isEnabled` | `isKeybindingCustomizationEnabled` |

这个 skill 不是单一 prompt，而是由多个 section 常量与运行时生成的表格拼起来。可验证的原始 section 如下。

`SECTION_INTRO`：

```text
# Keybindings Skill

Create or modify `~/.claude/keybindings.json` to customize keyboard shortcuts.

## CRITICAL: Read Before Write

**Always read `~/.claude/keybindings.json` first** (it may not exist yet). Merge changes with existing bindings — never replace the entire file.

- Use **Edit** tool for modifications to existing files
- Use **Write** tool only if the file does not exist yet
```

`SECTION_FILE_FORMAT`：

~~~~text
## File Format

```json
<FILE_FORMAT_EXAMPLE>
```

Always include the `$schema` and `$docs` fields.
~~~~

`SECTION_KEYSTROKE_SYNTAX`：

```text
## Keystroke Syntax

**Modifiers** (combine with `+`):
- `ctrl` (alias: `control`)
- `alt` (aliases: `opt`, `option`) — note: `alt` and `meta` are identical in terminals
- `shift`
- `meta` (aliases: `cmd`, `command`)

**Special keys**: `escape`/`esc`, `enter`/`return`, `tab`, `space`, `backspace`, `delete`, `up`, `down`, `left`, `right`

**Chords**: Space-separated keystrokes, e.g. `ctrl+k ctrl+s` (1-second timeout between keystrokes)

**Examples**: `ctrl+shift+p`, `alt+enter`, `ctrl+k ctrl+n`
```

`SECTION_BEHAVIORAL_RULES`：

```text
## Behavioral Rules

1. Only include contexts the user wants to change (minimal overrides)
2. Validate that actions and contexts are from the known lists below
3. Warn the user proactively if they choose a key that conflicts with reserved shortcuts or common tools like tmux (`ctrl+b`) and screen (`ctrl+a`)
4. When adding a new binding for an existing action, the new binding is additive (existing default still works unless explicitly unbound)
5. To fully replace a default binding, unbind the old key AND add the new one
```

运行时还会追加：

- `Reserved Shortcuts`，由 `NON_REBINDABLE`、`TERMINAL_RESERVED`、`MACOS_RESERVED` 动态展开。
- `Available Contexts`，由 `KEYBINDING_CONTEXTS` 与 `KEYBINDING_CONTEXT_DESCRIPTIONS` 动态展开。
- `Available Actions`，由 `KEYBINDING_ACTIONS` 和 `DEFAULT_BINDINGS` 动态展开。

### 4.6 `loop`

源码入口：[src/skills/bundled/loop.ts](../../src/skills/bundled/loop.ts)

原始 prompt 模板：

```text
# /loop — schedule a recurring prompt

Parse the input below into `[interval] <prompt…>` and schedule it with ScheduleCronTool.

## Parsing (in priority order)

1. **Leading token**: if the first whitespace-delimited token matches `^\d+[smhd]$`...
2. **Trailing "every" clause**: otherwise, if the input ends with `every <N><unit>`...
3. **Default**: otherwise, interval is `10m` and the entire input is the prompt.

If the resulting prompt is empty, show usage `/loop [interval] <prompt>` and stop — do not call ScheduleCronTool.

## Interval → cron

Supported suffixes: `s`, `m`, `h`, `d`. Convert:
- `Nm` where N ≤ 59   → `*/N * * * *`
- `Nm` where N ≥ 60   → `0 */H * * *`
- `Nh` where N ≤ 23   → `0 */N * * *`
- `Nd`                → `0 0 */N * *`
- `Ns`                → treat as `ceil(N/60)m`

If the interval doesn't cleanly divide its unit, pick the nearest clean interval and tell the user what you rounded to before scheduling.

## Action

1. Call ScheduleCronTool with `cron`, `prompt`, `recurring: true`
2. Confirm what's scheduled, the cron expression, the cadence, and the auto-expire window
3. **Then immediately execute the parsed prompt now** — don't wait for the first cron fire.
```

### 4.7 `lorem-ipsum`

源码入口：[src/skills/bundled/loremIpsum.ts](../../src/skills/bundled/loremIpsum.ts)

这个 skill **没有 prompt 模板**。它直接在实现里生成文本。

可验证的原始行为：

```ts
function generateLoremIpsum(targetTokens: number): string {
  let tokens = 0
  let result = ''

  while (tokens < targetTokens) {
    const sentenceLength = 10 + Math.floor(Math.random() * 11)
    let wordsInSentence = 0

    for (let i = 0; i < sentenceLength && tokens < targetTokens; i++) {
      const word = ONE_TOKEN_WORDS[Math.floor(Math.random() * ONE_TOKEN_WORDS.length)]
      result += word
      tokens++
      wordsInSentence++

      if (i === sentenceLength - 1 || tokens >= targetTokens) {
        result += '. '
      } else {
        result += ' '
      }
    }

    if (wordsInSentence > 0 && Math.random() < 0.2 && tokens < targetTokens) {
      result += '\n\n'
    }
  }

  return result.trim()
}
```

调用规则原文：

```ts
const parsed = parseInt(args)
if (args && (isNaN(parsed) || parsed <= 0)) {
  return 'Invalid token count...'
}
const targetTokens = parsed || 10000
const cappedTokens = Math.min(targetTokens, 500_000)
if (cappedTokens < targetTokens) {
  return `Requested ${targetTokens} tokens, but capped at 500,000 for safety.\n\n${generateLoremIpsum(cappedTokens)}`
}
return generateLoremIpsum(cappedTokens)
```

### 4.8 `remember`

源码入口：[src/skills/bundled/remember.ts](../../src/skills/bundled/remember.ts)

原始 prompt：

```text
# Memory Review

## Goal
Review the user's memory landscape and produce a clear report of proposed changes, grouped by action type. Do NOT apply changes — present proposals for user approval.

## Steps

### 1. Gather all memory layers
Read CLAUDE.md and CLAUDE.local.md from the project root (if they exist). Your auto-memory content is already in your system prompt — review it there. Note which team memory sections exist, if any.

### 2. Classify each auto-memory entry
For each substantive entry in auto-memory, determine the best destination...

### 3. Identify cleanup opportunities
Scan across all layers for duplicates, outdated entries, and conflicts.

### 4. Present the report
Output a structured report grouped by action type:
1. Promotions
2. Cleanup
3. Ambiguous
4. No action needed

## Rules
- Present ALL proposals before making any changes
- Do NOT modify files without explicit user approval
- Do NOT create new files unless the target doesn't exist yet
- Ask about ambiguous entries — don't guess
```

### 4.9 `schedule`

源码入口：[src/skills/bundled/scheduleRemoteAgents.ts](../../src/skills/bundled/scheduleRemoteAgents.ts)

元数据：

| 字段 | 值 |
| --- | --- |
| `name` | `schedule` |
| `allowedTools` | `RemoteTriggerTool`, `AskUserQuestion` |
| `userInvocable` | `true` |
| 启用条件 | `tengu_surreal_dali` + `allow_remote_sessions` policy |

这个 skill 的 prompt 不是静态字符串，而是 `buildPrompt(opts)` 基于当前用户环境动态装配。关键动态输入有：

- 用户时区。
- 已连接的 MCP connectors。
- 当前仓库 HTTPS URL。
- 可用 remote environments。
- setup notes。
- GitHub access reminder。
- 用户是否已经传入 `args`。

核心模板的关键部分原文如下：

~~~~text
# Schedule Remote Agents

You are helping the user schedule, update, list, or run **remote** Claude Code agents. These are NOT local cron jobs — each trigger spawns a fully isolated remote session (CCR) in Anthropic's cloud infrastructure on a cron schedule.

## First Step

<如果用户没传 args，则第一步必须是 AskUserQuestion；如果传了 args，则直接进入匹配 workflow>

## What You Can Do

Use the `RemoteTriggerTool` tool (load it first with `ToolSearch select:RemoteTriggerTool`; auth is handled in-process — do not use curl):

- `{action: "list"}` — list all triggers
- `{action: "get", trigger_id: "..."}` — fetch one trigger
- `{action: "create", body: {...}}` — create a trigger
- `{action: "update", trigger_id: "...", body: {...}}` — partial update
- `{action: "run", trigger_id: "..."}` — run a trigger now

You CANNOT delete triggers. If the user asks to delete, direct them to: https://claude.ai/code/scheduled

## Create body shape

```json
{
  "name": "AGENT_NAME",
  "cron_expression": "CRON_EXPR",
  "enabled": true,
  "job_config": {
    "ccr": {
      "environment_id": "ENVIRONMENT_ID",
      "session_context": {
        "model": "claude-sonnet-4-6",
        "sources": [
          {"git_repository": {"url": "https://github.com/ORG/REPO"}}
        ],
        "allowed_tools": ["Bash", "Read", "Write", "Edit", "Glob", "Grep"]
      },
      "events": [
        {"data": {
          "uuid": "<lowercase v4 uuid>",
          "session_id": "",
          "type": "user",
          "parent_tool_use_id": null,
          "message": {"content": "PROMPT_HERE", "role": "user"}
        }}
      ]
    }
  }
}
```

## Available MCP Connectors

<connectorsInfo>

## Environments

<environmentsInfo>

## Workflow

### CREATE a new trigger:
1. Understand the goal
2. Craft the prompt
3. Set the schedule
4. Choose the model
5. Validate connections
6. Review and confirm
7. Create it — then always output `https://claude.ai/code/scheduled/{TRIGGER_ID}`

### UPDATE a trigger:
1. List triggers first
2. Ask what to change
3. Show current vs proposed value
4. Confirm and update

### LIST triggers:
1. Fetch and display in a readable format
2. Show name, schedule, enabled/disabled, next run, repo(s)

### RUN NOW:
1. List triggers if needed
2. Confirm which trigger
3. Execute and confirm
~~~~

补充说明：这个 skill 还有一整套 setup checks，会在 prompt 前计算但不硬阻塞，包括：

- 当前目录是否在 git repo 里。
- 当前 GitHub repo 是否具备 remote access。
- 当前是否配置了 connectors。
- 当前是否已有 remote environment；若没有会尝试自动创建默认环境。

### 4.10 `simplify`

源码入口：[src/skills/bundled/simplify.ts](../../src/skills/bundled/simplify.ts)

原始 prompt：

```text
# Simplify: Code Review and Cleanup

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

## Phase 1: Identify Changes

Run `git diff` (or `git diff HEAD` if there are staged changes) to see what changed...

## Phase 2: Launch Three Review Agents in Parallel

Use the Agent tool to launch all three agents concurrently in a single message. Pass each agent the full diff so it has the complete context.

### Agent 1: Code Reuse Review
1. Search for existing utilities and helpers...
2. Flag any new function that duplicates existing functionality.
3. Flag any inline logic that could use an existing utility.

### Agent 2: Code Quality Review
Review the same changes for redundant state, parameter sprawl, copy-paste with slight variation, leaky abstractions, stringly-typed code, unnecessary JSX nesting, unnecessary comments.

### Agent 3: Efficiency Review
Review the same changes for unnecessary work, missed concurrency, hot-path bloat, recurring no-op updates, unnecessary existence checks, memory, overly broad operations.

## Phase 3: Fix Issues

Wait for all three agents to complete. Aggregate their findings and fix each issue directly...
```

### 4.11 `skillify`

源码入口：[src/skills/bundled/skillify.ts](../../src/skills/bundled/skillify.ts)

这个 skill 的 prompt 会注入两类运行时上下文：

- `session_memory`，来自 `getSessionMemoryContent()`。
- compact 边界之后的用户消息文本。

原始模板的关键部分如下：

~~~~text
# Skillify {{userDescriptionBlock}}

You are capturing this session's repeatable process as a reusable skill.

## Your Session Context

Here is the session memory summary:
<session_memory>
{{sessionMemory}}
</session_memory>

Here are the user's messages during this session...
<user_messages>
{{userMessages}}
</user_messages>

## Your Task

### Step 1: Analyze the Session
Before asking any questions, analyze the session to identify:
- What repeatable process was performed
- What the inputs/parameters were
- The distinct steps (in order)
- The success artifacts/criteria
- Where the user corrected or steered you
- What tools and permissions were needed
- What agents were used
- What the goals and success artifacts were

### Step 2: Interview the User
You will use the AskUserQuestion to understand what the user wants to automate...

### Step 3: Write the SKILL.md
Create the skill directory and file at the location the user chose in Round 2.

Use this format:

```markdown
---
name: {{skill-name}}
description: {{one-line description}}
allowed-tools:
  {{list of tool permission patterns observed during session}}
when_to_use: {{detailed description of when Claude should automatically invoke this skill, including trigger phrases and example user messages}}
argument-hint: "{{hint showing argument placeholders}}"
arguments:
  {{list of argument names}}
context: {{inline or fork -- omit for inline}}
---

# {{Skill Title}}
...
```

### Step 4: Confirm and Save
Before writing the file, output the complete SKILL.md content as a yaml code block in your response so the user can review it...
~~~~

### 4.12 `stuck`

源码入口：[src/skills/bundled/stuck.ts](../../src/skills/bundled/stuck.ts)

原始 prompt：

```text
# /stuck — diagnose frozen/slow Claude Code sessions

The user thinks another Claude Code session on this machine is frozen, stuck, or very slow. Investigate and post a report to #claude-code-feedback.

## What to look for

Scan for other Claude Code processes...

Signs of a stuck session:
- High CPU (≥90%) sustained
- Process state `D`
- Process state `T`
- Process state `Z`
- Very high RSS (≥4GB)
- Stuck child process

## Investigation steps

1. List all Claude Code processes
2. For anything suspicious, gather more context
3. Consider a stack dump for a truly frozen process

## Report

Only post to Slack if you actually found something stuck...
Use a two-message structure:
1. Top-level message
2. Thread reply

## Notes
- Don't kill or signal any processes — this is diagnostic only.
- If the user gave an argument, focus there first.
```

### 4.13 `update-config`

源码入口：[src/skills/bundled/updateConfig.ts](../../src/skills/bundled/updateConfig.ts)

这是当前 bundled skills 里内容最重的一类之一。它由 4 大块组成：

- `SETTINGS_EXAMPLES_DOCS`
- `HOOKS_DOCS`
- `HOOK_VERIFICATION_FLOW`
- `UPDATE_CONFIG_PROMPT`

此外还会在运行时把 `SettingsSchema()` 通过 `toJSONSchema` 转成完整 JSON Schema，并追加到 prompt 尾部。

`UPDATE_CONFIG_PROMPT` 的核心原文：

```text
# Update Config Skill

Modify Claude Code configuration by updating settings.json files.

## When Hooks Are Required (Not Memory)

If the user wants something to happen automatically in response to an EVENT, they need a **hook** configured in settings.json. Memory/preferences cannot trigger automated actions.

These require hooks:
- "Before compacting, ask me what to preserve" → PreCompact hook
- "After writing files, run prettier" → PostToolUse hook with Write|Edit matcher
- "When I run bash commands, log them" → PreToolUse hook with Bash matcher
- "Always run tests after code changes" → PostToolUse hook

## CRITICAL: Read Before Write

Always read the existing settings file before making changes. Merge new settings with existing ones - never replace the entire file.

## CRITICAL: Use AskUserQuestion for Ambiguity

When the user's request is ambiguous, use AskUserQuestion to clarify:
- Which settings file to modify
- Whether to add to existing arrays or replace them
- Specific values when multiple options exist

## Decision: Config Tool vs Direct Edit

Use the Config tool for simple settings; edit settings.json directly for hooks, complex permissions, env vars, MCP server configuration, plugin configuration.

## Workflow

1. Clarify intent
2. Read existing file
3. Merge carefully
4. Edit file
5. Confirm

## Merging Arrays (Important!)

WRONG:
{ "permissions": { "allow": ["Bash(npm:*)"] } }

RIGHT:
{
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Edit(.claude)",
      "Bash(npm:*)"
    ]
  }
}
```

`HOOK_VERIFICATION_FLOW` 的关键原文：

```text
## Constructing a Hook (with verification)

1. Dedup check.
2. Construct the command for THIS project — don't assume.
3. Pipe-test the raw command.
4. Write the JSON.
5. Validate syntax + schema in one shot.
6. Prove the hook fires.
7. Handoff.
```

`registerUpdateConfigSkill()` 的最终装配：

```ts
async getPromptForCommand(args) {
  if (args.startsWith('[hooks-only]')) {
    const req = args.slice('[hooks-only]'.length).trim()
    let prompt = HOOKS_DOCS + '\n\n' + HOOK_VERIFICATION_FLOW
    if (req) {
      prompt += `\n\n## Task\n\n${req}`
    }
    return [{ type: 'text', text: prompt }]
  }

  const jsonSchema = generateSettingsSchema()

  let prompt = UPDATE_CONFIG_PROMPT
  prompt += `\n\n## Full Settings JSON Schema\n\n\`\`\`json\n${jsonSchema}\n\`\`\``

  if (args) {
    prompt += `\n\n## User Request\n\n${args}`
  }

  return [{ type: 'text', text: prompt }]
}
```

### 4.14 `verify`

源码入口：[src/skills/bundled/verify.ts](../../src/skills/bundled/verify.ts)、[src/skills/bundled/verifyContent.ts](../../src/skills/bundled/verifyContent.ts)

元数据：

| 字段 | 值 |
| --- | --- |
| `name` | `verify` |
| `userInvocable` | `true` |
| `files` | `examples/cli.md`、`examples/server.md` |
| 额外装配 | `parseFrontmatter(SKILL_MD)` 提取 `description` |
| 启用条件 | `process.env.USER_TYPE === 'ant'` |

wrapper 原文：

```ts
const { frontmatter, content: SKILL_BODY } = parseFrontmatter(SKILL_MD)

const DESCRIPTION =
  typeof frontmatter.description === 'string'
    ? frontmatter.description
    : 'Verify a code change does what it should by running the app.'

registerBundledSkill({
  name: 'verify',
  description: DESCRIPTION,
  userInvocable: true,
  files: SKILL_FILES,
  async getPromptForCommand(args) {
    const parts: string[] = [SKILL_BODY.trimStart()]
    if (args) {
      parts.push(`## User Request\n\n${args}`)
    }
    return [{ type: 'text', text: parts.join('\n\n') }]
  },
})
```

资源装配原文：

```ts
import cliMd from './verify/examples/cli.md'
import serverMd from './verify/examples/server.md'
import skillMd from './verify/SKILL.md'

export const SKILL_MD: string = skillMd

export const SKILL_FILES: Record<string, string> = {
  'examples/cli.md': cliMd,
  'examples/server.md': serverMd,
}
```

#### 当前快照与附录

`verify` 的 wrapper 和资源清单仍在，但 `verify/SKILL.md` 与两个 example markdown 不在当前 snapshot 中。详细缺失证据、同仓代码可复原的验证生态、逐文件复原内容和不可恢复边界已移到目录：[built-in-skills-missing-resource/README.md](./built-in-skills-missing-resource/README.md)。其中 `verify` 子树入口见 [built-in-skills-missing-resource/verify/README.md](./built-in-skills-missing-resource/verify/README.md)。

这里保留三条核心结论：

- 可以完全确认的只有 wrapper、frontmatter 解析方式、资源清单和启用条件。
- 同仓代码已经足以证明 `verify` 属于“功能验证工作流”而不是单纯的测试命令别名，并与 verifier skills / verification agent 组成一套验证生态。
- Anthropic 官方文档能回填它的行为目标和验证原则，但不能恢复 `SKILL.md` 与 `examples/*.md` 的逐字正文。

## 5. 结论

从源码上看，bundled skills 可以分成三类：

- 直接把完整 prompt 写在 `.ts` 里：如 `debug`、`loop`、`remember`、`simplify`、`stuck`。
- 用多个 section / schema / 动态表格装配：如 `keybindings-help`、`update-config`、`schedule`、`skillify`。
- 通过 Bun text loader 吃 markdown 资源：如 `claude-api`、`verify`。

因此“原始细节”在这个子系统里并不总是单个 prompt 字符串；有些 skill 的“原始细节”就是它的资源清单、模板切片规则、运行时注入变量和附带参考文件提取机制。