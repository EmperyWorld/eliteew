# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors entry — public /api/health ok:false while stack0 healthy (EWA pool unset).
# ---

# /api/health ok:false when EWA pool not open

| Field | Value |
|-------|--------|
| **product_id** | `ewa` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | `stack0-deploy` |
| **canon** | `documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md` |
| **commit** | — |

## Symptom

After stack0 cold start: container healthy, DB 6/6 healthy, public `GET /api/health` → `{"ok":false}`. Admin detail would show `ewa_postgres.status=down` with `configured=true`, `pool_open=false`.

## Failure layers

- Aggregate health: public `ok` only when overall `status==healthy`
- EWA merge: `pool_open=false` → `down` → degrades overall
- Lifespan: pool opens late; brief window (or missed assign) left health false without self-heal

## Root cause

Public health treated “EWA DSN configured but pool attribute unset” as hard down with no ensure/retry on the health path.

## What we did

- `ensure_ewa_orchestration_pool()` in `ewa_platform/desktop/pool.py` (locked self-heal)
- `build_ewa_postgres_health_payload` calls ensure when configured and pool missing
- Tests: `test_ewa_health_snapshot.py` (ensure opens / still down when ensure returns None)

## Recommendations

- Keep EWA slice in admin health detail; do not weaken public contract to hide real PG failure
- Prefer ensure over silent “disabled” when DSN is set

## Verification

```text
cd shared/api && UV_PROJECT_ENVIRONMENT=../../.venv uv run pytest tests/test_ewa_health_snapshot.py -q → 5 passed
ssh .111 'curl -sf http://127.0.0.1:29000/api/health' → {"ok":true}
podman logs … | rg "EWA orchestration pool: enabled"
```

## Residual risk

If EWA PG is truly down, ensure fails and public `ok` stays false (honest). Edge SPA publish residual is separate (`stack0-deploy` entry).
