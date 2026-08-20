import {
  LlmAdapter,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmProviderInfo,
  type LlmResolvedModelInfo,
  type LlmRuntime,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'

export const DEEPSEEK_SOURCE_PROVIDER = 'deepseek-official'
export const DEEPSEEK_VISION_BRIDGE_PROVIDER = 'deepseek-official-cpa-vision'

/**
 * A public-API-only alias for DSH's official DeepSeek route. It advertises
 * image acceptance because CpaVisionRouter removes images before this adapter
 * delegates to the real official provider.
 */
export class DeepSeekVisionBridgeAdapter extends LlmAdapter {
  constructor(private readonly llm: LlmRuntime) {
    super()
  }

  providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: 'DeepSeek (CPA vision)' }
  }

  async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const models = await this.llm.listModels(DEEPSEEK_SOURCE_PROVIDER)
    return models.map(model => ({
      ...model,
      provider,
      inputModalities: ['text', 'image'],
    }))
  }

  async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const resolved = await this.llm.resolveModelInfo(DEEPSEEK_SOURCE_PROVIDER, model, signal)
    return {
      ...resolved,
      provider,
      inputModalities: ['text', 'image'],
    }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // The nested official-provider call re-enters the public llm/stream
    // waterfall, where CpaVisionRouter converts images to text.
    yield* this.llm.stream({ ...options, provider: DEEPSEEK_SOURCE_PROVIDER })
  }
}

export function installDeepSeekVisionBridge(llm: LlmRuntime): (() => void) | undefined {
  const providers = llm.listProviders().map(provider => provider.id)
  if (!providers.includes(DEEPSEEK_SOURCE_PROVIDER) || providers.includes(DEEPSEEK_VISION_BRIDGE_PROVIDER)) {
    return undefined
  }
  return llm.registerAdapter(
    [DEEPSEEK_VISION_BRIDGE_PROVIDER],
    new DeepSeekVisionBridgeAdapter(llm),
  )
}
