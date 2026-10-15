# Stuck `stack1-postgres` (Stopping / not ready) — prod-core

SSO session registry (`sso_user_sessions`) lives on **stack1 Postgres** (`ai_services`). When the container is stuck in `Stopping`, wedged, or `pg_isready` fails, EliteEW **fail-closes** auth: HTTP/WS return **503** with `reason=sso_registry_unavailable` (no degrade / fail-open).

Structure mirrors the ComfyUI stuck-container section in [COMFYUI-COMMAND-CENTER-OPERATIONS.md](COMFYUI-COMMAND-CENTER-OPERATIONS.md).

## Detect

On **prod-core** (`.111`):

```bash
podman ps -a --filter name=stack1-postgres
podman exec stack1-postgres pg_isready -U ai_user -d ai_services
# optional: recent registry outages
podman logs stack0-eliteew-api-prod-baked 2>&1 | rg -i 'sso session registry|sso_registry_unavailable' | tail -30
```

Symptoms:

| Signal | Meaning |
|--------|---------|
| Status `Stopping` / `Exited` / not in `Up` | Container not serving |
| `pg_isready` non-zero | Acceptors down even if process looks alive |
| API `503` `reason=sso_registry_unavailable` | Registry path exhausted transient retries (fail-closed) |
| `/api/health` `postgresql` unhealthy | Broader stack1 impact (not only SSO) |

## Safe recovery (operator shell on `.111`)

Do **not** wipe `docker/data/stack1/postgresql`. Prefer stop → remove stuck container → recreate via control scripts.

```bash
# 1) Attempt graceful stop with short timeout
podman stop -t 20 stack1-postgres || true

# 2) If still Stopping / rm blocked — force remove container only (volume stays)
podman rm -f stack1-postgres || true

# 3) Recreate stack1 (or postgres alone) via living control entrypoints from command-center
# Prefer from .136 with aliases loaded:
#   eectl --yes recreate --include stack1
# Or on .111 with compose/env runtime path from Config Plane (operator runbook).
```

If recreate from command-center:

```bash
# command-center (.136)
source docker/scripts/eliteew-docker-aliases.sh
eectl --yes recreate --include stack1
```

After Postgres is up, dependent stack0 API containers may need recreate if they held dead pools — prefer living stack0 line (`eeprodline status` then baked/dev-bind path), not ad-hoc image rebuild on `.111`.

## Smoke (definition of recovered)

```bash
podman exec stack1-postgres pg_isready -U ai_user -d ai_services
curl -sf http://127.0.0.1:29000/api/health   # postgresql healthy
# Login path: browser SSO callback once; one authenticated API (e.g. /api/v1/profile/me)
```

Expect: no new `sso_registry_unavailable` in API logs; callback returns 200 (or expected 409 confirm), not 503.

## Security / product invariants

- **Fail-closed:** no `SSO_REGISTRY_MODE=degrade`, no skipping registry on PG down.
- API may retry **transient** connection/timeout errors a few times with jitter, then still raise 503.
- Frontend distinguishes `reason=sso_registry_unavailable` from generic maintenance overlay (`action=retry`).

## Related

- Canon hub: [../SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md](../SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md) §SPOF
- FE auth: [../../product/FRONTEND-AUTH.md](../../product/FRONTEND-AUTH.md)
- Stack control: [STACK-CONTAINER-CONTROL.md](STACK-CONTAINER-CONTROL.md)
- Tuning / role notes: [STACK1-POSTGRES-TUNING.md](STACK1-POSTGRES-TUNING.md)
