import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('published DSH bundle', () => {
  it('loads the package by its published name', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string }
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

    expect(patch).toContain(`name: ${manifest.name}`)
  })
})
