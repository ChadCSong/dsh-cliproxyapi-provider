const LOCAL_CANDIDATES = [
  'http://127.0.0.1:8317',
  'http://localhost:8317',
  'http://[::1]:8317',
] as const

const MAX_CATALOG_BYTES = 4 * 1024 * 1024

export interface CpaCatalogModel {
  id: string
  name?: string
  ownedBy?: string
  provider?: string
  contextWindow?: number
  maxTokens?: number
  inputModalities: readonly string[]
  reasoning: boolean
  reasoningLevels: readonly string[]
  serviceTiers: readonly string[]
}

export interface CpaDiscoveryResult {
  rootURL: string
  modelsURL: string
  models: readonly CpaCatalogModel[]
}

export interface DiscoverOptions {
  baseURL?: string
  environmentBaseURL?: string
  apiKey?: string
  timeoutMs: number
  signal?: AbortSignal
  fetch?: typeof fetch
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
}

function catalogArray(payload: unknown): unknown[] | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const source = payload as { data?: unknown; models?: unknown }
  if (Array.isArray(source.models)) return source.models
  if (Array.isArray(source.data)) return source.data
  return undefined
}

function reasoningLevels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const levels: string[] = []
  for (const item of value) {
    const raw = typeof item === 'string'
      ? item
      : typeof item === 'object' && item !== null && typeof (item as { effort?: unknown }).effort === 'string'
        ? (item as { effort: string }).effort
        : ''
    const normalized = raw.trim().toLowerCase()
    const level = normalized === 'none' ? 'off' : normalized
    if (level !== '' && !levels.includes(level)) levels.push(level)
  }
  return levels
}

function serviceTiers(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const tiers: string[] = []
  for (const item of value) {
    const raw = typeof item === 'string'
      ? item
      : typeof item === 'object' && item !== null
        ? ((item as { id?: unknown }).id ?? (item as { name?: unknown }).name)
        : undefined
    if (typeof raw !== 'string') continue
    const normalized = raw.trim()
    if (normalized !== '' && !tiers.includes(normalized)) tiers.push(normalized)
  }
  return tiers
}

function firstPositiveInteger(source: Record<string, unknown>, fields: readonly string[]): number | undefined {
  for (const field of fields) {
    const value = positiveInteger(source[field])
    if (value !== undefined) return value
  }
  return undefined
}

export function normalizeCpaRoot(raw: string): string {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw.trim()) ? raw.trim() : `http://${raw.trim()}`
  const url = new URL(withScheme)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`unsupported protocol ${url.protocol}`)
  }
  url.search = ''
  url.hash = ''
  let path = url.pathname.replace(/\/+$/, '')
  path = path.replace(/\/(?:v1|backend-api)$/i, '')
  url.pathname = path === '' ? '/' : `${path}/`
  return url.toString().replace(/\/$/, '')
}

export function discoveryCandidates(options: Pick<DiscoverOptions, 'baseURL' | 'environmentBaseURL'>): string[] {
  const raw = [options.baseURL, options.environmentBaseURL, ...LOCAL_CANDIDATES]
  const result: string[] = []
  for (const candidate of raw) {
    if (candidate === undefined || candidate.trim() === '') continue
    try {
      const normalized = normalizeCpaRoot(candidate)
      if (!result.includes(normalized)) result.push(normalized)
    } catch {
      if (candidate === options.baseURL) throw new Error(`dsh-cliproxyapi: invalid baseURL "${candidate}"`)
    }
  }
  return result
}

export function parseCatalog(payload: unknown): CpaCatalogModel[] {
  const catalog = catalogArray(payload)
  if (catalog === undefined) throw new Error('response does not contain a models or data array')
  const models = new Map<string, CpaCatalogModel>()
  for (const item of catalog) {
    if (typeof item !== 'object' || item === null) continue
    const source = item as Record<string, unknown>
    if (String(source.visibility ?? '').toLowerCase() === 'hide') continue
    const rawId = source.slug ?? source.id
    const id = typeof rawId === 'string' ? rawId.trim() : ''
    if (id === '' || models.has(id)) continue
    const inputModalities = stringArray(source.input_modalities ?? source.inputModalities).map(value => value.toLowerCase())
    const levels = reasoningLevels(source.supported_reasoning_levels ?? source.reasoning_levels)
    const contextWindow = firstPositiveInteger(source, ['context_window', 'max_context_window', 'context_length', 'contextWindow'])
    const maxTokens = firstPositiveInteger(source, ['max_output_tokens', 'max_tokens', 'maxTokens'])
    const rawName = source.display_name ?? source.name
    models.set(id, {
      id,
      ...typeof rawName === 'string' && rawName.trim() !== '' ? { name: rawName.trim() } : {},
      ...typeof source.owned_by === 'string' ? { ownedBy: source.owned_by } : {},
      ...typeof source.provider === 'string' ? { provider: source.provider } : {},
      ...contextWindow === undefined ? {} : { contextWindow },
      ...maxTokens === undefined ? {} : { maxTokens },
      inputModalities,
      reasoning: source.reasoning === true || levels.some(level => level !== 'off'),
      reasoningLevels: levels,
      serviceTiers: serviceTiers(source.service_tiers),
    })
  }
  return [...models.values()]
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_CATALOG_BYTES) throw new Error('catalog is larger than 4 MiB')
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_CATALOG_BYTES) throw new Error('catalog is larger than 4 MiB')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('catalog is not valid JSON')
  }
}

export async function discoverCpa(options: DiscoverOptions): Promise<CpaDiscoveryResult> {
  const fetchImpl = options.fetch ?? fetch
  const failures: string[] = []
  for (const rootURL of discoveryCandidates(options)) {
    // CPA's enriched Codex catalog contract is selected with client_version=pi.
    // DSH's official llm-pi-ai adapter consumes the mapped result afterwards.
    const modelsURL = `${rootURL}/v1/models?client_version=pi`
    const timeout = AbortSignal.timeout(options.timeoutMs)
    const signal = options.signal === undefined ? timeout : AbortSignal.any([options.signal, timeout])
    try {
      const response = await fetchImpl(modelsURL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...options.apiKey === undefined ? {} : { Authorization: `Bearer ${options.apiKey}` },
        },
        signal,
      })
      if (!response.ok) {
        failures.push(`${rootURL}: HTTP ${response.status}`)
        continue
      }
      const models = parseCatalog(await readBoundedJson(response))
      return { rootURL, modelsURL, models }
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason
      failures.push(`${rootURL}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`dsh-cliproxyapi: no usable CPA service found (${failures.join('; ')})`)
}
