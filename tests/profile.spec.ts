import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.js'
import type { CpaDiscoveryResult } from '../src/discovery.js'
import { buildPiAiRoute, sortModelsNewestFirst } from '../src/profile.js'

const discovery: CpaDiscoveryResult = {
  rootURL: 'http://localhost:8317',
  modelsURL: 'http://localhost:8317/v1/models?client_version=pi',
  models: [
    { id: 'text-model', inputModalities: ['text'], reasoning: false, reasoningLevels: [], serviceTiers: [] },
    { id: 'vl-model', inputModalities: ['text', 'image'], reasoning: true, reasoningLevels: ['off', 'high'], serviceTiers: [] },
  ],
}

describe('pi-ai route mapping', () => {
  it('uses bearer credential references and native vision metadata', () => {
    const built = buildPiAiRoute(resolveConfig({}), discovery, true)
    expect(built.profile.baseURL).toBe('http://localhost:8317/v1')
    expect(built.profile.apiKeyEnv).toBe('CLIPROXYAPI_API_KEY')
    expect(built.visionModel).toBe('vl-model')
    expect(built.directImageModels).toEqual(['vl-model'])
    expect(built.profile.models[0]).toMatchObject({ id: 'text-model', input: ['text', 'image'] })
    expect(built.profile.models[1]).toMatchObject({
      id: 'vl-model', input: ['text', 'image'], reasoningEfforts: { off: null, high: 'high' },
    })
  })

  it('forces an explicitly configured model to advertise image input', () => {
    const built = buildPiAiRoute(resolveConfig({ visionModel: 'text-model' }), discovery, false)
    expect(built.visionModel).toBe('text-model')
    expect(built.profile.models[0]?.input).toEqual(['text', 'image'])
    expect(built.directImageModels).toEqual(['text-model', 'vl-model'])
    expect(built.profile.headers).toEqual({ Authorization: 'Bearer cpa-local' })
    expect(built.profile.apiKeyEnv).toBeUndefined()
  })

  it('does not invent a missing explicit vision model', () => {
    const textOnly = { ...discovery, models: [discovery.models[0]!] }
    const built = buildPiAiRoute(resolveConfig({ visionModel: 'missing' }), textOnly, true)
    expect(built.visionModel).toBeUndefined()
    expect(built.profile.models[0]?.input).toEqual(['text'])
  })

  it('puts newer versions first inside each model family', () => {
    const models = [
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)' },
      { id: 'gemini-3.5-flash-high', name: 'Gemini 3.5 Flash (High)' },
      { id: 'gemini-3.5-flash-low', name: 'Gemini 3.5 Flash (Low)' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
      { id: 'gpt-oss-120b', name: 'GPT-OSS 120B' },
    ].map(model => ({
      ...model, inputModalities: ['text'], reasoning: false, reasoningLevels: [], serviceTiers: [],
    }))
    expect(sortModelsNewestFirst(models).map(model => model.name)).toEqual([
      'Gemini 3.7 Flash',
      'Gemini 3.6 Flash',
      'Gemini 3.5 Flash (High)',
      'Gemini 3.5 Flash (Low)',
      'Gemini 3.1 Flash Lite',
      'Gemini 3.1 Pro (High)',
      'GPT-OSS 120B',
    ])
  })
})
