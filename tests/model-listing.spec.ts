import { describe, expect, it } from 'vitest'
import { modelListingBaseURLs } from '../src/client/model-discovery.js'

describe('vision model listing endpoints', () => {
  it('turns a CPA root or API path into the OpenAI model-listing base', () => {
    expect(modelListingBaseURLs('localhost:8317')).toEqual(['http://localhost:8317/v1'])
    expect(modelListingBaseURLs('https://proxy.example/gateway/backend-api/')).toEqual([
      'https://proxy.example/gateway/v1',
    ])
    expect(modelListingBaseURLs('https://proxy.example/gateway/v1')).toEqual([
      'https://proxy.example/gateway/v1',
    ])
  })

  it('uses all loopback forms when the address is left empty', () => {
    expect(modelListingBaseURLs('')).toEqual([
      'http://127.0.0.1:8317/v1',
      'http://localhost:8317/v1',
      'http://[::1]:8317/v1',
    ])
  })
})
