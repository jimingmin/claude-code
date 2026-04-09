import chalk from 'chalk'
import * as React from 'react'
import { useState } from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { Box, Text, useInput } from '../../ink.js'
import { Select } from '../../components/CustomSelect/index.js'
import { saveGlobalConfig, getGlobalConfig } from '../../utils/config.js'
import type { LocalJSXCommandCall, LocalJSXCommandModule } from '../../types/command.js'
import {
  THIRD_PARTY_PROVIDERS,
  getModelsForProvider,
  getCustomProviderConfig,
  type CustomProviderConfig,
  type ThirdPartyProvider,
} from '../../utils/model/thirdPartyModels.js'

// ---------------------------------------------------------------------------
// Provider selector component
// ---------------------------------------------------------------------------

function ProviderPicker({
  onDone,
}: {
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}) {
  const [phase, setPhase] = useState<'select' | 'apikey' | 'baseurl'>('select')
  const [selectedProvider, setSelectedProvider] = useState<ThirdPartyProvider | null>(null)
  const [apiKey, setApiKey] = useState('')

  const config = getGlobalConfig()
  const customProviders = (config as any).customProviders as CustomProviderConfig[] | undefined

  // Build options list
  const options = THIRD_PARTY_PROVIDERS.filter(p => p.id !== 'custom').map(p => {
    const existing = getCustomProviderConfig(customProviders, p.id)
    const status = existing?.apiKey ? ' (configured)' : ''
    return {
      label: `${p.name}${status}`,
      value: p.id,
      description: `${p.baseURL}`,
    }
  })

  options.push({
    label: 'Remove a provider configuration',
    value: '__remove__',
    description: 'Delete a saved API key',
  })

  if (phase === 'select') {
    return (
      <Box flexDirection="column">
        <Text bold>Configure Third-Party Model Provider</Text>
        <Text dimColor>Select a provider to configure its API key</Text>
        <Box marginTop={1}>
          <Select
            options={options}
            onChange={(val: string) => {
              if (val === '__remove__') {
                // Switch to remove
                setPhase('apikey')
                setSelectedProvider(null)
                return
              }
              const provider = THIRD_PARTY_PROVIDERS.find(p => p.id === val)
              if (provider) {
                setSelectedProvider(provider)
                setPhase('apikey')
              }
            }}
          />
        </Box>
      </Box>
    )
  }

  if (phase === 'apikey' && !selectedProvider) {
    // Remove flow - show configured providers
    const configured = (customProviders || []).filter(c => c.apiKey)
    if (configured.length === 0) {
      React.useEffect(() => {
        onDone('No providers configured to remove.', { display: 'system' })
      }, [])
      return null
    }
    const removeOptions = configured.map(c => {
      const p = THIRD_PARTY_PROVIDERS.find(tp => tp.id === c.providerId)
      return {
        label: p?.name || c.providerId,
        value: c.providerId,
      }
    })
    return (
      <Box flexDirection="column">
        <Text bold>Remove Provider Configuration</Text>
        <Text dimColor>Select a provider to remove its saved API key</Text>
        <Box marginTop={1}>
          <Select
            options={removeOptions}
            onChange={(val: string) => {
              saveGlobalConfig(current => ({
                ...current,
                customProviders: ((current as any).customProviders || []).filter(
                  (c: CustomProviderConfig) => c.providerId !== val,
                ),
              }))
              const p = THIRD_PARTY_PROVIDERS.find(tp => tp.id === val)
              onDone(`Removed ${p?.name || val} configuration.`)
            }}
          />
        </Box>
      </Box>
    )
  }

  if (phase === 'apikey' && selectedProvider) {
    // Show API key input
    const models = getModelsForProvider(selectedProvider.id)
    return (
      <Box flexDirection="column">
        <Text bold>{selectedProvider.name} — Enter API Key</Text>
        <Text dimColor>
          Available models: {models.map(m => m.label).join(', ')}
        </Text>
        <Text dimColor>
          Hint: You can also set the {selectedProvider.apiKeyEnvHint} environment variable.
        </Text>
        <Box marginTop={1}>
          <Text>API Key: </Text>
          <ApiKeyInput
            onSubmit={(key: string) => {
              if (!key.trim()) {
                onDone('Cancelled — no API key provided.', { display: 'system' })
                return
              }
              // Save to global config
              saveGlobalConfig(current => {
                const existing: CustomProviderConfig[] =
                  (current as any).customProviders || []
                const filtered = existing.filter(
                  c => c.providerId !== selectedProvider.id,
                )
                return {
                  ...current,
                  customProviders: [
                    ...filtered,
                    {
                      providerId: selectedProvider.id,
                      apiKey: key.trim(),
                      baseURL: selectedProvider.baseURL,
                    },
                  ],
                }
              })
              onDone(
                `${chalk.bold(selectedProvider.name)} configured successfully. ` +
                  `Use ${chalk.bold('/model')} to select a ${selectedProvider.name} model.`,
              )
            }}
            onCancel={() => {
              onDone('Cancelled.', { display: 'system' })
            }}
          />
        </Box>
      </Box>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Simple text input for API key (masked)
// ---------------------------------------------------------------------------

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

  // Mask the key (show last 4 chars)
  const masked =
    value.length <= 4
      ? '*'.repeat(value.length)
      : '*'.repeat(value.length - 4) + value.slice(-4)

  return <Text>{masked || <Text dimColor>(paste or type your API key, Esc to cancel)</Text>}</Text>
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  // Direct provider configuration via args: /provider openai sk-xxx
  if (args) {
    const parts = args.trim().split(/\s+/)
    const providerId = parts[0]
    const apiKey = parts[1]

    const provider = THIRD_PARTY_PROVIDERS.find(
      p => p.id === providerId || p.name.toLowerCase() === providerId?.toLowerCase(),
    )

    if (!provider) {
      onDone(
        `Unknown provider "${providerId}". Available: ${THIRD_PARTY_PROVIDERS.filter(p => p.id !== 'custom').map(p => p.id).join(', ')}`,
        { display: 'system' },
      )
      return null
    }

    if (!apiKey) {
      onDone(`Usage: /provider ${provider.id} <api-key>`, { display: 'system' })
      return null
    }

    saveGlobalConfig(current => {
      const existing: CustomProviderConfig[] =
        (current as any).customProviders || []
      const filtered = existing.filter(c => c.providerId !== provider.id)
      return {
        ...current,
        customProviders: [
          ...filtered,
          {
            providerId: provider.id,
            apiKey: apiKey.trim(),
            baseURL: provider.baseURL,
          },
        ],
      }
    })
    onDone(
      `${chalk.bold(provider.name)} configured. Use ${chalk.bold('/model')} to select a model.`,
    )
    return null
  }

  // Interactive picker
  return <ProviderPicker onDone={onDone} />
}

export { call }
export default { call } satisfies LocalJSXCommandModule
