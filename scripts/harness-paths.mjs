import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

const PACKAGE_NAMES = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/schemastery',
  '@deepseek-ai/dsh-credentials',
  '@deepseek-ai/dsh-launch-environment',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-settings-plugins/client',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-runtime/client',
]

function readLocalConfig() {
  const path = join(repoRoot, 'harness-paths.json')
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

function packageRoot() {
  const local = readLocalConfig()
  const configured = process.env.DSH_PACKAGES_ROOT ?? local.packagesRoot
  if (typeof configured === 'string' && configured.length > 0) {
    return { kind: 'installed', root: resolve(configured) }
  }
  const development = join(repoRoot, 'node_modules')
  if (existsSync(join(development, '@deepseek-ai', 'dsh-settings', 'package.json'))) {
    return { kind: 'installed', root: development }
  }
  const checkout = process.env.DSH_CHECKOUT ?? local.checkout
  if (typeof checkout === 'string' && checkout.length > 0) {
    return { kind: 'checkout', root: isAbsolute(checkout) ? checkout : resolve(repoRoot, checkout) }
  }
  const installed = join(process.env.DSH_HOME ?? join(os.homedir(), '.dsh'), 'profiles', 'node_modules')
  if (existsSync(installed)) return { kind: 'installed', root: installed }
  return undefined
}

function discoverCheckoutPackage(root, name) {
  const visit = (dir, depth) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return undefined
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue
      const full = join(dir, entry.name)
      const manifest = join(full, 'package.json')
      if (existsSync(manifest)) {
        try {
          if (JSON.parse(readFileSync(manifest, 'utf8')).name === name) return full
        } catch {}
      }
      if (depth > 0) {
        const found = visit(full, depth - 1)
        if (found !== undefined) return found
      }
    }
    return undefined
  }
  return visit(join(root, 'packages'), 3) ?? visit(join(root, 'vendor'), 2)
}

function packageDir(located, name) {
  const base = name.endsWith('/client') ? name.slice(0, -'/client'.length) : name
  return located.kind === 'installed'
    ? join(located.root, base)
    : discoverCheckoutPackage(located.root, base)
}

function typeEntry(dir, name) {
  const client = name.endsWith('/client')
  const candidates = client
    ? ['lib/types/client/index.d.ts', 'lib/client/index.d.ts', 'lib/client.d.ts', 'src/client/index.ts', 'src/client.ts']
    : ['lib/types/index.d.ts', 'lib/index.d.ts', 'src/index.ts']
  return candidates.map(candidate => join(dir, candidate)).find(existsSync)
}

function writePaths() {
  const located = packageRoot()
  if (located === undefined) {
    throw new Error('No DSH types found. Set DSH_PACKAGES_ROOT or DSH_CHECKOUT, or create harness-paths.json.')
  }
  const paths = {}
  const missing = []
  for (const name of PACKAGE_NAMES) {
    const dir = packageDir(located, name)
    const entry = dir === undefined ? undefined : typeEntry(dir, name)
    if (entry === undefined) missing.push(name)
    else paths[name] = [entry]
  }
  if (missing.length > 0) throw new Error(`Missing DSH type entries: ${missing.join(', ')}`)
  const target = join(repoRoot, 'tsconfig.paths.json')
  writeFileSync(target, JSON.stringify({ compilerOptions: { baseUrl: '.', paths } }, undefined, 2) + '\n')
  console.log(`dsh-cliproxyapi: wrote ${Object.keys(paths).length} DSH type paths from ${located.root}`)
  return located
}

function harnessVersion(located) {
  const candidates = located.kind === 'checkout'
    ? [join(located.root, 'apps', 'cli', 'package.json')]
    : [
        join(located.root, '@deepseek-ai', 'dsh', 'package.json'),
        // Plugin development installs the public contracts, not the whole CLI.
        // All DSH packages in a release carry the same rc version.
        join(located.root, '@deepseek-ai', 'dsh-settings', 'package.json'),
      ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const version = JSON.parse(readFileSync(path, 'utf8')).version
      if (typeof version === 'string') return version
    } catch {}
  }
  return undefined
}

if (process.argv.includes('--write')) writePaths()
if (process.argv.includes('--write-anchor')) {
  const located = packageRoot()
  if (located === undefined) throw new Error('No DSH package root available for build anchor')
  const version = harnessVersion(located)
  if (typeof version !== 'string') throw new Error('Could not read the DSH version for build anchor')
  writeFileSync(join(repoRoot, 'lib', 'build-anchor.json'), JSON.stringify({ version, kind: located.kind }, undefined, 2) + '\n')
  console.log(`dsh-cliproxyapi: build anchor ${version}`)
}
