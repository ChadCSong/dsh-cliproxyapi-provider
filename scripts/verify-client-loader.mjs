import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const artifact = new URL('../lib/client.js', import.meta.url)
const registrations = []
const window = {
  __ModuleLoader__: {
    load(registration) {
      registrations.push(registration)
    },
  },
}

runInNewContext(readFileSync(artifact, 'utf8'), { window }, {
  filename: artifact.pathname,
})

if (registrations.length !== 1) {
  throw new Error(`client bundle registered ${String(registrations.length)} Loader modules`)
}

const [registration] = registrations
if (registration?.id !== manifest.name || typeof registration.factory !== 'function') {
  throw new Error(
    `client bundle registered ${JSON.stringify(registration?.id)}; expected ${JSON.stringify(manifest.name)}`,
  )
}

process.stdout.write(`verify-client-loader: ${manifest.name} registered one client module\n`)
