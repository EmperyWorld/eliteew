---
status: fixed
product_id: stack0-deploy
also_affects: [eliteew_api]
date: 2026-09-26
title: Thin bake without greenlet + stack0 recreate name collision left Celery/API broken
---

# Thin bake greenlet gap + silent celery recreate miss

## Symptom

- After stack0 release `prod-baked-*-0827`, `/api/health` stayed `{"ok":true}` while SSO callback returned 503 `sso_registry_unavailable`.
- Celery containers remained on older hotfix tags; compose logged `name already in use` but release reported complete.
- Manual `*-with-greenlet` image commits were used as recovery crutches.

## Failure layers

1. **Bake:** `Dockerfile.prod-baked` only COPY code onto `eliteew-*:v3`; `greenlet` in `api.lock` never reaches thin layers when base is not rebuilt.
2. **Deploy:** `podman compose --force-recreate` did not retire named celery containers; no fail-closed on name collision (unlike stack4).
3. **Observability:** `get_health_summary` ignored missing PostgreSQL asyncio deps when Redis/other paths looked healthy.

## Root cause

Thin-bake + SKIP_BASE default treated lock pins as runtime truth; stack0 recreate was not fail-closed; health lied.

## Fix

- Import probe requires `greenlet` + `sqlalchemy.ext.asyncio` on API/celery images.
- Base images stamp `BUILD_LOCK_HASH`; release auto-enables `--rebuild-base` on drift/missing greenlet.
- Stack0 recreate retires named containers + fail-closes on name collision + asserts image tags.
- `get_health_summary` → `unhealthy` when PostgreSQL enabled but deps unavailable.

## Verification

- `bash docker/scripts/verify-stack0-recreate-fail-closed-selftest.sh`
- `bash docker/scripts/run-stack0-api-tests.sh tests/test_database_manager_postgres_deps_health.py -q`
- Release with rebuilt base: celery/API images on clean tag (no `with-greenlet`); `Infrastructure: postgres=ok`; SSO callback not 503 for registry/PG.
