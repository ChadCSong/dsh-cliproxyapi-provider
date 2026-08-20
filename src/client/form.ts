import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope, SettingsScopeSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { CardActions, CardFieldState, CardSecretSpec, CardShell } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'

export type { CardActions, CardFieldState, CardShell }
export type CardApi = Pick<ConnectionHandle['api'], 'credentials' | 'settings' | 'llm'>

type FieldWrite = { kind: 'set'; value: unknown } | { kind: 'clear' }

export interface CardFieldSpec {
  field: string
  path: readonly string[]
  format: (value: unknown) => string
  parse: (text: string) => FieldWrite | undefined
}

interface StagedEdit { text: string; clear: boolean }
interface PlannedWrite { run: (() => Promise<boolean>) | undefined }

function atPath(value: unknown, path: readonly string[]): unknown {
  let node = value
  for (const segment of path) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return node
}

export function textField(field: string): CardFieldSpec {
  return {
    field,
    path: [field],
    format: value => typeof value === 'string' ? value : '',
    parse: text => text.trim() === '' ? { kind: 'clear' } : { kind: 'set', value: text.trim() },
  }
}

export function numberField(field: string): CardFieldSpec {
  return {
    field,
    path: [field],
    format: value => typeof value === 'number' ? String(value) : '',
    parse: (text) => {
      if (text.trim() === '') return { kind: 'clear' }
      const value = Number(text)
      return Number.isFinite(value) ? { kind: 'set', value } : undefined
    },
  }
}

export function choiceField(field: string, choices: readonly string[]): CardFieldSpec {
  return {
    field,
    path: [field],
    format: value => typeof value === 'string' ? value : '',
    parse: text => text === '' ? { kind: 'clear' } : choices.includes(text) ? { kind: 'set', value: text } : undefined,
  }
}

export function booleanField(field: string): CardFieldSpec {
  return {
    field,
    path: [field],
    format: value => value === true ? 'true' : value === false ? 'false' : '',
    parse: text => text === '' ? { kind: 'clear' } : text === 'true' ? { kind: 'set', value: true } : text === 'false' ? { kind: 'set', value: false } : undefined,
  }
}

export class CardForm<T> {
  private readonly specs = new Map<string, CardFieldSpec>()
  private readonly secrets = new Map<string, CardSecretSpec>()
  private readonly staged = new Map<string, StagedEdit>()
  private readonly listeners = new Set<() => void>()
  private saving = false
  private failed = false

  constructor(
    private readonly scope: SettingsScope<T>,
    private readonly api: CardApi,
    private readonly ns: string,
    specs: CardFieldSpec[],
    secrets: CardSecretSpec[] = [],
  ) {
    for (const spec of specs) this.specs.set(spec.field, spec)
    for (const secret of secrets) this.secrets.set(secret.field, secret)
    scope.subscribe(() => { this.publish() })
  }

  bind<S>(project: () => S): SnapshotStore<S> {
    const store = createSnapshotStore(project())
    this.listeners.add(() => { store.set(project()) })
    return store
  }

  shell(): CardShell {
    const plan = this.plan()
    const snapshot = this.scope.getSnapshot()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some(item => item.run === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  field(field: string): CardFieldState {
    const staged = this.staged.get(field)
    if (this.secrets.has(field)) return { text: staged?.text ?? '', overridden: false, invalid: false }
    const spec = this.spec(field)
    if (staged === undefined) {
      return { text: spec.format(this.value(field)), overridden: this.stored(field), invalid: false }
    }
    const parsed = staged.clear ? { kind: 'clear' as const } : spec.parse(staged.text)
    return { text: staged.text, overridden: parsed?.kind === 'set', invalid: parsed === undefined }
  }

  actions(): CardActions {
    return {
      edit: (field, text) => { this.staged.set(field, { text, clear: false }); this.failed = false; this.publish() },
      resetField: (field) => {
        const spec = this.spec(field)
        this.staged.set(field, { text: spec.format(atPath(this.snapshot().base, spec.path)), clear: true })
        this.failed = false
        this.publish()
      },
      save: () => { void this.save() },
      discard: () => { this.staged.clear(); this.failed = false; this.publish() },
    }
  }

  private async save(): Promise<void> {
    const plan = this.plan()
    if (plan.length === 0 || this.saving || plan.some(item => item.run === undefined)) return
    this.saving = true
    this.failed = false
    this.publish()
    let ok = true
    for (const item of plan) ok = (await item.run!()) && ok
    if (ok) this.staged.clear()
    this.saving = false
    this.failed = !ok
    this.publish()
  }

  private plan(): PlannedWrite[] {
    const plan: PlannedWrite[] = []
    for (const [field, staged] of this.staged) {
      const secret = this.secrets.get(field)
      if (secret !== undefined) {
        if (staged.text.trim() !== '') plan.push({ run: () => secret.write(staged.text.trim()) })
        continue
      }
      const spec = this.spec(field)
      if (staged.clear) {
        if (this.stored(field)) plan.push({ run: () => this.mutate({ op: 'unset', path: spec.path }) })
        continue
      }
      if (staged.text === spec.format(this.value(field))) continue
      const parsed = spec.parse(staged.text)
      if (parsed === undefined) plan.push({ run: undefined })
      else if (parsed.kind === 'clear') plan.push({ run: () => this.mutate({ op: 'unset', path: spec.path }) })
      else plan.push({ run: () => this.mutate({ op: 'set', path: spec.path, value: parsed.value }) })
    }
    return plan
  }

  private async mutate(op: { op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] }): Promise<boolean> {
    try {
      const revision = this.snapshot().revision
      const response = await this.api.settings.mutate({
        ns: this.ns,
        ops: [{ ...op, path: [...op.path] }],
        ...revision === undefined ? {} : { expectedRevision: revision },
      })
      return response.result.ok
    } catch {
      return false
    }
  }

  private spec(field: string): CardFieldSpec {
    const value = this.specs.get(field)
    if (value === undefined) throw new Error(`unknown field ${field}`)
    return value
  }

  private snapshot(): SettingsScopeSnapshot<T> { return this.scope.getSnapshot() }
  private value(field: string): unknown { return atPath(this.snapshot().value, this.spec(field).path) }
  private stored(field: string): boolean { return atPath(this.snapshot().user, this.spec(field).path) !== undefined }
  private publish(): void { for (const listener of this.listeners) listener() }
}
