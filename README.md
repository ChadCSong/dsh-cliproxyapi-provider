# DSH CLIProxyAPI Provider

[![CI](https://github.com/ChadCSong/dsh-cliproxyapi-provider/actions/workflows/ci.yml/badge.svg)](https://github.com/ChadCSong/dsh-cliproxyapi-provider/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An auto-discovery [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) provider for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

It discovers a local CPA service, synchronizes the live model catalog into DSH's native model picker,
and lets you choose a vision-capable model from that catalog—without typing model IDs by hand.

> [简体中文说明](README.zh-CN.md)

## Why this plugin?

Generic OpenAI-compatible routes usually require a manually maintained base URL and model list. This
plugin treats CLIProxyAPI as a first-class, dynamic DSH provider:

- **Zero-address local setup** — probes `127.0.0.1:8317`, `localhost:8317`, and `[::1]:8317`.
- **Live model discovery** — reads `/v1/models?client_version=pi`, with standard `data[].id` fallback.
- **Native model switching** — models appear under `CLIProxyAPI (auto)` in DSH's model picker.
- **Newest versions first** — versions are sorted newest-first inside each model family.
- **Independent vision preprocessing** — choose a vision model from the returned catalog; when the
  selected main model is text-only, the plugin describes images first and sends that text to the main model.
- **Official DeepSeek bridge** — the `DeepSeek (CPA vision)` picker group delegates to DSH's own
  official DeepSeek provider after CPA vision preprocessing; no DeepSeek credential or transport is copied.
- **Capability sync** — imports context/output limits, reasoning support, image input, and service tiers
  when CPA reports them.
- **Automatic refresh** — CPA account or model changes are picked up without reinstalling the plugin.
- **Credential-safe** — the API key is stored through DSH's credential service, not in `settings.yaml`.
- **Standard DSH bundle** — works with DSH Web, headless profiles, and DSH Desktop; it is not a
  Desktop-only extension.

## Requirements

- DeepSeek Harness `0.1.0-rc.7` or `0.1.0-rc.8`
- Node.js `22.19+` or `24+`
- A running CLIProxyAPI instance

The plugin is currently built and tested against the public DSH `0.1.0-rc.8` contract while retaining
runtime compatibility with the rc.7-based DSH Desktop release.

## Install

Install directly from GitHub into the profile you use:

```sh
dsh plugin --profile web add github:ChadCSong/dsh-cliproxyapi-provider
```

For DSH Desktop, use its active profile (normally `desktop`):

```sh
dsh plugin --profile desktop add github:ChadCSong/dsh-cliproxyapi-provider
```

Restart the corresponding DSH process once after installation. No manual profile patching is needed;
the standard DSH bundle declaration lives in `package.json` and `cordis.patch.yml`.

### Install from a local checkout

```sh
git clone https://github.com/ChadCSong/dsh-cliproxyapi-provider.git
cd dsh-cliproxyapi-provider
pnpm install
pnpm build
dsh plugin --profile web add "$PWD"
```

Replace `web` with the profile you actually use.

## Setup and usage

1. Start CLIProxyAPI. Leave the URL empty when it listens on the default port, `8317`.
2. Open **Settings → Plugins → CLIProxyAPI (auto discovery)** in DSH.
3. If CPA bearer authentication is enabled, enter the API key once.
4. After the URL and key are valid, choose the vision model from the automatically loaded dropdown.
5. Return to a conversation and select any model under **CLIProxyAPI (auto)** in DSH's native picker.
   To use DSH's built-in DeepSeek backend in an image-containing session, select the same model under
   **DeepSeek (CPA vision)**.

Useful commands:

```text
/cpa-status
/cpa-refresh
```

`/cpa-status` reports the current endpoint and synchronized model count. `/cpa-refresh` immediately
probes CPA and refreshes the DSH model catalog.

## Configuration

The settings namespace intentionally remains `dsh-cliproxyapi` for upgrade compatibility:

```yaml
dsh-cliproxyapi:
  enabled: true
  # Empty means local auto-discovery. Remote CPA is also supported.
  baseURL: ''
  apiKeyEnv: CLIPROXYAPI_API_KEY
  # Empty means the first catalog model declaring image input.
  visionModel: ''
  protocol: openai-completions
  refreshIntervalSeconds: 300
  probeTimeoutMs: 2000
```

### Endpoint resolution

Candidates are deduplicated and tried in this order:

1. Explicit `baseURL` setting
2. `CLIPROXYAPI_BASE_URL` from the DSH launch environment
3. Local loopback candidates on port `8317`

A non-loopback service is contacted only when you explicitly configure it.

### API key storage

`apiKeyEnv` is a credential reference, not the secret itself. The settings UI writes the key through
DSH's credential service. The default reference is `CLIPROXYAPI_API_KEY`.

### Inference protocol

The default, `openai-completions`, uses CPA's `/v1/chat/completions` route. Select
`openai-responses` only when your CPA deployment exposes the target models through the Responses API.

### Vision model behavior

The vision model and the conversation's main model are independent. Native image-capable main models
receive images directly. For a text-only main model, the plugin calls the selected vision model first,
replaces each immutable image attachment with its factual description, and then calls the main model.
Descriptions are cached by provider, vision model, and attachment ID. This lets an image-containing
session switch back to models such as DeepSeek without modifying DSH itself.

DSH's original **DeepSeek** group correctly remains text-only. The plugin adds **DeepSeek (CPA vision)**
as a public-adapter alias: it keeps DSH's official model, credential, reasoning, retry, and transport path,
but advertises the image capability supplied by the plugin's preprocessing step.

When the setting is empty, the plugin uses the first catalog model declaring image input. An explicitly
selected model must genuinely accept OpenAI-compatible image content even if CPA omitted its modality metadata.

## How it works

The plugin manages one route in DSH's official `@deepseek-ai/dsh-llm-pi-ai` adapter through the public
settings contract and implements preprocessing through DSH's public `llm/stream` waterfall. It does not
patch Harness or reimplement model transport. Streaming, tool calls, attachments, reasoning, and errors
continue through the official adapter.

The host bundle imports no Electron or `dsh-plugin-desktop` APIs. Its settings card uses public DSH
client services and slots, allowing the same package to run in CLI/Web and Desktop profiles.

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

When developing against a local Harness checkout:

```sh
DSH_CHECKOUT=/absolute/path/to/deepseek-harness pnpm test
DSH_CHECKOUT=/absolute/path/to/deepseek-harness pnpm build
```

Alternatively, point `DSH_PACKAGES_ROOT` at a DSH `node_modules` directory. Generated local path files
are ignored by Git and never included in published packages.

## Security

Automatic discovery only contacts loopback addresses. The plugin never writes a literal API key to its
settings, model cache, or logs. See [SECURITY.md](SECURITY.md) to report a vulnerability privately.

## Contributing

Issues and pull requests are welcome. For behavior changes, please include or update Vitest coverage and
verify `pnpm test`, `pnpm typecheck`, and `pnpm build` before submitting.

## License

[MIT](LICENSE)
