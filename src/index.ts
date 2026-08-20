import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { Config, resolveConfig, type Config as ConfigType, type ResolvedConfig } from './config.js'
import { registerCommands } from './commands.js'
import { CpaRuntime } from './runtime.js'
import { CpaVisionRouter } from './vision-routing.js'
import { installDeepSeekVisionBridge } from './deepseek-bridge.js'

export { Config } from './config.js'
export type { Config as CpaConfig, ResolvedConfig } from './config.js'
export { discoverCpa, discoveryCandidates, normalizeCpaRoot, parseCatalog } from './discovery.js'
export type { CpaCatalogModel, CpaDiscoveryResult } from './discovery.js'
export { buildPiAiRoute } from './profile.js'
export { CpaRuntime } from './runtime.js'
export { CpaVisionRouter } from './vision-routing.js'
export type { VisionRoutingState } from './vision-routing.js'
export {
  DEEPSEEK_SOURCE_PROVIDER,
  DEEPSEEK_VISION_BRIDGE_PROVIDER,
  DeepSeekVisionBridgeAdapter,
  installDeepSeekVisionBridge,
} from './deepseek-bridge.js'

export const name = 'dsh-cliproxyapi'
export const inject = ['settings', 'credentials', 'llm']

const NS = settingsNamespace('dsh-cliproxyapi')

export function apply(ctx: Context, config: ConfigType): void {
  let source: () => ConfigType = () => config
  let resolved: ResolvedConfig = resolveConfig(config)
  let timer: ReturnType<typeof setInterval> | undefined

  const resolveApiKey = async (ref: string): Promise<string | undefined> => {
    const credential = credentialRef(ref)
    const credentials = ctx.get('credentials')
    const stored = credentials === undefined ? undefined : await credentials.resolve(credential)
    const raw = stored?.value ?? launchEnvironmentOf(ctx).get(credential)?.value
    const value = raw?.trim()
    return value === undefined || value === '' ? undefined : value
  }

  const runtime = new CpaRuntime({
    settings: ctx.settings,
    config: () => resolved,
    resolveApiKey,
    environmentBaseURL: () => launchEnvironmentOf(ctx).get('CLIPROXYAPI_BASE_URL')?.value,
    logger: ctx.logger,
  })
  const visionRouter = new CpaVisionRouter(ctx.llm, () => runtime.visionRouting())
  ctx.on('llm/stream', (options, next) => visionRouter.stream(options, next))
  installDeepSeekVisionBridge(ctx.llm)

  const reschedule = (): void => {
    resolved = resolveConfig(source())
    if (timer !== undefined) clearInterval(timer)
    timer = setInterval(() => { void runtime.refresh() }, resolved.refreshIntervalSeconds * 1_000)
    void runtime.refresh()
  }

  installSettingsSection(ctx, NS, Config, config, {
    setSource: current => { source = current },
    onChange: reschedule,
    validate: resolveConfig,
  })

  registerCommands(ctx, runtime)
  ctx.on('credentials/updated', ref => {
    if (ref === resolved.apiKeyEnv) void runtime.refresh()
  })
  ctx.effect(() => () => {
    if (timer !== undefined) clearInterval(timer)
    runtime.dispose()
  }, 'dsh-cliproxyapi refresh loop')
}
