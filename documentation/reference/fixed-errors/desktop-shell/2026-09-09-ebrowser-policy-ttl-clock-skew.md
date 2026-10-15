# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser false expired policy from server stamp vs seat clock.
# ---

# EBrowser — false «политика устарела» (TTL vs seat clock / race)

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **also_affects** | `desktop-client` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` §2 Sync/offline |
| **commit** | — (Commit Package pending) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

Opening a site in EBrowser showed: «Политика навигации недоступна или устарела. Обновите окно и повторите.» while `GET /api/v1/ebrowser/policy` returned 200.

## Failure layers

1. SPA `policyApiToSnapshot` set `fetchedAtMs = Date.parse(api.fetched_at)` then compared to local `Date.now()` → seat clock ahead of UTC expired a fresh policy immediately.
2. `go()` evaluated with `policy === null` before the first refresh settled → `missing_policy` without awaiting fetch.

## Root cause

TTL freshness used absolute server wall time against a potentially skewed client clock, plus Open raced the async policy fetch.

## What we did

- Stamp `fetchedAtMs` at client receive (`Date.now()` / injectable `receivedAtMs`).
- On Go, await one `refreshPolicy` when missing/expired before deny.
- Canon Sync/offline + Vitest lock on receive stamp.

## Verification

```text
pnpm exec vitest run src/features/ebrowser/ → pass
```

## Recommendations

- Keep SPA refresh ≤ TTL; do not compare server `fetched_at` to seat clock for fail-closed.
- Ship SPA (edge / stack0) so Connected seats pick up the chrome fix; Tauri OTA not required for this FE-only stamp.
