/**
 * OpenAI-Compatible API Adapter
 *
 * Translates between the Anthropic SDK interface (used throughout this codebase)
 * and OpenAI-compatible chat completions APIs. This enables using third-party
 * models like Codex, Kimi, GLM, DeepSeek, etc.
 *
 * Environment variables:
 * - OPENAI_API_KEY: API key for the provider
 * - OPENAI_BASE_URL: Base URL (e.g., https://api.openai.com/v1)
 * - OPENAI_MODEL: Default model name (e.g., codex-5.4, kimi-k2.5, glm-3.1)
 *
 * The adapter creates a fake Anthropic client that internally calls the
 * OpenAI-compatible endpoint and translates the streaming SSE response into
 * Anthropic BetaRawMessageStreamEvent events.
 */

import type Anthropic from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageStreamParams,
  BetaRawMessageStreamEvent,
  BetaMessageParam as MessageParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { Stream } from '@anthropic-ai/sdk/streaming.mjs'
import { logForDebugging } from '../../utils/debug.js'
import { normalizeThirdPartyModelId } from '../../utils/model/thirdPartyModels.js'

// ---------------------------------------------------------------------------
// Types for OpenAI Chat Completions API
// ---------------------------------------------------------------------------

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  reasoning_content?: string | null
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
  name?: string
}

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

interface OpenAIChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      reasoning?: string | null
      reasoning_content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenAIChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      reasoning?: string | null
      reasoning_content?: string | null
      tool_calls?: OpenAIToolCall[]
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

type OpenAIErrorPayload = {
  error?: {
    message?: string
    type?: string
  }
}

type AnthropicContentBlockLike = {
  type?: string
  text?: string
  thinking?: string
  tool_use_id?: string
  content?: unknown
  id?: string
  name?: string
  input?: unknown
}

type AnthropicToolLike = {
  type?: string
  name?: string
  description?: string
  input_schema?: Record<string, unknown>
}

function getOpenAIProviderHint(
  baseURL: string,
  model: string,
  status: number,
  payload: OpenAIErrorPayload | null,
): string | null {
  let hostname = ''
  try {
    hostname = new URL(baseURL).hostname
  } catch {}

  if (hostname.includes('moonshot.cn') || hostname.includes('kimi.com')) {
    const errorMessage = payload?.error?.message || ''
    const errorType = payload?.error?.type || ''
    const missingModelOrPermission =
      status === 404 ||
      /resource_not_found_error/i.test(errorType) ||
      /not found the model|permission denied/i.test(errorMessage)

    if (missingModelOrPermission) {
      return [
        'Kimi provider hint: the official OpenAI-compatible model ID is "kimi-k2.5".',
        'This usually means the selected model is wrong for this provider, or the current API key does not have access to that model.',
        'Set or update the key with /provider kimi <api-key>, or configure KIMI_API_KEY.',
        `Current request model: ${model}`,
      ].join(' ')
    }

    if (status === 401 || status === 403) {
      return 'Kimi provider hint: this usually indicates an invalid API key or insufficient permissions. Set or update the key with /provider kimi <api-key>, or configure KIMI_API_KEY.'
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Message Format Conversion: Anthropic → OpenAI
// ---------------------------------------------------------------------------

function anthropicSystemToOpenAI(
  system: BetaMessageStreamParams['system'],
): string {
  if (!system) return ''
  if (typeof system === 'string') return system
  // system is an array of content blocks
  return (system as Array<{ type: string; text?: string }>)
    .map(block => {
      if (block.type === 'text' && block.text) return block.text
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

function extractAnthropicReasoningContent(
  blocks: AnthropicContentBlockLike[],
): string | null {
  const reasoningParts: string[] = []
  let hasReasoningBlock = false

  for (const block of blocks) {
    if (block.type === 'thinking') {
      hasReasoningBlock = true
      if (typeof block.thinking === 'string' && block.thinking.length > 0) {
        reasoningParts.push(block.thinking)
      }
    } else if (block.type === 'redacted_thinking') {
      hasReasoningBlock = true
    }
  }

  if (reasoningParts.length > 0) {
    return reasoningParts.join('\n\n')
  }

  return hasReasoningBlock ? '' : null
}

function extractOpenAIReasoningContent(
  payload: { reasoning_content?: unknown; reasoning?: unknown },
): string | null {
  if (typeof payload.reasoning_content === 'string') {
    return payload.reasoning_content
  }
  if (typeof payload.reasoning === 'string') {
    return payload.reasoning
  }
  return null
}

function anthropicMessagesToOpenAI(
  messages: MessageParam[],
): OpenAIChatMessage[] {
  const result: OpenAIChatMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = normalizeContent(msg.content)
      // Check if this contains tool_result blocks (tool responses)
      if (Array.isArray(msg.content)) {
        const contentBlocks = msg.content as unknown as AnthropicContentBlockLike[]

        for (const block of contentBlocks) {
          if (block.type === 'tool_result') {
            result.push({
              role: 'tool',
              tool_call_id: block.tool_use_id || '',
              content: extractTextContent(block.content),
            })
          }
        }
        // Also include any non-tool_result text
        const textParts = contentBlocks
          .filter(b => b.type === 'text')
          .map(b => b.text || '')
          .join('\n')
        if (textParts) {
          result.push({ role: 'user', content: textParts })
        }
      } else {
        result.push({ role: 'user', content })
      }
    } else if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        // Check for tool_use blocks
        const contentBlocks = msg.content as unknown as AnthropicContentBlockLike[]
        const toolCalls: OpenAIToolCall[] = []
        let textContent = ''
        const reasoningContent = extractAnthropicReasoningContent(contentBlocks)

        for (const block of contentBlocks) {
          if (block.type === 'text') {
            textContent += block.text || ''
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id || '',
              type: 'function',
              function: {
                name: block.name || '',
                arguments:
                  typeof block.input === 'string'
                    ? block.input
                    : JSON.stringify(block.input),
              },
            })
          }
          // Skip thinking blocks — not relevant for OpenAI
        }

        const assistantMsg: OpenAIChatMessage = {
          role: 'assistant',
          content: textContent || null,
        }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls
        }
        if (reasoningContent !== null) {
          assistantMsg.reasoning_content = reasoningContent
        }
        result.push(assistantMsg)
      } else {
        result.push({
          role: 'assistant',
          content: (msg.content as string) || null,
        })
      }
    }
  }

  return result
}

function normalizeContent(
  content: MessageParam['content'],
): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const contentBlocks = content as unknown as AnthropicContentBlockLike[]
    return contentBlocks
      .map(block => {
        if (block.type === 'text') return block.text || ''
        if (block.type === 'image')
          return '[image content not supported by this provider]'
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return String(content)
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const contentBlocks = content as AnthropicContentBlockLike[]
    return contentBlocks
      .filter(b => b.type === 'text')
      .map(b => b.text || '')
      .join('\n')
  }
  return ''
}

function anthropicToolsToOpenAI(
  tools: BetaMessageStreamParams['tools'],
): OpenAITool[] | undefined {
  if (!tools || tools.length === 0) return undefined
  return (tools as unknown as AnthropicToolLike[])
    .filter(
      t =>
        t.type === 'custom' ||
        t.type === undefined ||
        // support bare tool definitions without explicit type
        (t.name && t.input_schema),
    )
    .map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name || '',
        description: tool.description || undefined,
        parameters: tool.input_schema || undefined,
      },
    }))
}

// ---------------------------------------------------------------------------
// Streaming SSE Parser
// ---------------------------------------------------------------------------

async function* parseSSEStream(
  response: Response,
): AsyncGenerator<OpenAIChatCompletionChunk> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') return
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            yield data as OpenAIChatCompletionChunk
          } catch {
            // Skip malformed JSON lines
            logForDebugging(
              `[OpenAI Adapter] Failed to parse SSE chunk: ${trimmed.slice(0, 100)}`,
            )
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ---------------------------------------------------------------------------
// OpenAI Streaming → Anthropic Event Translation
// ---------------------------------------------------------------------------

function mapFinishReason(
  reason: string | null,
): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null {
  switch (reason) {
    case 'stop':
      return 'end_turn'
    case 'tool_calls':
      return 'tool_use'
    case 'length':
      return 'max_tokens'
    default:
      return reason ? 'end_turn' : null
  }
}

/**
 * Convert an OpenAI streaming response into Anthropic BetaRawMessageStreamEvent events.
 */
async function* openAIStreamToAnthropicEvents(
  response: Response,
  model: string,
): AsyncGenerator<BetaRawMessageStreamEvent> {
  let nextBlockIndex = 0
  let openThinkingBlockIndex: number | null = null
  let openTextBlockIndex: number | null = null
  const toolCallAccumulators: Map<
    number,
    { id: string; name: string; arguments: string; blockIndex: number }
  > = new Map()
  let inputTokens = 0
  let outputTokens = 0

  // Emit message_start
  yield {
    type: 'message_start',
    message: {
      id: `msg_openai_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as BetaMessage,
  } as BetaRawMessageStreamEvent

  for await (const chunk of parseSSEStream(response)) {
    const choice = chunk.choices?.[0]
    if (!choice) continue

    const delta = choice.delta

    const reasoningDelta = extractOpenAIReasoningContent(delta)
    if (reasoningDelta !== null) {
      if (openThinkingBlockIndex === null) {
        if (openTextBlockIndex !== null || toolCallAccumulators.size > 0) {
          logForDebugging(
            '[OpenAI Adapter] Ignoring late reasoning delta after content blocks started',
          )
        } else {
          openThinkingBlockIndex = nextBlockIndex++
          yield {
            type: 'content_block_start',
            index: openThinkingBlockIndex,
            content_block: { type: 'thinking', thinking: '', signature: '' },
          } as unknown as BetaRawMessageStreamEvent
        }
      }

      if (openThinkingBlockIndex !== null) {
        yield {
          type: 'content_block_delta',
          index: openThinkingBlockIndex,
          delta: { type: 'thinking_delta', thinking: reasoningDelta },
        } as unknown as BetaRawMessageStreamEvent
      }
    }

    // Handle text content
    if (delta.content) {
      if (openThinkingBlockIndex !== null) {
        yield {
          type: 'content_block_stop',
          index: openThinkingBlockIndex,
        } as unknown as BetaRawMessageStreamEvent
        openThinkingBlockIndex = null
      }

      if (openTextBlockIndex === null) {
        openTextBlockIndex = nextBlockIndex++
        yield {
          type: 'content_block_start',
          index: openTextBlockIndex,
          content_block: { type: 'text', text: '' },
        } as unknown as BetaRawMessageStreamEvent
      }
      yield {
        type: 'content_block_delta',
        index: openTextBlockIndex,
        delta: { type: 'text_delta', text: delta.content },
      } as unknown as BetaRawMessageStreamEvent
    }

    // Handle tool calls
    if (delta.tool_calls) {
      if (openThinkingBlockIndex !== null) {
        yield {
          type: 'content_block_stop',
          index: openThinkingBlockIndex,
        } as unknown as BetaRawMessageStreamEvent
        openThinkingBlockIndex = null
      }

      if (openTextBlockIndex !== null) {
        yield {
          type: 'content_block_stop',
          index: openTextBlockIndex,
        } as unknown as BetaRawMessageStreamEvent
        openTextBlockIndex = null
      }

      for (const tc of delta.tool_calls) {
        let acc = toolCallAccumulators.get(tc.index)
        if (!acc) {
          acc = {
            id: tc.id || `toolu_openai_${Date.now()}_${tc.index}`,
            name: tc.function?.name || '',
            arguments: '',
            blockIndex: nextBlockIndex++,
          }
          toolCallAccumulators.set(tc.index, acc)

          yield {
            type: 'content_block_start',
            index: acc.blockIndex,
            content_block: {
              type: 'tool_use',
              id: acc.id,
              name: acc.name,
              input: '',
            },
          } as unknown as BetaRawMessageStreamEvent
        }

        if (tc.function?.name) {
          acc.name = tc.function.name
        }
        if (tc.function?.arguments) {
          acc.arguments += tc.function.arguments
          yield {
            type: 'content_block_delta',
            index: acc.blockIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: tc.function.arguments,
            },
          } as unknown as BetaRawMessageStreamEvent
        }
      }
    }

    // Track usage
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }

    // Handle finish
    if (choice.finish_reason) {
      if (openThinkingBlockIndex !== null) {
        yield {
          type: 'content_block_stop',
          index: openThinkingBlockIndex,
        } as unknown as BetaRawMessageStreamEvent
        openThinkingBlockIndex = null
      }

      if (openTextBlockIndex !== null) {
        yield {
          type: 'content_block_stop',
          index: openTextBlockIndex,
        } as unknown as BetaRawMessageStreamEvent
        openTextBlockIndex = null
      }

      // Close open tool call blocks
      for (const [, acc] of toolCallAccumulators) {
        yield {
          type: 'content_block_stop',
          index: acc.blockIndex,
        } as unknown as BetaRawMessageStreamEvent
      }

      // Emit message_delta with stop reason
      yield {
        type: 'message_delta',
        delta: {
          stop_reason: mapFinishReason(choice.finish_reason),
          stop_sequence: null,
        },
        usage: {
          output_tokens: outputTokens,
        },
      } as unknown as BetaRawMessageStreamEvent

      // Emit message_stop
      yield {
        type: 'message_stop',
      } as unknown as BetaRawMessageStreamEvent
    }
  }
}

// ---------------------------------------------------------------------------
// Non-streaming Response Conversion
// ---------------------------------------------------------------------------

function openAIResponseToAnthropic(
  response: OpenAIChatCompletionResponse,
  model: string,
): BetaMessage {
  const choice = response.choices?.[0]
  if (!choice) {
    throw new Error('No choices in OpenAI response')
  }

  const content: BetaContentBlock[] = []

  const reasoningContent = extractOpenAIReasoningContent(choice.message)
  if (reasoningContent !== null) {
    content.push({
      type: 'thinking',
      thinking: reasoningContent,
      signature: '',
    } as unknown as BetaContentBlock)
  }

  if (choice.message.content) {
    content.push({
      type: 'text',
      text: choice.message.content,
    } as BetaContentBlock)
  }

  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let parsedInput: Record<string, unknown>
      try {
        parsedInput = JSON.parse(tc.function.arguments)
      } catch {
        parsedInput = { raw: tc.function.arguments }
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: parsedInput,
      } as unknown as BetaContentBlock)
    }
  }

  return {
    id: response.id || `msg_openai_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: mapFinishReason(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    },
  } as unknown as BetaMessage
}

// ---------------------------------------------------------------------------
// Fake Stream wrapper (makes async generator look like Anthropic Stream)
// ---------------------------------------------------------------------------

function createFakeStream(
  events: AsyncGenerator<BetaRawMessageStreamEvent>,
): Stream<BetaRawMessageStreamEvent> {
  const stream = {
    [Symbol.asyncIterator]() {
      return events
    },
    controller: new AbortController(),
  }
  return stream as unknown as Stream<BetaRawMessageStreamEvent>
}

// ---------------------------------------------------------------------------
// OpenAI Adapter Client
// ---------------------------------------------------------------------------

export interface OpenAIAdapterOptions {
  apiKey: string
  baseURL: string
  defaultHeaders?: Record<string, string>
  timeout?: number
  maxRetries?: number
}

export function createOpenAIAdapterClient(
  options: OpenAIAdapterOptions,
): Anthropic {
  const { apiKey, baseURL, defaultHeaders = {}, timeout = 600_000 } = options

  async function makeRequest(
    params: BetaMessageStreamParams & { stream?: boolean },
    requestOptions?: { signal?: AbortSignal; timeout?: number; headers?: Record<string, string> },
  ): Promise<{
    data: Stream<BetaRawMessageStreamEvent> | BetaMessage
    response: Response
    request_id: string
  }> {
    const isStreaming = params.stream !== false
    const providerModel = normalizeThirdPartyModelId(params.model)

    // Build OpenAI request body
    const messages: OpenAIChatMessage[] = []

    // Add system message
    const systemContent = anthropicSystemToOpenAI(params.system)
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent })
    }

    // Convert messages
    messages.push(...anthropicMessagesToOpenAI(params.messages))

    const tools = anthropicToolsToOpenAI(params.tools)

    const body: Record<string, unknown> = {
      model: providerModel,
      messages,
      max_tokens: params.max_tokens,
      stream: isStreaming,
      ...(tools && tools.length > 0 && { tools }),
      ...(params.temperature !== undefined && {
        temperature: params.temperature,
      }),
    }

    // Add stream_options for usage in streaming mode
    if (isStreaming) {
      body.stream_options = { include_usage: true }
    }

    const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`

    logForDebugging(
      `[OpenAI Adapter] ${isStreaming ? 'Streaming' : 'Non-streaming'} request to ${url}, model=${providerModel}`,
    )

    const controller = new AbortController()
    const signal = requestOptions?.signal

    // Combine external signal with our controller
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const timeoutId = setTimeout(
      () => controller.abort(),
      requestOptions?.timeout || timeout,
    )

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...defaultHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error')
        let errorPayload: OpenAIErrorPayload | null = null
        try {
          errorPayload = JSON.parse(errorBody) as OpenAIErrorPayload
        } catch {}
        const providerHint = getOpenAIProviderHint(
          baseURL,
          providerModel,
          response.status,
          errorPayload,
        )
        const error = new Error(
          providerHint
            ? `OpenAI API error ${response.status}: ${errorBody}\n${providerHint}`
            : `OpenAI API error ${response.status}: ${errorBody}`,
        )
        ;(error as any).status = response.status
        throw error
      }

      const requestId =
        response.headers.get('x-request-id') || `openai_${Date.now()}`

      if (isStreaming) {
        const eventStream = openAIStreamToAnthropicEvents(
          response,
          providerModel,
        )
        return {
          data: createFakeStream(eventStream),
          response,
          request_id: requestId,
        }
      } else {
        const json =
          (await response.json()) as OpenAIChatCompletionResponse
        return {
          data: openAIResponseToAnthropic(json, providerModel),
          response,
          request_id: requestId,
        }
      }
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }

  // Build a fake Anthropic client that routes through our adapter
  const fakeClient = {
    beta: {
      messages: {
        // For streaming: { ...params, stream: true } → returns something with .withResponse()
        // For non-streaming: { ...params } → returns BetaMessage directly
        create(
          params: BetaMessageStreamParams & { stream?: boolean },
          requestOptions?: { signal?: AbortSignal; timeout?: number; headers?: Record<string, string> },
        ) {
          const promise = makeRequest(params, requestOptions)

          if (params.stream) {
            // Return object with .withResponse() for streaming path
            return {
              async withResponse() {
                const result = await promise
                return {
                  data: result.data as Stream<BetaRawMessageStreamEvent>,
                  response: result.response,
                  request_id: result.request_id,
                }
              },
            }
          }

          // Non-streaming: return promise that resolves to BetaMessage
          return promise.then(r => r.data as BetaMessage)
        },
      },
    },
  }

  return fakeClient as unknown as Anthropic
}

/**
 * Get the OpenAI-compatible model name from env or the passed model string.
 * When the provider is 'openai', the model string from `--model` or ANTHROPIC_MODEL
 * is passed through as-is to the OpenAI-compatible endpoint.
 */
export function getOpenAIModelName(): string {
  return (
    process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || 'gpt-4o'
  )
}
