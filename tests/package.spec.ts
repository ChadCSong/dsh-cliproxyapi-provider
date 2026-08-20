import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import buildConfig from '../tsdown.config.js'

describe('published DSH bundle', () => {
  it('loads the package by its published name', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string }
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

    expect(patch).toContain(`name: ${manifest.name}`)
  })

  it('registers the browser module by its published name', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string }
    const configs = buildConfig as unknown as Array<{
      outputOptions?: { banner?: string }
    }>
    const client = configs.find(config => config.outputOptions?.banner !== undefined)

    expect(client?.outputOptions?.banner).toContain(`id: ${JSON.stringify(manifest.name)}`)
  })
})
