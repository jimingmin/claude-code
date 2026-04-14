import { createHash } from 'crypto'
import { appendFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'

import {
  getMainThreadAgentType,
  getSessionId,
} from '../bootstrap/state.js'
import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'
import { registerCleanup } from './cleanupRegistry.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import type { SystemPrompt } from './systemPromptType.js'

type FlowScope = 'main' | 'subagent'

export type SkillInvocationSource =
  | 'agent-preload'
  | 'skill-tool-fork'
  | 'skill-tool-inline'
  | 'skill-tool-remote'
  | 'slash-command'
  | 'slash-command-fork'

type QueryFlowEvent = {
  type: 'query_started'
  timestamp: string
  sessionId: string
  scope: FlowScope
  querySource: string
  agentId?: string
  agentType?: string
  mainThreadAgentType?: string
  promptHash: string
  promptLength: number
  messageCount: number
  userContextKeys: string[]
  systemContextKeys: string[]
  hasCustomSystemPrompt: boolean
  hasAppendSystemPrompt: boolean
}

type PromptSnapshotEvent = {
  type: 'prompt_snapshot'
  timestamp: string
  sessionId: string
  promptHash: string
  promptLength: number
  text: string
}

type AgentSelectionEvent = {
  type: 'agent_selected'
  timestamp: string
  sessionId: string
  scope: FlowScope
  agentType: string
  agentSource: string
  agentId?: string
  baseDir?: string
  filename?: string
  model?: string
  effort?: number | string
  permissionMode?: string
  maxTurns?: number
  background?: boolean
  selectionSource?: string
  querySource?: string
  isBuiltIn: boolean
}

type SkillInvocationEvent = {
  type: 'skill_invoked'
  timestamp: string
  sessionId: string
  scope: FlowScope
  skillName: string
  skillPath: string
  source: SkillInvocationSource
  agentId?: string
  agentType?: string
  commandSource?: string
  loadedFrom?: string
  argsProvided: boolean
  argsLength: number
  promptLength?: number
}

type FlowEvent =
  | AgentSelectionEvent
  | PromptSnapshotEvent
  | QueryFlowEvent
  | SkillInvocationEvent

const seenPromptHashesBySession = new Map<string, Set<string>>()
let cleanupRegistered = false
let pendingWrite: Promise<void> = Promise.resolve()

function ensureCleanupRegistered(): void {
  if (cleanupRegistered) {
    return
  }

  cleanupRegistered = true
  registerCleanup(async () => {
    await pendingWrite
  })
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function normalizePromptText(prompt: SystemPrompt | readonly string[]): string {
  return prompt.join('\n\n').trim()
}

function queueEventWrite(event: FlowEvent): void {
  ensureCleanupRegistered()

  const filePath = getInternalFlowLogPath(event.sessionId)
  const dirPath = dirname(filePath)
  const line = `${JSON.stringify(event)}\n`

  pendingWrite = pendingWrite
    .then(async () => {
      await mkdir(dirPath, { recursive: true }).catch(() => {})
      await appendFile(filePath, line, 'utf8')
    })
    .catch(() => {})
}

function ensurePromptSnapshot(
  sessionId: string,
  timestamp: string,
  promptText: string,
  promptHash: string,
): number {
  const promptLength = promptText.length
  let seenHashes = seenPromptHashesBySession.get(sessionId)
  if (!seenHashes) {
    seenHashes = new Set<string>()
    seenPromptHashesBySession.set(sessionId, seenHashes)
  }

  if (!seenHashes.has(promptHash)) {
    seenHashes.add(promptHash)
    queueEventWrite({
      type: 'prompt_snapshot',
      timestamp,
      sessionId,
      promptHash,
      promptLength,
      text: promptText,
    })
  }

  return promptLength
}

export function getInternalFlowLogPath(sessionId: string = getSessionId()): string {
  return join(getClaudeConfigHomeDir(), 'internal-flow', `${sessionId}.jsonl`)
}

export function logQueryFlow(params: {
  querySource: string
  systemPrompt: SystemPrompt
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: {
    agentId?: string
    agentType?: string
    messages: unknown[]
    options: {
      appendSystemPrompt?: string
      customSystemPrompt?: string
    }
  }
}): void {
  const sessionId = getSessionId()
  const timestamp = new Date().toISOString()
  const promptText = normalizePromptText(params.systemPrompt)
  const promptHash = hashText(promptText)
  const mainThreadAgentType = getMainThreadAgentType()
  const promptLength = ensurePromptSnapshot(
    sessionId,
    timestamp,
    promptText,
    promptHash,
  )
  const scope: FlowScope = params.toolUseContext.agentId ? 'subagent' : 'main'

  queueEventWrite({
    type: 'query_started',
    timestamp,
    sessionId,
    scope,
    querySource: params.querySource,
    ...(params.toolUseContext.agentId && {
      agentId: params.toolUseContext.agentId,
    }),
    ...(params.toolUseContext.agentType && {
      agentType: params.toolUseContext.agentType,
    }),
    ...(!params.toolUseContext.agentId && mainThreadAgentType
      ? { mainThreadAgentType }
      : {}),
    promptHash,
    promptLength,
    messageCount: params.toolUseContext.messages.length,
    userContextKeys: Object.keys(params.userContext).sort(),
    systemContextKeys: Object.keys(params.systemContext).sort(),
    hasCustomSystemPrompt:
      params.toolUseContext.options.customSystemPrompt !== undefined,
    hasAppendSystemPrompt:
      params.toolUseContext.options.appendSystemPrompt !== undefined,
  })
}

export function logAgentSelection(params: {
  agent: AgentDefinition
  scope: FlowScope
  agentId?: string
  selectionSource?: string
  querySource?: string
}): void {
  const sessionId = getSessionId()
  queueEventWrite({
    type: 'agent_selected',
    timestamp: new Date().toISOString(),
    sessionId,
    scope: params.scope,
    agentType: params.agent.agentType,
    agentSource: params.agent.source,
    ...(params.agentId && { agentId: params.agentId }),
    ...(params.agent.baseDir && { baseDir: params.agent.baseDir }),
    ...(params.agent.filename && { filename: params.agent.filename }),
    ...(params.agent.model && { model: params.agent.model }),
    ...(params.agent.effort !== undefined && { effort: params.agent.effort }),
    ...(params.agent.permissionMode && {
      permissionMode: params.agent.permissionMode,
    }),
    ...(params.agent.maxTurns !== undefined && {
      maxTurns: params.agent.maxTurns,
    }),
    ...(params.agent.background !== undefined && {
      background: params.agent.background,
    }),
    ...(params.selectionSource && {
      selectionSource: params.selectionSource,
    }),
    ...(params.querySource && { querySource: params.querySource }),
    isBuiltIn: params.agent.source === 'built-in',
  })
}

export function logSkillInvocation(params: {
  skillName: string
  skillPath: string
  source: SkillInvocationSource
  args?: string
  agentId?: string | null
  agentType?: string
  commandSource?: string
  loadedFrom?: string
  promptText?: string
}): void {
  const sessionId = getSessionId()
  const normalizedAgentId = params.agentId ?? undefined
  const effectiveAgentType =
    params.agentType ??
    (normalizedAgentId ? undefined : getMainThreadAgentType())
  queueEventWrite({
    type: 'skill_invoked',
    timestamp: new Date().toISOString(),
    sessionId,
    scope: normalizedAgentId ? 'subagent' : 'main',
    skillName: params.skillName,
    skillPath: params.skillPath,
    source: params.source,
    ...(normalizedAgentId && { agentId: normalizedAgentId }),
    ...(effectiveAgentType && { agentType: effectiveAgentType }),
    ...(params.commandSource && { commandSource: params.commandSource }),
    ...(params.loadedFrom && { loadedFrom: params.loadedFrom }),
    argsProvided: Boolean(params.args),
    argsLength: params.args?.length ?? 0,
    ...(params.promptText !== undefined && {
      promptLength: params.promptText.length,
    }),
  })
}