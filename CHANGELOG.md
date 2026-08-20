# Changelog

## 0.1.6

- Decouple the selected vision model from the conversation's main model using DSH's public `llm/stream` extension point.
- Preprocess image attachments into factual text before calling text-only CPA models, allowing model switches in image-containing sessions.
- Cache successful descriptions by provider, vision model, and immutable attachment ID.
- Continue sending images directly when the selected main model is natively image-capable.
- Add a `DeepSeek (CPA vision)` adapter alias that delegates to DSH's official DeepSeek provider after preprocessing, without patching DSH or duplicating its credentials.

## 0.1.5

- Register the browser bundle with the published `dsh-cliproxyapi-provider` name required by DSH rc.8's strict client-module loader.
- Derive the browser module ID from `package.json` and test it alongside the host bundle name to prevent future drift.

## 0.1.4

- Build and type-check against the public DSH `0.1.0-rc.8` contracts.
- Load the rc.8 remote-event type assembly explicitly so model-catalog refresh subscriptions remain type-safe.
- Point the DSH bundle loader at the published `dsh-cliproxyapi-provider` package name.
- Keep runtime compatibility with the rc.7-based DSH Desktop release.

## 0.1.3

- Declare the DSH credential service as a startup dependency so a persisted CPA key is available on the first probe after restart.

## 0.1.2

- Keep CPA model families in catalog order while sorting versions newest-first within each family.

## 0.1.1

- Vision model is now a catalog-backed dropdown; model IDs cannot be typed manually.
- The dropdown probes after the CPA URL and API key are entered, with loopback discovery when the URL is empty.
- Credential updates immediately refresh the CPA route instead of waiting for the periodic timer.

## 0.1.0

- Initial open-source DSH bundle.
- Local IPv4/hostname/IPv6 CPA discovery.
- Dynamic `/v1/models` synchronization through the official pi-ai adapter.
- Native model switching, configurable vision model, settings card, credentials, and refresh/status commands.
