# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser policy GET served from Redis response cache after admin PUT.
# ---

# EBrowser — stale policy via ResponseCacheMiddleware

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **also_affects** | `desktop-shell` (shared API middleware) |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` §2 |
| **commit** | — (Commit Package) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

Admin saved EBrowser navigation `mode=open` for `lady_boss`. Client still showed «Сайты пока закрыты» and red deny that sites are closed. DB row and `get_effective_policy` were correct (`is_default=false`); `GET /api/v1/ebrowser/policy` returned **200** without executing the route handler (Redis HIT).

## Failure layers

1. `ResponseCacheMiddleware` cached successful GET policy JSON (~`api_cache` TTL).
2. Admin PUT does not invalidate that key.
3. SPA/`is_default` chrome and deny copy honestly reflected the **stale** body.

## Root cause

Mutable per-user policy GET was not on the response-cache exclusion list (unlike `/api/v1/desktop/`, `/api/v1/ewa/`, …).

## What we did

- Exclude `/api/v1/ebrowser/` in `EXCLUDED_PATHS`.
- Unit lock in `tests/test_response_cache_exclusions.py`.
- Ops: flush `response_cache:*` + live middleware patch until next stack0 rebake.
- Canon note in `DESKTOP-EBROWSER.md` §2.

## Verification

```text
pytest tests/test_response_cache_exclusions.py -k ebrowser -q
# Live: after flush/exclude, lady_boss GET must hit handler; banner clears on reopen/60s refresh
```

## Recommendations

- Any new mutable per-user GET mount: add to `EXCLUDED_PATHS` in the same PR as the router.
- Do not rely on TTL wait as user recovery.
