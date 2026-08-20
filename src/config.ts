import Schema from '@deepseek-ai/schemastery'

export const DEFAULT_PROVIDER = 'cliproxyapi'
export const DEFAULT_DISPLAY_NAME = 'CLIProxyAPI (auto)'
export const DEFAULT_API_KEY_ENV = 'CLIPROXYAPI_API_KEY'
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 300
export const DEFAULT_PROBE_TIMEOUT_MS = 2_000

export type CpaProtocol = 'openai-completions' | 'openai-responses'

export interface Config {
  enabled?: boolean
  provider?: string
  displayName?: string
  /** Optional explicit CPA root. Empty means local auto-discovery. */
  baseURL?: string
  /** Credential/environment reference, never the literal secret. */
  apiKeyEnv?: string
  /** Model used to turn images into text before a text-only main model runs. */
  visionModel?: string
  protocol?: CpaProtocol
  refreshIntervalSeconds?: number
  probeTimeoutMs?: number
}

export const Config: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(true),
  provider: Schema.string().default(DEFAULT_PROVIDER),
  displayName: Schema.string().default(DEFAULT_DISPLAY_NAME),
  baseURL: Schema.string().default(''),
  apiKeyEnv: Schema.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  visionModel: Schema.string().default(''),
  protocol: Schema.union(['openai-completions', 'openai-responses']).default('openai-completions'),
  refreshIntervalSeconds: Schema.number().step(1).min(15).max(86_400).default(DEFAULT_REFRESH_INTERVAL_SECONDS),
  probeTimeoutMs: Schema.number().step(1).min(250).max(30_000).default(DEFAULT_PROBE_TIMEOUT_MS),
})

export interface ResolvedConfig {
  enabled: boolean
  provider: string
  displayName: string
  baseURL: string
  apiKeyEnv: string
  visionModel: string
  protocol: CpaProtocol
  refreshIntervalSeconds: number
  probeTimeoutMs: number
}

export function resolveConfig(config: Config): ResolvedConfig {
  const provider = (config.provider ?? DEFAULT_PROVIDER).trim()
  if (provider.length === 0) throw new Error('dsh-cliproxyapi: provider must be non-empty')
  const displayName = (config.displayName ?? DEFAULT_DISPLAY_NAME).trim() || DEFAULT_DISPLAY_NAME
  const apiKeyEnv = (config.apiKeyEnv ?? DEFAULT_API_KEY_ENV).trim()
  if (apiKeyEnv.length === 0) throw new Error('dsh-cliproxyapi: apiKeyEnv must be non-empty')
  return {
    enabled: config.enabled ?? true,
    provider,
    displayName,
    baseURL: (config.baseURL ?? '').trim(),
    apiKeyEnv,
    visionModel: (config.visionModel ?? '').trim(),
    protocol: config.protocol ?? 'openai-completions',
    refreshIntervalSeconds: config.refreshIntervalSeconds ?? DEFAULT_REFRESH_INTERVAL_SECONDS,
    probeTimeoutMs: config.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
  }
}
