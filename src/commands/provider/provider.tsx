import chalk from 'chalk'
import * as React from 'react'
import { useEffect, useState } from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { Select } from '../../components/CustomSelect/index.js'
import TextInput from '../../components/TextInput.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text, useInput } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import type { LocalJSXCommandCall, LocalJSXCommandModule } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import {
  THIRD_PARTY_PROVIDERS,
  getCustomProviderConfig,
  getModelsForProvider,
  type CustomProviderConfig,
  type ThirdPartyProvider,
} from '../../utils/model/thirdPartyModels.js'

const VISIBLE_PROVIDERS = THIRD_PARTY_PROVIDERS
const PROVIDER_HELP_ARGS = new Set(['help', '--help', '-h', '?'])
const CUSTOM_PROVIDER_ID = 'custom'
const CUSTOM_BASE_URL_PLACEHOLDER = 'https://your-openai-compatible-endpoint/v1'
const CUSTOM_MODEL_ID_PLACEHOLDER = 'gpt-4.1'

type ProviderPickerPhase = 'select' | 'remove' | 'apikey' | 'baseurl' | 'modelid'

type ProviderConfigChange = {
  apiKey?: string
  preserveExistingApiKey?: boolean
  baseURL?: string | null
  modelId?: string | null
}

type ParsedProviderArgs =
  | { type: 'interactive'; provider?: ThirdPartyProvider }
  | { type: 'list' }
  | { type: 'help' }
  | { type: 'remove'; provider: ThirdPartyProvider }
  | {
      type: 'configure'
      provider: ThirdPartyProvider
      apiKey?: string
      preserveExistingApiKey: boolean
      baseURL?: string | null
      modelId?: string | null
    }
  | { type: 'error'; message: string }

type PersistedProviderChange = {
  entry: CustomProviderConfig | null
  effectiveBaseURL: string
  hasCustomBaseURL: boolean
  modelId?: string
}

function isCustomProvider(provider: ThirdPartyProvider): boolean {
  return provider.id === CUSTOM_PROVIDER_ID
}

function normalizeBaseURL(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed.replace(/\/+$/, '')
}

function getVisibleProviders(): ThirdPartyProvider[] {
  return VISIBLE_PROVIDERS
}

function normalizeModelId(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function getDefaultBaseURL(provider: ThirdPartyProvider): string {
  return normalizeBaseURL(provider.baseURL) ?? provider.baseURL
}

function getBaseURLDisplay(baseURL: string | undefined): string {
  return baseURL || 'base URL required'
}

function getProviderBaseURLPlaceholder(provider: ThirdPartyProvider): string {
  return isCustomProvider(provider)
    ? CUSTOM_BASE_URL_PLACEHOLDER
    : getDefaultBaseURL(provider)
}

function getEffectiveBaseURL(
  provider: ThirdPartyProvider,
  config?: CustomProviderConfig,
): string {
  return normalizeBaseURL(config?.baseURL) ?? getDefaultBaseURL(provider)
}

function hasCustomBaseURL(
  provider: ThirdPartyProvider,
  config?: CustomProviderConfig,
): boolean {
  return getEffectiveBaseURL(provider, config) !== getDefaultBaseURL(provider)
}

function getEffectiveModelId(config?: CustomProviderConfig): string | undefined {
  return normalizeModelId(config?.modelId)
}

function hasCustomModelId(config?: CustomProviderConfig): boolean {
  return Boolean(getEffectiveModelId(config))
}

function hasProviderConfiguration(
  provider: ThirdPartyProvider,
  config?: CustomProviderConfig,
): boolean {
  return Boolean(
    config?.apiKey || hasCustomBaseURL(provider, config) || hasCustomModelId(config),
  )
}

function getProviderOptionDescription(
  provider: ThirdPartyProvider,
  config?: CustomProviderConfig,
): string {
  const notes: string[] = []

  if (config?.apiKey) {
    notes.push('api key saved')
  }
  if (hasCustomBaseURL(provider, config)) {
    notes.push('custom URL')
  }
  if (isCustomProvider(provider) && getEffectiveModelId(config)) {
    notes.push(`model ${getEffectiveModelId(config)}`)
  }

  return notes.length > 0
    ? `${getBaseURLDisplay(getEffectiveBaseURL(provider, config))} · ${notes.join(' · ')}`
    : getBaseURLDisplay(getEffectiveBaseURL(provider, config))
}

function findProvider(providerId: string | undefined): ThirdPartyProvider | undefined {
  if (!providerId) {
    return undefined
  }

  const normalized = providerId.toLowerCase().trim()
  const compact = normalized.replace(/[^a-z0-9]+/g, '')

  return getVisibleProviders().find(provider => {
    const providerName = provider.name.toLowerCase()
    return (
      provider.id === normalized ||
      providerName === normalized ||
      providerName.replace(/[^a-z0-9]+/g, '') === compact
    )
  })
}

function getProviderUsage(): string {
  const providers = getVisibleProviders()
    .map(provider => provider.id)
    .join(', ')

  return [
    'Usage:',
    '  /provider',
    '  /provider list',
    '  /provider remove <provider>',
    '  /provider <provider>',
    '  /provider <provider> <api-key> [base-url]',
    '  /provider custom <api-key> <base-url> <model-id>',
    '  /provider <provider> --api-key <api-key> --base-url <url>',
    '  /provider custom --api-key <api-key> --base-url <url> --model <model-id>',
    '  /provider <provider> --base-url <url>',
    '  /provider custom --model <model-id>',
    '  /provider <provider> --reset-base-url',
    '  /provider custom --clear-model',
    '',
    `Providers: ${providers}`,
  ].join('\n')
}

function formatProviderList(): string {
  const customProviders = getGlobalConfig().customProviders

  return getVisibleProviders()
    .map(provider => {
      const config = getCustomProviderConfig(customProviders, provider.id)
      const notes: string[] = []

      if (config?.apiKey) {
        notes.push('api key saved')
      }
      if (hasCustomBaseURL(provider, config)) {
        notes.push('custom base URL')
      }
      if (isCustomProvider(provider) && getEffectiveModelId(config)) {
        notes.push(`model ${getEffectiveModelId(config)}`)
      }
      if (notes.length === 0) {
        notes.push('default')
      }

      return `- ${provider.id}: ${provider.name} · ${notes.join(', ')} · ${getBaseURLDisplay(getEffectiveBaseURL(provider, config))}`
    })
    .join('\n')
}

function deriveProviderChange(
  customProviders: CustomProviderConfig[] | undefined,
  provider: ThirdPartyProvider,
  change: ProviderConfigChange,
): { nextProviders: CustomProviderConfig[]; result: PersistedProviderChange } {
  const existing = getCustomProviderConfig(customProviders, provider.id)
  const defaultBaseURL = getDefaultBaseURL(provider)
  const existingCustomBaseURL = normalizeBaseURL(existing?.baseURL)
  const existingModelId = getEffectiveModelId(existing)
  const nextApiKey = change.preserveExistingApiKey
    ? existing?.apiKey ?? ''
    : change.apiKey?.trim() ?? ''

  const nextCustomBaseURL =
    change.baseURL === undefined
      ? existingCustomBaseURL
      : (() => {
          const normalized = normalizeBaseURL(change.baseURL)
          if (!normalized) {
            return undefined
          }

          return isCustomProvider(provider) || normalized !== defaultBaseURL
            ? normalized
            : undefined
        })()

  const nextModelId = isCustomProvider(provider)
    ? change.modelId === undefined
      ? existingModelId
      : normalizeModelId(change.modelId)
    : undefined

  const entry =
    nextApiKey || nextCustomBaseURL || nextModelId
      ? {
          providerId: provider.id,
          apiKey: nextApiKey,
          ...(nextCustomBaseURL ? { baseURL: nextCustomBaseURL } : {}),
          ...(nextModelId ? { modelId: nextModelId } : {}),
        }
      : null

  const nextProviders = (customProviders || []).filter(
    existingProvider => existingProvider.providerId !== provider.id,
  )

  if (entry) {
    nextProviders.push(entry)
  }

  return {
    nextProviders,
    result: {
      entry,
      effectiveBaseURL: nextCustomBaseURL ?? defaultBaseURL,
      hasCustomBaseURL: Boolean(nextCustomBaseURL),
      modelId: nextModelId,
    },
  }
}

function persistProviderChange(
  provider: ThirdPartyProvider,
  change: ProviderConfigChange,
): PersistedProviderChange {
  const snapshot = deriveProviderChange(
    getGlobalConfig().customProviders,
    provider,
    change,
  )

  saveGlobalConfig(current => {
    const next = deriveProviderChange(current.customProviders, provider, change)
    return {
      ...current,
      customProviders: next.nextProviders,
    }
  })

  return snapshot.result
}

function removeProviderConfiguration(provider: ThirdPartyProvider): void {
  saveGlobalConfig(current => ({
    ...current,
    customProviders: (current.customProviders || []).filter(
      existing => existing.providerId !== provider.id,
    ),
  }))
}

function formatProviderSavedMessage(
  provider: ThirdPartyProvider,
  result: PersistedProviderChange,
): string {
  if (!result.entry) {
    return `${chalk.bold(provider.name)} now uses its default base URL and has no saved API key.`
  }

  if (isCustomProvider(provider)) {
    const details: string[] = [`${chalk.bold(provider.name)} configured successfully.`]

    if (result.effectiveBaseURL) {
      details.push(`Base URL: ${result.effectiveBaseURL}.`)
    } else {
      details.push('Base URL not set yet.')
    }

    if (result.modelId) {
      details.push(`Default model: ${result.modelId}.`)
    } else {
      details.push('No default model ID saved yet.')
    }

    if (result.entry.apiKey) {
      details.push(
        `Use ${chalk.bold('/model')} to select the saved custom model, or ${chalk.bold('/model <model-id>')} to target another model on the same endpoint.`,
      )
    } else {
      details.push(
        `No API key is stored yet; set ${provider.apiKeyEnvHint} or run ${chalk.bold('/provider custom --api-key <api-key>')}.`,
      )
    }

    return details.join(' ')
  }

  if (result.entry.apiKey) {
    return (
      `${chalk.bold(provider.name)} configured successfully. ` +
      `Base URL: ${result.effectiveBaseURL}${
        result.hasCustomBaseURL ? ' (custom)' : ''
      }. ` +
      `Use ${chalk.bold('/model')} to select a ${provider.name} model.`
    )
  }

  return (
    `${chalk.bold(provider.name)} base URL updated to ${result.effectiveBaseURL}. ` +
    `No API key is stored yet; set ${provider.apiKeyEnvHint} or run ${chalk.bold(`/provider ${provider.id} <api-key>`)}.`
  )
}

function parseProviderArgs(args: string | undefined): ParsedProviderArgs {
  const trimmed = args?.trim()
  if (!trimmed) {
    return { type: 'interactive' }
  }

  const parts = trimmed.split(/\s+/)
  const first = parts[0]?.toLowerCase()

  if (!first) {
    return { type: 'interactive' }
  }

  if (PROVIDER_HELP_ARGS.has(first)) {
    return { type: 'help' }
  }

  if (first === 'list' || first === 'ls') {
    return { type: 'list' }
  }

  if (first === 'remove' || first === 'rm' || first === 'delete') {
    const provider = findProvider(parts[1])
    if (!provider) {
      return {
        type: 'error',
        message: `Unknown provider "${parts[1] || ''}".\n\n${getProviderUsage()}`,
      }
    }

    return { type: 'remove', provider }
  }

  const provider = findProvider(parts[0])
  if (!provider) {
    return {
      type: 'error',
      message: `Unknown provider "${parts[0]}".\n\n${getProviderUsage()}`,
    }
  }

  const rest = parts.slice(1)
  if (rest.length === 0) {
    return { type: 'interactive', provider }
  }

  let apiKey: string | undefined
  let baseURL: string | null | undefined
  let modelId: string | null | undefined
  const positional: string[] = []
  const customProvider = isCustomProvider(provider)
  let sawFlag = false

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!

    if (token === '--api-key') {
      sawFlag = true
      const value = rest[index + 1]
      if (!value) {
        return {
          type: 'error',
          message: `Missing value for --api-key.\n\n${getProviderUsage()}`,
        }
      }

      apiKey = value
      index += 1
      continue
    }

    if (token === '--base-url') {
      sawFlag = true
      const value = rest[index + 1]
      if (!value) {
        return {
          type: 'error',
          message: `Missing value for --base-url.\n\n${getProviderUsage()}`,
        }
      }

      baseURL = value
      index += 1
      continue
    }

    if (token === '--reset-base-url' || token === '--default-base-url') {
      sawFlag = true
      baseURL = null
      continue
    }

    if (token === '--model' || token === '--model-id') {
      sawFlag = true
      const value = rest[index + 1]
      if (!value) {
        return {
          type: 'error',
          message: `Missing value for ${token}.\n\n${getProviderUsage()}`,
        }
      }

      modelId = value
      index += 1
      continue
    }

    if (token === '--clear-model') {
      sawFlag = true
      modelId = null
      continue
    }

    if (token.startsWith('--')) {
      return {
        type: 'error',
        message: `Unknown option "${token}".\n\n${getProviderUsage()}`,
      }
    }

    positional.push(token)
  }

  if (!customProvider && modelId !== undefined) {
    return {
      type: 'error',
      message: `Only /provider custom accepts --model.\n\n${getProviderUsage()}`,
    }
  }

  const isUrl = (value: string) => /^https?:\/\//i.test(value)

  if (customProvider) {
    if (sawFlag && positional.length > 0) {
      return {
        type: 'error',
        message:
          `For /provider custom, use either positional arguments or flags, not both.\n\n${getProviderUsage()}`,
      }
    }

    if (positional.length > 3) {
      return {
        type: 'error',
        message: `Too many arguments.\n\n${getProviderUsage()}`,
      }
    }

    if (!sawFlag) {
      if (positional.length === 1) {
        if (isUrl(positional[0]!)) {
          baseURL = positional[0]!
        } else {
          apiKey = positional[0]!
        }
      } else if (positional.length === 2) {
        const [firstValue, secondValue] = positional
        if (isUrl(firstValue!)) {
          baseURL = firstValue!
          modelId = secondValue!
        } else if (isUrl(secondValue!)) {
          apiKey = firstValue!
          baseURL = secondValue!
        } else {
          apiKey = firstValue!
          modelId = secondValue!
        }
      } else if (positional.length === 3) {
        apiKey = positional[0]
        baseURL = positional[1]!
        modelId = positional[2]!
      }
    }

    return {
      type: 'configure',
      provider,
      apiKey,
      baseURL,
      modelId,
      preserveExistingApiKey: apiKey === undefined,
    }
  }

  if (apiKey === undefined && baseURL === undefined && positional.length === 1) {
    const value = positional[0]!
    if (isUrl(value)) {
      baseURL = value
    } else {
      apiKey = value
    }
  } else if (apiKey === undefined && baseURL === undefined && positional.length === 2) {
    apiKey = positional[0]
    baseURL = positional[1]!
  } else {
    if (positional.length > 1) {
      return {
        type: 'error',
        message: `Too many arguments.\n\n${getProviderUsage()}`,
      }
    }

    if (positional.length === 1) {
      if (apiKey === undefined) {
        apiKey = positional[0]
      } else if (baseURL === undefined) {
        baseURL = positional[0]!
      } else {
        return {
          type: 'error',
          message: `Too many arguments.\n\n${getProviderUsage()}`,
        }
      }
    }
  }

  return {
    type: 'configure',
    provider,
    apiKey,
    baseURL,
    modelId,
    preserveExistingApiKey: apiKey === undefined,
  }
}

function BaseURLInput({
  provider,
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  provider: ThirdPartyProvider
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const { columns } = useTerminalSize()
  const [cursorOffset, setCursorOffset] = useState(value.length)

  useKeybinding('confirm:no', onCancel, { context: 'Settings' })
  useEffect(() => {
    setCursorOffset(value.length)
  }, [value])

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>{provider.name} — Base URL</Text>
      <Text dimColor>
        {isCustomProvider(provider)
          ? `Example base URL: ${CUSTOM_BASE_URL_PLACEHOLDER}`
          : `Default base URL: ${getDefaultBaseURL(provider)}`}
      </Text>
      <Text dimColor>
        {isCustomProvider(provider)
          ? 'Delete the value and press Enter to clear the saved base URL.'
          : 'Delete the value and press Enter to restore the default URL.'}
      </Text>
      <Text dimColor>Press Esc to go back to the API key step.</Text>
      <Box marginTop={1} flexDirection="row" gap={1}>
        <Text>Base URL:</Text>
        <TextInput
          value={value}
          onChange={nextValue => {
            onChange(nextValue)
            setCursorOffset(nextValue.length)
          }}
          onSubmit={onSubmit}
          focus={true}
          showCursor={true}
          placeholder={getProviderBaseURLPlaceholder(provider)}
          columns={Math.max(24, columns - 'Base URL:'.length - 3)}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
      </Box>
    </Box>
  )
}

function CustomModelInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const { columns } = useTerminalSize()
  const [cursorOffset, setCursorOffset] = useState(value.length)

  useKeybinding('confirm:no', onCancel, { context: 'Settings' })
  useEffect(() => {
    setCursorOffset(value.length)
  }, [value])

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Custom OpenAI-Compatible — Default Model ID</Text>
      <Text dimColor>
        This model ID is surfaced by {chalk.bold('/model')} as the saved default for this endpoint.
      </Text>
      <Text dimColor>
        You can still run {chalk.bold('/model <model-id>')} later to target another model on the same base URL.
      </Text>
      <Text dimColor>Delete the value and press Enter to clear the saved default model.</Text>
      <Text dimColor>Press Esc to go back to the base URL step.</Text>
      <Box marginTop={1} flexDirection="row" gap={1}>
        <Text>Model ID:</Text>
        <TextInput
          value={value}
          onChange={nextValue => {
            onChange(nextValue)
            setCursorOffset(nextValue.length)
          }}
          onSubmit={onSubmit}
          focus={true}
          showCursor={true}
          placeholder={CUSTOM_MODEL_ID_PLACEHOLDER}
          columns={Math.max(24, columns - 'Model ID:'.length - 3)}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
      </Box>
    </Box>
  )
}

function ApiKeyInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')

  useInput((input: string, key: any) => {
    if (key.escape) {
      onCancel()
      return
    }
    if (key.return) {
      onSubmit(value)
      return
    }
    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1))
      return
    }
    if (input) {
      setValue(prev => prev + input)
    }
  })

  const masked =
    value.length <= 4
      ? '*'.repeat(value.length)
      : '*'.repeat(value.length - 4) + value.slice(-4)

  return <Text>{masked || <Text dimColor>(paste or type your API key, Esc to go back)</Text>}</Text>
}

function ProviderPicker({
  initialProvider,
  onDone,
}: {
  initialProvider?: ThirdPartyProvider
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}) {
  const config = getGlobalConfig()
  const customProviders = config.customProviders
  const [phase, setPhase] = useState<ProviderPickerPhase>(
    initialProvider ? 'apikey' : 'select',
  )
  const [selectedProvider, setSelectedProvider] = useState<ThirdPartyProvider | null>(
    initialProvider ?? null,
  )
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState(() => {
    if (!initialProvider) {
      return ''
    }

    return getEffectiveBaseURL(
      initialProvider,
      getCustomProviderConfig(customProviders, initialProvider.id),
    )
  })
  const [modelId, setModelId] = useState(() => {
    if (!initialProvider || !isCustomProvider(initialProvider)) {
      return ''
    }

    return getEffectiveModelId(
      getCustomProviderConfig(customProviders, initialProvider.id),
    ) ?? ''
  })

  const removableProviders = getVisibleProviders()
    .map(provider => ({
      provider,
      config: getCustomProviderConfig(customProviders, provider.id),
    }))
    .filter(({ provider, config }) => hasProviderConfiguration(provider, config))

  useEffect(() => {
    if (phase === 'remove' && removableProviders.length === 0) {
      onDone('No providers configured to remove.', { display: 'system' })
    }
  }, [onDone, phase, removableProviders.length])

  const providerOptions = getVisibleProviders().map(provider => {
    const existing = getCustomProviderConfig(customProviders, provider.id)
    const notes: string[] = []

    if (existing?.apiKey) {
      notes.push('configured')
    }
    if (hasCustomBaseURL(provider, existing)) {
      notes.push('custom URL')
    }

    return {
      label: `${provider.name}${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`,
      value: provider.id,
      description: getProviderOptionDescription(provider, existing),
    }
  })

  providerOptions.push({
    label: 'Remove a provider configuration',
    value: '__remove__',
    description: 'Delete a saved API key and/or base URL override',
  })

  function beginEditingProvider(provider: ThirdPartyProvider): void {
    setSelectedProvider(provider)
    setApiKey('')
    setBaseURL(
      getEffectiveBaseURL(
        provider,
        getCustomProviderConfig(customProviders, provider.id),
      ),
    )
    setModelId(
      getEffectiveModelId(
        getCustomProviderConfig(customProviders, provider.id),
      ) ?? '',
    )
    setPhase('apikey')
  }

  if (phase === 'select') {
    return (
      <Box flexDirection="column">
        <Text bold>Configure Third-Party Model Provider</Text>
        <Text dimColor>Select a provider to configure its API key and base URL</Text>
        <Box marginTop={1}>
          <Select
            options={providerOptions}
            onCancel={() => {
              onDone('Cancelled.', { display: 'system' })
            }}
            onChange={(value: string) => {
              if (value === '__remove__') {
                setPhase('remove')
                setSelectedProvider(null)
                return
              }

              const provider = getVisibleProviders().find(current => current.id === value)
              if (provider) {
                beginEditingProvider(provider)
              }
            }}
          />
        </Box>
      </Box>
    )
  }

  if (phase === 'remove') {
    if (removableProviders.length === 0) {
      return null
    }

    return (
      <Box flexDirection="column">
        <Text bold>Remove Provider Configuration</Text>
        <Text dimColor>Select a provider to remove its saved API key and/or base URL override</Text>
        <Box marginTop={1}>
          <Select
            options={removableProviders.map(({ provider, config }) => ({
              label: provider.name,
              value: provider.id,
              description: getProviderOptionDescription(provider, config),
            }))}
            onCancel={() => {
              setPhase('select')
            }}
            onChange={(value: string) => {
              const provider = getVisibleProviders().find(current => current.id === value)
              if (!provider) {
                onDone(`Unknown provider "${value}".`, { display: 'system' })
                return
              }

              removeProviderConfiguration(provider)
              onDone(`Removed ${provider.name} configuration.`)
            }}
          />
        </Box>
      </Box>
    )
  }

  if (phase === 'apikey' && selectedProvider) {
    const existing = getCustomProviderConfig(customProviders, selectedProvider.id)
    const models = getModelsForProvider(selectedProvider.id)
    const showKnownModels = !isCustomProvider(selectedProvider)

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{selectedProvider.name} — Enter API Key</Text>
        {showKnownModels ? (
          <Text dimColor>Available models: {models.map(model => model.label).join(', ')}</Text>
        ) : (
          <Text dimColor>
            No predefined models. You will enter a default model ID after the base URL step.
          </Text>
        )}
        <Text dimColor>
          Current base URL: {getBaseURLDisplay(getEffectiveBaseURL(selectedProvider, existing))}
        </Text>
        <Text dimColor>
          Hint: You can also set the {selectedProvider.apiKeyEnvHint} environment variable.
        </Text>
        {existing?.apiKey ? (
          <Text dimColor>Leave the field empty to keep the saved API key.</Text>
        ) : (
          <Text dimColor>Leave the field empty to skip saving an API key for now.</Text>
        )}
        <Text dimColor>Press Enter to continue to base URL configuration.</Text>
        <Box marginTop={1}>
          <ApiKeyInput
            onSubmit={(value: string) => {
              setApiKey(value.trim())
              setPhase('baseurl')
            }}
            onCancel={() => {
              setSelectedProvider(null)
              setApiKey('')
              setPhase('select')
            }}
          />
        </Box>
      </Box>
    )
  }

  if (phase === 'baseurl' && selectedProvider) {
    const existing = getCustomProviderConfig(customProviders, selectedProvider.id)

    return (
      <BaseURLInput
        provider={selectedProvider}
        value={baseURL}
        onChange={setBaseURL}
        onSubmit={(value: string) => {
          if (isCustomProvider(selectedProvider)) {
            setBaseURL(value)
            setPhase('modelid')
            return
          }

          const result = persistProviderChange(selectedProvider, {
            apiKey,
            preserveExistingApiKey: apiKey.length === 0,
            baseURL: value,
          })

          onDone(formatProviderSavedMessage(selectedProvider, result))
        }}
        onCancel={() => {
          setBaseURL(getEffectiveBaseURL(selectedProvider, existing))
          setPhase('apikey')
        }}
      />
    )
  }

  if (phase === 'modelid' && selectedProvider && isCustomProvider(selectedProvider)) {
    const existing = getCustomProviderConfig(customProviders, selectedProvider.id)

    return (
      <CustomModelInput
        value={modelId}
        onChange={setModelId}
        onSubmit={(value: string) => {
          const result = persistProviderChange(selectedProvider, {
            apiKey,
            preserveExistingApiKey: apiKey.length === 0,
            baseURL,
            modelId: value,
          })

          onDone(formatProviderSavedMessage(selectedProvider, result))
        }}
        onCancel={() => {
          setModelId(getEffectiveModelId(existing) ?? '')
          setPhase('baseurl')
        }}
      />
    )
  }

  return null
}

const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const parsedArgs = parseProviderArgs(args)

  if (parsedArgs.type === 'help') {
    onDone(getProviderUsage(), { display: 'system' })
    return null
  }

  if (parsedArgs.type === 'list') {
    onDone(formatProviderList(), { display: 'system' })
    return null
  }

  if (parsedArgs.type === 'error') {
    onDone(parsedArgs.message, { display: 'system' })
    return null
  }

  if (parsedArgs.type === 'remove') {
    removeProviderConfiguration(parsedArgs.provider)
    onDone(`Removed ${parsedArgs.provider.name} configuration.`)
    return null
  }

  if (parsedArgs.type === 'configure') {
    const result = persistProviderChange(parsedArgs.provider, {
      apiKey: parsedArgs.apiKey,
      preserveExistingApiKey: parsedArgs.preserveExistingApiKey,
      baseURL: parsedArgs.baseURL,
    })

    onDone(formatProviderSavedMessage(parsedArgs.provider, result))
    return null
  }

  return <ProviderPicker initialProvider={parsedArgs.provider} onDone={onDone} />
}

export { call }
export default { call } satisfies LocalJSXCommandModule
