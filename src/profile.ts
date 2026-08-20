import type { CpaCatalogModel, CpaDiscoveryResult } from './discovery.js'
import type { ResolvedConfig } from './config.js'

const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export interface PiAiModelProfile {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  input: Array<'text' | 'image'>
  reasoningEfforts?: Record<string, string | null>
}

export interface PiAiRouteProfile {
  displayName: string
  api: 'openai-completions' | 'openai-responses'
  baseURL: string
  models: PiAiModelProfile[]
  apiKeyEnv?: string
  headers?: Record<string, string>
}

export interface BuiltRoute {
  profile: PiAiRouteProfile
  visionModel?: string
}

function supportedReasoning(model: CpaCatalogModel): Record<string, string | null> | undefined {
  if (!model.reasoning) return undefined
  const declared = new Set(model.reasoningLevels)
  const levels = declared.size === 0 ? REASONING_LEVELS : REASONING_LEVELS.filter(level => declared.has(level))
  const result: Record<string, string | null> = {}
  for (const level of levels) result[level] = level === 'off' ? null : level
  return Object.keys(result).length === 0 ? undefined : result
}

function modelProfile(model: CpaCatalogModel, forcedVisionModel: string): PiAiModelProfile {
  const acceptsImage = forcedVisionModel === model.id || model.inputModalities.includes('image')
  const reasoningEfforts = supportedReasoning(model)
  return {
    id: model.id,
    ...model.name === undefined ? {} : { name: model.name },
    ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
    ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
    input: acceptsImage ? ['text', 'image'] : ['text'],
    ...reasoningEfforts === undefined ? {} : { reasoningEfforts },
  }
}

function modelFamily(model: CpaCatalogModel): string {
  const label = (model.name ?? model.id).trim().toLowerCase()
  const known = label.match(/^(gpt-oss|gemini|claude|gpt|grok|deepseek|qwen|glm|kimi|minimax|mistral|llama|o(?=\d))/)?.[1]
  if (known !== undefined) return known
  return label.split(/[\s_/-]*\d/, 1)[0]?.replace(/[\s_/-]+$/, '') || label
}

function modelVersion(model: CpaCatalogModel): number[] {
  const labels = [model.name, model.id]
  for (const label of labels) {
    if (label === undefined) continue
    const match = label.match(/(?:^|[^\d])(\d+(?:[.-]\d+)*)/)
    if (match?.[1] !== undefined) return match[1].split(/[.-]/).map(Number)
  }
  return []
}

function compareVersionDescending(left: CpaCatalogModel, right: CpaCatalogModel): number {
  const a = modelVersion(left)
  const b = modelVersion(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (b[index] ?? 0) - (a[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** Preserve CPA's provider-family order while putting newer versions first inside each family. */
export function sortModelsNewestFirst(models: readonly CpaCatalogModel[]): CpaCatalogModel[] {
  const groups = new Map<string, CpaCatalogModel[]>()
  for (const model of models) {
    const family = modelFamily(model)
    const group = groups.get(family)
    if (group === undefined) groups.set(family, [model])
    else group.push(model)
  }
  return [...groups.values()].flatMap(group => group.toSorted(compareVersionDescending))
}

export function buildPiAiRoute(
  config: ResolvedConfig,
  discovery: CpaDiscoveryResult,
  hasApiKey: boolean,
): BuiltRoute {
  const explicitVision = config.visionModel !== '' && discovery.models.some(model => model.id === config.visionModel)
    ? config.visionModel
    : undefined
  const detectedVision = discovery.models.find(model => model.inputModalities.includes('image'))?.id
  const visionModel = explicitVision ?? detectedVision
  const orderedModels = sortModelsNewestFirst(discovery.models)
  return {
    profile: {
      displayName: config.displayName,
      api: config.protocol,
      baseURL: `${discovery.rootURL}/v1`,
      models: orderedModels.map(model => modelProfile(model, explicitVision ?? '')),
      ...(hasApiKey
        ? { apiKeyEnv: config.apiKeyEnv }
        : { headers: { Authorization: 'Bearer cpa-local' } }),
    },
    ...visionModel === undefined ? {} : { visionModel },
  }
}
