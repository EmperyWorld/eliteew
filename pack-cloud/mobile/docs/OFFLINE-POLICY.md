# Mobile Android offline-first policy (offline-001)

Per-feature cache, stale limits, mutation queue, and conflict rules.

## Global

| Signal | Behavior |
|--------|----------|
| No network | `OfflineBanner` + cached Room reads; sync deferred via WorkManager |
| Transient transport (VPN flap, SOCKS timeout, socket closed) | Log + telemetry; **no process kill** (`MobileNetworkFailureSupport`, global uncaught handler); realtime/perimeter degrade to disconnected |
| Network restored | `MobileSyncScheduler.enqueueImmediate(LIGHT)` |
| Logout | `SessionCacheCleaner` wipes account-scoped Room; UI prefs retained |

## Feed

- **Cache:** `FeedPostEntity` in Room; observed via Flow.
- **Stale:** 6h without successful refresh (`FEED_OFFLINE_STALE_MS`).
- **Mutations:** saved posts local only (shell prefs).
- **Conflict:** server wins on refresh; cursor merge dedupes ids.

## Chat

- **Cache:** chat list + messages in Room; attachment disk cache under `gaf_attachment_cache/`.
- **Mutations:** pending sends queued in `MainViewModel.pendingSendPayloads`; retried when online.
- **Conflict:** server message ids authoritative; realtime bridge dedupes by id when available.

## Friends / Profile

- **Cache:** overview + profile entities; ETag conditional GET where implemented.
- **Mutations:** friend actions show optimistic UI; refresh on success/failure.
- **Invalidation:** `MobileOfflineCacheSupport.invalidateAfterFriendMutation` / `invalidateAfterProfileMutation`.

## Notifications

- **Cache:** notification center rows in Room.
- **Stale:** show cache immediately; delta refresh when online.

## Desktop / UGS

- **Cache:** hub snapshots + handoff draft in shell prefs (24h TTL).
- **Mutations:** generation jobs require network; no silent queue.

## Sync observability

- `MobileSyncObservability` records last scope, result, next attempt (Profile diagnostics).

## WorkManager constraints

- **Light sync:** `NetworkType.CONNECTED` (no battery gate).
- **Periodic full sync:** battery not low.
- **APK download:** `CONNECTED` + storage not low (user-initiated; works on metered Wi‑Fi).
