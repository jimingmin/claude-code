/**
 * Third-party model registry.
 *
 * Defines well-known OpenAI-compatible models and their provider endpoints.
 * Users only need to supply an API key — the base URL and model ID are
 * pre-configured here.
 */

import type { ModelOption } from './modelOptions.js'

export interface ThirdPartyProvider {
  /** Internal provider ID (used as key in config storage) */
  id: string
  /** Human-readable provider name */
  name: string
  /** Default base URL for the provider's OpenAI-compatible API */
  baseURL: string
  /** Environment variable name for the API key (for display/docs) */
  apiKeyEnvHint: string
}

export interface ThirdPartyModelDef {
  /** Model ID sent to the provider API */
  modelId: string
  /** Display label in the model picker */
  label: string
  /** Description shown in the model picker */
  description: string
  /** Which provider this model belongs to */
  providerId: string
}

const THIRD_PARTY_MODEL_ALIASES: Record<string, string> = {
  'kimi-2.5': 'kimi-k2.5',
  'kimi-k2': 'kimi-k2.5',
  'glm5.1': 'glm-5.1',
}

// ---------------------------------------------------------------------------
// Well-known providers
// ---------------------------------------------------------------------------

export const THIRD_PARTY_PROVIDERS: ThirdPartyProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnvHint: 'OPENAI_API_KEY',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    apiKeyEnvHint: 'DEEPSEEK_API_KEY',
  },
  {
    id: 'kimi',
    name: 'Moonshot (Kimi)',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnvHint: 'KIMI_API_KEY',
  },
  {
    id: 'zhipu',
    name: 'Zhipu (GLM)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnvHint: 'ZHIPU_API_KEY',
  },
  {
    id: 'alibaba',
    name: 'Alibaba (Qwen)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnvHint: 'DASHSCOPE_API_KEY',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyEnvHint: 'GEMINI_API_KEY',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    baseURL: '',
    apiKeyEnvHint: 'OPENAI_API_KEY',
  },
]

// ---------------------------------------------------------------------------
// Well-known models
// ---------------------------------------------------------------------------

export const THIRD_PARTY_MODELS: ThirdPartyModelDef[] = [
  // OpenAI
  {
    modelId: 'o3',
    label: 'OpenAI o3',
    description: 'OpenAI o3 · Advanced reasoning',
    providerId: 'openai',
  },
  {
    modelId: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'GPT-4.1 · Coding & instruction following',
    providerId: 'openai',
  },
  {
    modelId: 'codex-mini',
    label: 'Codex Mini',
    description: 'Codex Mini · Lightweight coding model',
    providerId: 'openai',
  },
  // DeepSeek
  {
    modelId: 'deepseek-chat',
    label: 'DeepSeek V3',
    description: 'DeepSeek V3 · Strong open-source model',
    providerId: 'deepseek',
  },
  {
    modelId: 'deepseek-reasoner',
    label: 'DeepSeek R1',
    description: 'DeepSeek R1 · Reasoning model',
    providerId: 'deepseek',
  },
  // Kimi
  {
    modelId: 'kimi-k2.5',
    label: 'Kimi K2.5',
    description: 'Kimi K2.5 · Moonshot AI OpenAI-compatible model',
    providerId: 'kimi',
  },
  // Zhipu GLM
  {
    modelId: 'glm-5.1',
    label: 'GLM-5.1',
    description: 'GLM-5.1 · Zhipu AI latest flagship coding model',
    providerId: 'zhipu',
  },
  {
    modelId: 'glm-4-plus',
    label: 'GLM-4-Plus',
    description: 'GLM-4-Plus · Zhipu AI flagship model',
    providerId: 'zhipu',
  },
  // Alibaba Qwen
  {
    modelId: 'qwen-plus',
    label: 'Qwen Plus',
    description: 'Qwen Plus · Alibaba Cloud model',
    providerId: 'alibaba',
  },
  {
    modelId: 'qwen-max',
    label: 'Qwen Max',
    description: 'Qwen Max · Alibaba Cloud flagship',
    providerId: 'alibaba',
  },
  // Gemini
  {
    modelId: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Gemini 2.5 Pro · Google advanced model',
    providerId: 'gemini',
  },
  {
    modelId: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Gemini 2.5 Flash · Google fast model',
    providerId: 'gemini',
  },
]

// ---------------------------------------------------------------------------
// Persisted user configuration for third-party providers
// ---------------------------------------------------------------------------

export interface CustomProviderConfig {
  /** Provider ID from THIRD_PARTY_PROVIDERS */
  providerId: string
  /** User's API key for this provider */
  apiKey: string
  /** Override base URL (optional, uses provider default if empty) */
  baseURL?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getProviderById(
  id: string,
): ThirdPartyProvider | undefined {
  return THIRD_PARTY_PROVIDERS.find(p => p.id === id)
}

export function getModelsForProvider(
  providerId: string,
): ThirdPartyModelDef[] {
  return THIRD_PARTY_MODELS.filter(m => m.providerId === providerId)
}

export function normalizeThirdPartyModelId(modelId: string): string {
  const trimmedModelId = modelId.trim()
  const lowerModelId = trimmedModelId.toLowerCase()
  const aliasedModelId = THIRD_PARTY_MODEL_ALIASES[lowerModelId]
  if (aliasedModelId) {
    return aliasedModelId
  }

  const knownModel = THIRD_PARTY_MODELS.find(
    model => model.modelId === lowerModelId,
  )
  return knownModel?.modelId ?? trimmedModelId
}

export function normalizeThirdPartyModelSetting(modelId: string): string {
  const trimmedModelId = modelId.trim()
  const has1mTag = /\[1m\]$/i.test(trimmedModelId)
  const baseModelId = has1mTag
    ? trimmedModelId.replace(/\[1m\]$/i, '').trim()
    : trimmedModelId

  return normalizeThirdPartyModelId(baseModelId) + (has1mTag ? '[1m]' : '')
}

/**
 * Returns the set of provider IDs for which the user has configured an API key.
 */
export function getConfiguredProviderIds(
  customProviders: CustomProviderConfig[] | undefined,
): Set<string> {
  if (!customProviders) return new Set()
  return new Set(customProviders.filter(c => c.apiKey).map(c => c.providerId))
}

/**
 * Find the provider config the user has saved for a given provider ID.
 */
export function getCustomProviderConfig(
  customProviders: CustomProviderConfig[] | undefined,
  providerId: string,
): CustomProviderConfig | undefined {
  return customProviders?.find(c => c.providerId === providerId)
}

/**
 * Resolve provider config for a given third-party model ID.
 *
 * Looks up the model in the registry, finds the provider, then checks
 * whether the user has an API key configured (in config or env).
 * Returns null if the model is not recognized or not configured.
 */
export function resolveThirdPartyModel(
  modelId: string,
  customProviders: CustomProviderConfig[] | undefined,
): { model: ThirdPartyModelDef; provider: ThirdPartyProvider; apiKey: string; baseURL: string } | null {
  const normalizedModelId = normalizeThirdPartyModelId(modelId)
  const modelDef = THIRD_PARTY_MODELS.find(m => m.modelId === normalizedModelId)
  if (!modelDef) return null

  const provider = getProviderById(modelDef.providerId)
  if (!provider) return null

  // Check user config first, then env var
  const userConfig = getCustomProviderConfig(customProviders, provider.id)
  const apiKey = userConfig?.apiKey || process.env[provider.apiKeyEnvHint] || process.env.OPENAI_API_KEY || ''
  if (!apiKey) return null

  const baseURL = userConfig?.baseURL || provider.baseURL
  return { model: modelDef, provider, apiKey, baseURL }
}

/**
 * Check if a model ID is a registered third-party model.
 */
export function isThirdPartyModel(modelId: string): boolean {
  const normalizedModelId = normalizeThirdPartyModelId(modelId)
  return THIRD_PARTY_MODELS.some(m => m.modelId === normalizedModelId)
}

/**
 * Build ModelOption entries for third-party models that have configured API keys.
 */
export function getThirdPartyModelOptions(
  customProviders: CustomProviderConfig[] | undefined,
): ModelOption[] {
  const configuredIds = getConfiguredProviderIds(customProviders)
  if (configuredIds.size === 0) return []

  const options: ModelOption[] = []
  for (const model of THIRD_PARTY_MODELS) {
    if (configuredIds.has(model.providerId)) {
      const provider = getProviderById(model.providerId)
      options.push({
        value: model.modelId,
        label: model.label,
        description: `${model.description}${provider ? ` (${provider.name})` : ''}`,
      })
    }
  }
  return options
}
