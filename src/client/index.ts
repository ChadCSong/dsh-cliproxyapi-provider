import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { CpaCard } from './card.js'
import { CpaCardController, SETTINGS_NS } from './controller.js'
import { en, LOCALE_NS, zh } from './locales.js'

export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

const CSS = `
.dcpa-card{padding:12px 16px 16px;border:1px solid var(--dsh-border,rgba(128,128,128,.35));border-radius:8px}.dcpa-card h3{margin:0 0 4px;font-size:15px}.dcpa-description{margin:0 0 10px;font-size:12px;opacity:.75}.dcpa-field{margin:10px 0}.dcpa-field-head{display:flex;gap:8px;align-items:center;margin-bottom:4px;font-size:12px;font-weight:500}.dcpa-badge{font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(64,128,255,.18)}.dcpa-reset{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer;opacity:.7}.dcpa-input{width:100%;box-sizing:border-box;padding:6px 8px;font:inherit;font-size:13px;border-radius:6px;border:1px solid var(--dsh-border,rgba(128,128,128,.35));background:transparent;color:inherit}.dcpa-hint{margin-top:3px;font-size:11px;opacity:.65}.dcpa-actions{display:flex;gap:8px;align-items:center;margin-top:14px}.dcpa-button{padding:5px 12px;font:inherit;font-size:12px;border-radius:6px;border:1px solid var(--dsh-border,rgba(128,128,128,.35));background:transparent;color:inherit;cursor:pointer}.dcpa-button:disabled{opacity:.4;cursor:default}.dcpa-primary{background:var(--dsh-accent,rgba(64,128,255,.85));border-color:transparent;color:#fff}.dcpa-failed{font-size:11px;color:#e5484d}
`

export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-cliproxyapi locales')
  if (typeof document !== 'undefined') {
    const style = document.createElement('style'); style.dataset.plugin = 'dsh-cliproxyapi'; style.textContent = CSS; document.head.appendChild(style)
    ctx.effect(() => () => { style.remove() }, 'dsh-cliproxyapi styles')
  }
  const controller = new CpaCardController(ctx.settingsScope.bind({ namespace: SETTINGS_NS }), api)
  ctx.effect(() => () => { controller.dispose() }, 'dsh-cliproxyapi model discovery')
  ctx.effect(() => ctx.remote.$on('credentials/updated', ref => { controller.refreshCredential(ref) }), 'dsh-cliproxyapi credential updates')
  ctx.effect(() => ctx.remote.$on('llm/adapters-updated', () => { controller.refreshRegisteredModels() }), 'dsh-cliproxyapi model updates')
  const entry = { name: 'settings.plugin.item', key: SETTINGS_NS, id: SETTINGS_NS, order: 25, locale: LOCALE_NS, inject: () => controller.inject() } as const
  ctx.slots.inject('settings.plugin.item', function* () { yield ctx.slots.register(entry, CpaCard) })
}
