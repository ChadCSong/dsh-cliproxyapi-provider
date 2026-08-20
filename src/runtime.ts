import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { ResolvedConfig } from './config.js'
import { discoverCpa } from './discovery.js'
import { buildPiAiRoute, type PiAiRouteProfile } from './profile.js'

const PI_AI_NS = settingsNamespace('llm-pi-ai')

export interface CpaStatus {
  state: 'idle' | 'probing' | 'connected' | 'error' | 'disabled'
  endpoint?: string
  modelCount: number
  visionModel?: string
  refreshedAt?: string
  error?: string
}

export interface RuntimeLogger {
  info(message: string): void
  warn(message: string): void
  error(error: unknown): void
}

export interface CpaRuntimeOptions {
  settings: Pick<SettingsProvider, 'mutate'>
  config: () => ResolvedConfig
  resolveApiKey: (ref: string) => Promise<string | undefined>
  environmentBaseURL: () => string | undefined
  logger: RuntimeLogger
  fetch?: typeof fetch
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export class CpaRuntime {
  private activeProvider: string | undefined
  private activeProfile: PiAiRouteProfile | undefined
  private running: Promise<void> | undefined
  private rerun = false
  private controller = new AbortController()
  private currentStatus: CpaStatus = { state: 'idle', modelCount: 0 }

  constructor(private readonly options: CpaRuntimeOptions) {}

  status(): CpaStatus {
    return { ...this.currentStatus }
  }

  refresh(): Promise<void> {
    if (this.running !== undefined) {
      this.rerun = true
      return this.running
    }
    this.running = this.runLoop().finally(() => { this.running = undefined })
    return this.running
  }

  dispose(): void {
    this.controller.abort(new Error('dsh-cliproxyapi disposed'))
  }

  private async runLoop(): Promise<void> {
    do {
      this.rerun = false
      try {
        await this.syncOnce()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.currentStatus = { ...this.currentStatus, state: 'error', error: message }
        this.options.logger.warn(message)
      }
    } while (this.rerun && !this.controller.signal.aborted)
  }

  private async syncOnce(): Promise<void> {
    const config = this.options.config()
    if (!config.enabled) {
      if (this.activeProvider !== undefined) {
        await this.options.settings.mutate(PI_AI_NS, [{ op: 'unset', path: ['providers', this.activeProvider] }])
      }
      this.activeProvider = undefined
      this.activeProfile = undefined
      this.currentStatus = { state: 'disabled', modelCount: 0 }
      return
    }

    const { error: _previousError, ...previousStatus } = this.currentStatus
    this.currentStatus = { ...previousStatus, state: 'probing' }
    const apiKey = await this.options.resolveApiKey(config.apiKeyEnv)
    const environmentBaseURL = this.options.environmentBaseURL()
    const result = await discoverCpa({
      baseURL: config.baseURL,
      ...environmentBaseURL === undefined ? {} : { environmentBaseURL },
      ...apiKey === undefined ? {} : { apiKey },
      timeoutMs: config.probeTimeoutMs,
      signal: this.controller.signal,
      ...this.options.fetch === undefined ? {} : { fetch: this.options.fetch },
    })
    const built = buildPiAiRoute(config, result, apiKey !== undefined)

    if (this.activeProvider !== config.provider || !sameJson(this.activeProfile, built.profile)) {
      await this.options.settings.mutate(PI_AI_NS, [
        { op: 'set', path: ['providers', config.provider], value: built.profile },
        ...(this.activeProvider !== undefined && this.activeProvider !== config.provider
          ? [{ op: 'unset' as const, path: ['providers', this.activeProvider] }]
          : []),
      ])
      this.activeProvider = config.provider
      this.activeProfile = built.profile
    }

    this.currentStatus = {
      state: 'connected',
      endpoint: result.rootURL,
      modelCount: result.models.length,
      ...built.visionModel === undefined ? {} : { visionModel: built.visionModel },
      refreshedAt: new Date().toISOString(),
    }
    this.options.logger.info(
      `dsh-cliproxyapi: connected to ${result.rootURL}; synchronized ${result.models.length} model(s)`
      + (built.visionModel === undefined ? '' : `; vision=${built.visionModel}`),
    )
  }
}
