import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'provider',
  description: 'Configure third-party model providers, API keys, and base URLs',
  argumentHint: '[provider] [api-key] [base-url] [model-id]',
  immediate: true,
  load: () => import('./provider.js'),
} satisfies Command
