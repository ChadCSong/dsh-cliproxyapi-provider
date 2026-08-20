import { describe, expect, it, vi } from 'vitest'
import { discoverCpa, discoveryCandidates, normalizeCpaRoot, parseCatalog } from '../src/discovery.js'

describe('CPA discovery', () => {
  it('normalizes roots and removes API suffixes', () => {
    expect(normalizeCpaRoot('127.0.0.1:8317/v1')).toBe('http://127.0.0.1:8317')
    expect(normalizeCpaRoot('http://localhost:8317/backend-api/')).toBe('http://localhost:8317')
    expect(normalizeCpaRoot('http://[::1]:8317')).toBe('http://[::1]:8317')
  })

  it('tries an override, environment URL, IPv4, localhost, and IPv6 without duplicates', () => {
    expect(discoveryCandidates({ baseURL: 'localhost:9000/v1', environmentBaseURL: 'http://localhost:9000' })).toEqual([
      'http://localhost:9000',
      'http://127.0.0.1:8317',
      'http://localhost:8317',
      'http://[::1]:8317',
    ])
  })

  it('parses useful CPA catalog metadata and skips invalid duplicates', () => {
    expect(parseCatalog({ data: [
      { id: 'gpt-5', owned_by: 'openai', provider: 'codex', context_window: 400000, max_output_tokens: 128000, input_modalities: ['text', 'image'], reasoning: true, service_tiers: ['priority'] },
      { id: 'gpt-5' },
      { nope: true },
    ] })).toEqual([{
      id: 'gpt-5', ownedBy: 'openai', provider: 'codex', contextWindow: 400000, maxTokens: 128000,
      inputModalities: ['text', 'image'], reasoning: true, reasoningLevels: [], serviceTiers: ['priority'],
    }])
  })

  it('parses the enriched CPA Codex catalog shape', () => {
    expect(parseCatalog({ models: [
      {
        slug: 'gpt-5.6-sol', display_name: 'GPT-5.6 Sol', max_context_window: 372000,
        input_modalities: ['text', 'IMAGE'], supported_reasoning_levels: [{ effort: 'none' }, { effort: 'High' }],
        service_tiers: [{ id: 'priority', name: 'Fast' }],
      },
      { slug: 'hidden', visibility: 'hide' },
    ] })).toEqual([{
      id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', contextWindow: 372000,
      inputModalities: ['text', 'image'], reasoning: true, reasoningLevels: ['off', 'high'], serviceTiers: ['priority'],
    }])
  })

  it('falls through failed local addresses and authenticates the successful one', async () => {
    const calls: Array<{ url: string; authorization?: string }> = []
    const mockedFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      calls.push({ url, ...headers.get('authorization') === null ? {} : { authorization: headers.get('authorization')! } })
      if (!url.startsWith('http://[::1]:8317')) return new Response('no', { status: 503 })
      return Response.json({ data: [{ id: 'claude-sonnet', input_modalities: ['text'] }] })
    })
    const result = await discoverCpa({ timeoutMs: 1_000, apiKey: 'secret', fetch: mockedFetch })
    expect(result.rootURL).toBe('http://[::1]:8317')
    expect(result.modelsURL).toBe('http://[::1]:8317/v1/models?client_version=pi')
    expect(result.models.map(model => model.id)).toEqual(['claude-sonnet'])
    expect(calls).toHaveLength(3)
    expect(calls.every(call => call.authorization === 'Bearer secret')).toBe(true)
  })
})
