import type { SettingsScope, SettingsScopeSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { CardActions, CardFieldState, CardShell } from './form.js'
import { booleanField, CardForm, choiceField, numberField, textField, type CardApi } from './form.js'
import { modelListingBaseURLs } from './model-discovery.js'

export const SETTINGS_NS = 'dsh-cliproxyapi'
const DEFAULT_KEY_REF = 'CLIPROXYAPI_API_KEY'
const API_KEY_FIELD = 'apiKey'

interface Section {
  enabled?: boolean
  provider?: string
  baseURL?: string
  apiKeyEnv?: string
  visionModel?: string
  protocol?: string
  refreshIntervalSeconds?: number
  probeTimeoutMs?: number
}

interface CredentialState { ref: string; configured: boolean; writable: boolean }

export interface VisionModelChoice { value: string; label: string }
export type ModelLoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface CpaCardState extends CardShell {
  enabled: CardFieldState
  baseURL: CardFieldState
  apiKeyEnv: CardFieldState
  visionModel: CardFieldState
  protocol: CardFieldState
  refreshIntervalSeconds: CardFieldState
  probeTimeoutMs: CardFieldState
  apiKey: CardFieldState
  apiKeyConfigured: boolean
  apiKeyWritable: boolean
  visionChoices: readonly VisionModelChoice[]
  modelLoadState: ModelLoadState
}

export interface CpaCardFace extends CardActions {
  hooks: { cpaCard: SnapshotStore<CpaCardState> }
  refreshModels(): void
}

function refOf(snapshot: SettingsScopeSnapshot<Section>): string {
  const ref = snapshot.value?.apiKeyEnv
  return typeof ref === 'string' && ref.length > 0 ? ref : DEFAULT_KEY_REF
}

export class CpaCardController {
  private readonly form: CardForm<Section>
  private readonly store: SnapshotStore<CpaCardState>
  private credential: CredentialState = { ref: '', configured: false, writable: true }
  private visionChoices: VisionModelChoice[] = []
  private modelLoadState: ModelLoadState = 'idle'
  private discoveryGeneration = 0
  private discoveryTimer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly scope: SettingsScope<Section>, private readonly api: CardApi) {
    this.form = new CardForm(scope, api, SETTINGS_NS, [
      booleanField('enabled'),
      textField('baseURL'),
      textField('apiKeyEnv'),
      textField('visionModel'),
      choiceField('protocol', ['openai-completions', 'openai-responses']),
      numberField('refreshIntervalSeconds'),
      numberField('probeTimeoutMs'),
    ], [{ field: API_KEY_FIELD, write: value => this.writeKey(value) }])
    this.store = this.form.bind(() => this.project())
    scope.subscribe(() => { void this.readCredential(); this.scheduleModelRefresh(250) })
    void this.readCredential().then(() => { this.scheduleModelRefresh(0) })
  }

  inject(): CpaCardFace {
    const actions = this.form.actions()
    return {
      hooks: { cpaCard: this.store },
      ...actions,
      edit: (field, text) => {
        actions.edit(field, text)
        if (field === 'baseURL' || field === API_KEY_FIELD || field === 'protocol') this.scheduleModelRefresh(600)
      },
      resetField: field => {
        actions.resetField(field)
        if (field === 'baseURL' || field === 'protocol') this.scheduleModelRefresh(0)
      },
      discard: () => { actions.discard(); this.scheduleModelRefresh(0) },
      refreshModels: () => { this.scheduleModelRefresh(0) },
    }
  }

  refreshCredential(ref: string): void {
    if (ref === this.credential.ref) void this.readCredential().then(() => { this.scheduleModelRefresh(0) })
  }

  refreshRegisteredModels(): void { this.scheduleModelRefresh(150) }

  dispose(): void {
    this.discoveryGeneration += 1
    if (this.discoveryTimer !== undefined) clearTimeout(this.discoveryTimer)
  }

  private project(): CpaCardState {
    return {
      ...this.form.shell(),
      enabled: this.form.field('enabled'),
      baseURL: this.form.field('baseURL'),
      apiKeyEnv: this.form.field('apiKeyEnv'),
      visionModel: this.form.field('visionModel'),
      protocol: this.form.field('protocol'),
      refreshIntervalSeconds: this.form.field('refreshIntervalSeconds'),
      probeTimeoutMs: this.form.field('probeTimeoutMs'),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
      visionChoices: this.visionChoices,
      modelLoadState: this.modelLoadState,
    }
  }

  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    try {
      const response = await this.api.credentials.describe({ refs: [ref] })
      if (!response.result.ok || ref !== refOf(this.scope.getSnapshot())) return
      const view = response.result.value.credentials[ref]
      this.credential = { ref, configured: view?.configured ?? false, writable: view?.writable ?? true }
      this.store.set(this.project())
    } catch {}
  }

  private async writeKey(value: string): Promise<boolean> {
    try { await this.api.credentials.set({ ref: refOf(this.scope.getSnapshot()), value }) } catch {}
    await this.readCredential()
    return this.credential.configured
  }

  private scheduleModelRefresh(delayMs: number): void {
    if (this.discoveryTimer !== undefined) clearTimeout(this.discoveryTimer)
    this.discoveryTimer = setTimeout(() => { this.discoveryTimer = undefined; void this.loadModels() }, delayMs)
  }

  private async loadModels(): Promise<void> {
    const generation = ++this.discoveryGeneration
    this.modelLoadState = 'loading'
    this.store.set(this.project())
    try {
      const key = this.form.field(API_KEY_FIELD).text.trim()
      const baseURL = this.form.field('baseURL').text.trim()
      const protocol = this.form.field('protocol').text || 'openai-completions'
      const models = key === ''
        ? await this.registeredModels()
        : await this.discoverDraftModels(baseURL, key, protocol)
      if (generation !== this.discoveryGeneration) return
      this.visionChoices = models.map(model => ({
        value: model.id,
        label: model.name === undefined || model.name === model.id ? model.id : `${model.name} (${model.id})`,
      }))
      this.modelLoadState = models.length === 0 ? 'idle' : 'ready'
    } catch {
      if (generation !== this.discoveryGeneration) return
      this.visionChoices = []
      this.modelLoadState = 'error'
    }
    this.store.set(this.project())
  }

  private async registeredModels(): Promise<Array<{ id: string; name?: string }>> {
    const response = await this.api.llm.models({})
    if (!response.result.ok) throw new Error(response.result.error.message)
    const provider = this.scope.getSnapshot().value?.provider?.trim() || 'cliproxyapi'
    const group = response.result.value.groups.find(item => item.id === provider)
    return group?.models.map(model => ({ id: model.id, name: model.name })) ?? []
  }

  private async discoverDraftModels(
    baseURL: string,
    apiKey: string,
    protocol: string,
  ): Promise<Array<{ id: string; name?: string }>> {
    let lastError: Error | undefined
    for (const candidate of modelListingBaseURLs(baseURL)) {
      try {
        const response = await this.api.llm.discoverModels({
          settingsNs: 'llm-pi-ai',
          baseURL: candidate,
          api: protocol,
          apiKey,
        })
        if (!response.result.ok) throw new Error(response.result.error.message)
        return response.result.value.models
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }
    throw lastError ?? new Error('no CPA endpoint available')
  }
}
