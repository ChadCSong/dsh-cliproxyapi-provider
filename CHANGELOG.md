# Changelog

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
