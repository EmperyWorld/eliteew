# Mobile release — operator dashboard notes

**Updated:** 2026-07-16 · W5 Hub OTA strip

## Goal

Single glance card: **current mobile version**, OTA health, edge-sync aggregate, trusted-device count.

## Current surface (W5)

**Social Hub → Phone** (`MobileAppHubPanel` → `MobileHubOtaObservabilityStrip`):

| Field | Source |
|-------|--------|
| Server `version_name` / `version_code` | `GET /api/v1/mobile-app/overview` |
| APK SHA-256 (short) | `overview.apk_sha256` |
| `published_at` / min supported code | overview |
| Active trusted phones + edge aggregate | `GET /api/v1/mobile-devices` (`wg_edge_sync_status` / `wg_edge_synced_at`) |

Edge Celery trigger (W3): DEWA Operations → `eeops` / `mobile-wg-edge-sync` **or** `bash docker/scripts/eliteew-mobile-wg-edge-sync.sh`.

## Deferred

- Dedicated Unified Admin / DEWA Mobile release section (`?section=mobile-release`).
- Crash-free / login failure analytics (Firebase + API metrics).

## Smoke after deploy

```bash
bash docker/scripts/mobile-release-stack.sh smoke
curl -s http://127.0.0.1:29180/v1/manifest.json | python3 -m json.tool
```

## Related

- [RELEASE-CHANNELS.md](RELEASE-CHANNELS.md)
- [../../../documentation/platform/docker-re_doc/MOBILE-RELEASE-SERVER.md](../../../documentation/platform/docker-re_doc/MOBILE-RELEASE-SERVER.md)
- `MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md` (historical reference; absent from this checkout) (W5)
