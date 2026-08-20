import { describe, expect, it, vi } from 'vitest'
import { resolveConfig } from '../src/config.js'
import { CpaRuntime } from '../src/runtime.js'

describe('CPA runtime synchronization', () => {
  it('installs a route, keeps it on transient failure, and removes it when disabled', async () => {
    let config = resolveConfig({ baseURL: 'localhost:8317' })
    let failing = false
    const mutate = vi.fn(async () => {})
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (failing) return new Response('unavailable', { status: 503 })
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key')
      return Response.json({ models: [{ slug: 'vision', input_modalities: ['text', 'image'] }] })
    })
    const runtime = new CpaRuntime({
      settings: { mutate } as never,
      config: () => config,
      resolveApiKey: async () => 'test-key',
      environmentBaseURL: () => undefined,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      fetch: fetchMock,
    })

    await runtime.refresh()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:8317/v1/models?client_version=pi')
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]?.[1]).toEqual([{
      op: 'set', path: ['providers', 'cliproxyapi'], value: expect.objectContaining({
        baseURL: 'http://localhost:8317/v1',
        apiKeyEnv: 'CLIPROXYAPI_API_KEY',
        models: [expect.objectContaining({ id: 'vision', input: ['text', 'image'] })],
      }),
    }])
    expect(runtime.status()).toMatchObject({ state: 'connected', modelCount: 1, visionModel: 'vision' })

    failing = true
    await runtime.refresh()
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(runtime.status()).toMatchObject({ state: 'error', modelCount: 1 })

    config = { ...config, enabled: false }
    await runtime.refresh()
    expect(mutate.mock.calls[1]?.[1]).toEqual([{ op: 'unset', path: ['providers', 'cliproxyapi'] }])
    expect(runtime.status()).toEqual({ state: 'disabled', modelCount: 0 })
  })
})
