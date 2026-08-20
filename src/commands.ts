import type { Context } from '@deepseek-ai/cordis'
import type { CpaRuntime } from './runtime.js'

interface CommandResult {
  kind: 'success' | 'error'
  text?: string
}

interface CommandsLike {
  register(definition: {
    name: string
    description: string
    handler: () => CommandResult | Promise<CommandResult>
  }): unknown
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    commands: CommandsLike
  }
}

function renderStatus(runtime: CpaRuntime): string {
  const status = runtime.status()
  return [
    `CPA: ${status.state}`,
    status.endpoint === undefined ? undefined : `Endpoint: ${status.endpoint}`,
    `Models: ${status.modelCount}`,
    status.visionModel === undefined ? undefined : `Vision: ${status.visionModel}`,
    status.refreshedAt === undefined ? undefined : `Refreshed: ${status.refreshedAt}`,
    status.error === undefined ? undefined : `Error: ${status.error}`,
  ].filter((line): line is string => line !== undefined).join('\n')
}

export function registerCommands(ctx: Context, runtime: CpaRuntime): void {
  ctx.inject(['commands'], commandCtx => {
    commandCtx.commands.register({
      name: 'cpa-status',
      description: 'Show CLIProxyAPI discovery and model synchronization status.',
      handler: () => ({ kind: 'success', text: renderStatus(runtime) }),
    })
    commandCtx.commands.register({
      name: 'cpa-refresh',
      description: 'Probe CLIProxyAPI now and refresh the DSH model catalog.',
      handler: async () => {
        await runtime.refresh()
        const status = runtime.status()
        return status.state === 'connected'
          ? { kind: 'success', text: renderStatus(runtime) }
          : { kind: 'error', text: renderStatus(runtime) }
      },
    })
  })
}
