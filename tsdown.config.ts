import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const manifest = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { name: string }

// DSH's browser loader requires this ID to exactly match the bundle package
// name. Derive it from the manifest so host and client entries cannot drift.
const ID = manifest.name

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
]

const host = {
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: true,
  clean: true,
  fixedExtension: false,
  deps: {
    neverBundle: [/^@deepseek-ai\//],
  },
}

const client = {
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs' as const,
  platform: 'browser' as const,
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: CLIENT_EXTERNALS,
    alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([host, client])
