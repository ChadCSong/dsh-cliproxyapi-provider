import type { GenerateOptions, LlmModelInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import {
  DEEPSEEK_SOURCE_PROVIDER,
  DEEPSEEK_VISION_BRIDGE_PROVIDER,
  DeepSeekVisionBridgeAdapter,
  installDeepSeekVisionBridge,
} from '../src/deepseek-bridge.js'

async function* done(): AsyncIterable<StreamChunk> {
  yield { type: 'finish', reason: { kind: 'stop' } }
}

describe('DeepSeek vision bridge', () => {
  it('advertises official models as image-capable and delegates to the official route', async () => {
    const sourceModel: LlmModelInfo = {
      provider: DEEPSEEK_SOURCE_PROVIDER,
      id: 'deepseek-v4-flash',
      name: 'DeepSeek-V4-Flash',
      inputModalities: ['text'],
    }
    const resolved: LlmResolvedModelInfo = { ...sourceModel, defaultMaxTokens: 4096 }
    const calls: GenerateOptions[] = []
    const llm = {
      listModels: vi.fn(async () => [sourceModel]),
      resolveModelInfo: vi.fn(async () => resolved),
      stream: (options: GenerateOptions) => { calls.push(options); return done() },
    }
    const adapter = new DeepSeekVisionBridgeAdapter(llm as never)

    expect(await adapter.listModels(DEEPSEEK_VISION_BRIDGE_PROVIDER)).toEqual([{
      ...sourceModel,
      provider: DEEPSEEK_VISION_BRIDGE_PROVIDER,
      inputModalities: ['text', 'image'],
    }])
    expect(await adapter.resolveModel(DEEPSEEK_VISION_BRIDGE_PROVIDER, sourceModel.id)).toMatchObject({
      provider: DEEPSEEK_VISION_BRIDGE_PROVIDER,
      id: sourceModel.id,
      defaultMaxTokens: 4096,
      inputModalities: ['text', 'image'],
    })
    for await (const _chunk of adapter.stream({ provider: DEEPSEEK_VISION_BRIDGE_PROVIDER, model: sourceModel.id, messages: [] })) {}
    expect(calls[0]?.provider).toBe(DEEPSEEK_SOURCE_PROVIDER)
  })

  it('registers only when the official provider is present', () => {
    const registerAdapter = vi.fn(() => vi.fn())
    const present = {
      listProviders: () => [{ id: DEEPSEEK_SOURCE_PROVIDER, name: 'DeepSeek' }],
      registerAdapter,
    }
    expect(installDeepSeekVisionBridge(present as never)).toBeTypeOf('function')
    expect(registerAdapter).toHaveBeenCalledWith(
      [DEEPSEEK_VISION_BRIDGE_PROVIDER], expect.any(DeepSeekVisionBridgeAdapter),
    )

    expect(installDeepSeekVisionBridge({
      listProviders: () => [], registerAdapter,
    } as never)).toBeUndefined()
  })
})
