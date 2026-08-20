import { createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import { CpaVisionRouter, type VisionStreamRuntime } from '../src/vision-routing.js'

const image = {
  type: 'image' as const,
  attachment: {
    attachmentId: 'sha256:test-image',
    mediaType: 'image/png' as const,
    bytes: 100,
    width: 10,
    height: 10,
    name: 'screen.png',
  },
}

async function* response(text: string): AsyncIterable<StreamChunk> {
  yield { type: 'block-end', index: 0, block: { type: 'text', text } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

function request(model: string): GenerateOptions {
  return {
    provider: 'cliproxyapi',
    model,
    messages: [createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'text', text: 'What is shown?' }, image as never],
    })],
  }
}

describe('CPA vision routing', () => {
  it('describes images with the vision model before calling a text-only main model', async () => {
    const calls: GenerateOptions[] = []
    const llm: VisionStreamRuntime = {
      resolveModelInfo: async (provider, model) => ({ provider, id: model, name: model, inputModalities: ['text'] }),
      stream: options => {
        calls.push(options)
        return response(options.model === 'vision-model' ? 'A settings screen.' : 'Main answer')
      },
    }
    const router = new CpaVisionRouter(llm, () => ({
      provider: 'cliproxyapi', visionModel: 'vision-model', directImageModels: ['vision-model'],
    }))
    const next = vi.fn(() => response('unrouted'))

    const chunks = await collect(router.stream(request('text-model'), next))

    expect(next).not.toHaveBeenCalled()
    expect(calls.map(call => call.model)).toEqual(['vision-model', 'text-model'])
    expect(calls[0]?.messages[0]?.content).toContainEqual(image)
    expect(calls[1]?.messages.some(message => message.content.some(block => block.type === 'image'))).toBe(false)
    expect(calls[1]?.messages[0]?.content).toContainEqual({
      type: 'text', text: '[Image analysis for screen.png]\nA settings screen.',
    })
    expect(chunks).toContainEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'Main answer' } })
  })

  it('passes a native vision model through without preprocessing', async () => {
    const llm = {
      resolveModelInfo: vi.fn(async (provider: string, model: string) => ({ provider, id: model, name: model })),
      stream: vi.fn(() => response('nested')),
    }
    const router = new CpaVisionRouter(llm, () => ({
      provider: 'cliproxyapi', visionModel: 'vision-model', directImageModels: ['vision-model'],
    }))
    const next = vi.fn(() => response('direct'))

    await collect(router.stream(request('vision-model'), next))

    expect(next).toHaveBeenCalledOnce()
    expect(llm.stream).not.toHaveBeenCalled()
  })

  it('caches descriptions by immutable attachment id', async () => {
    const calls: GenerateOptions[] = []
    const llm: VisionStreamRuntime = {
      resolveModelInfo: async (provider, model) => ({ provider, id: model, name: model, inputModalities: ['text'] }),
      stream: options => {
        calls.push(options)
        return response(options.model === 'vision-model' ? 'Cached caption' : 'Main answer')
      },
    }
    const router = new CpaVisionRouter(llm, () => ({
      provider: 'cliproxyapi', visionModel: 'vision-model', directImageModels: ['vision-model'],
    }))

    await collect(router.stream(request('text-model'), () => response('unrouted')))
    await collect(router.stream(request('another-text-model'), () => response('unrouted')))

    expect(calls.filter(call => call.model === 'vision-model')).toHaveLength(1)
    expect(calls.filter(call => call.model !== 'vision-model')).toHaveLength(2)
  })

  it('passes through when no active vision route is available', async () => {
    const router = new CpaVisionRouter({ stream: vi.fn(), resolveModelInfo: vi.fn() }, () => undefined)
    const next = vi.fn(() => response('direct'))

    await collect(router.stream(request('text-model'), next))

    expect(next).toHaveBeenCalledOnce()
  })

  it('preprocesses images before delegating to a text-only non-CPA provider', async () => {
    const calls: GenerateOptions[] = []
    const llm: VisionStreamRuntime = {
      resolveModelInfo: async (provider, model) => ({
        provider, id: model, name: model, inputModalities: ['text'],
      }),
      stream: options => {
        calls.push(options)
        return response(options.model === 'vision-model' ? 'Bridge caption' : 'Official answer')
      },
    }
    const router = new CpaVisionRouter(llm, () => ({
      provider: 'cliproxyapi', visionModel: 'vision-model', directImageModels: ['vision-model'],
    }))

    await collect(router.stream({ ...request('deepseek-v4-flash'), provider: 'deepseek-official' }, () => response('raw')))

    expect(calls.map(call => [call.provider, call.model])).toEqual([
      ['cliproxyapi', 'vision-model'],
      ['deepseek-official', 'deepseek-v4-flash'],
    ])
    expect(calls[1]?.messages[0]?.content.some(block => block.type === 'image')).toBe(false)
  })
})
