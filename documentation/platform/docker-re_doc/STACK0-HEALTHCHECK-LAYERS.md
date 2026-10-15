# Stack0 healthcheck layers

Operator map for **why** stack0 has several different «health» mechanisms and **which layer** owns each check. Prevents mixing cheap container liveness with deploy contract proof.

Topology: [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current. Celery queue detail: [CELERY-BEAT-AND-QUEUES.md](../CELERY-BEAT-AND-QUEUES.md). Workers Admin UI: [ADMIN-WORKERS-OPS.md](ADMIN-WORKERS-OPS.md).

## Three layers (do not merge)

| Layer | Question it answers | Who runs it | Typical frequency |
|-------|---------------------|-------------|-------------------|
| **A — Compose `healthcheck:`** | Is the main process still alive enough to keep `(healthy)`? | Podman inside the container | Every 30–60s |
| **B — Dockerfile `HEALTHCHECK`** | Image default when compose does not override | Same as A if compose omits `healthcheck` | Same as A |
| **C — Deploy / acceptance smoke** | Did this release preserve prod contracts (routes, venv, sidecars, broker)? | `docker/scripts/*` on command-center or prod-core | Once per deploy / migration gate |

**Rule:** Layer **C** checks belong in scripts (`prod-core-deploy-lib.sh`, `eliteew-migration-command-center.sh`, domain smokes). They must **not** be copied into Layer **A** on a short interval — that is what caused Celery `inspect ping` CPU spikes.

## Stack0 service matrix (Layer A vs C)

| Service | Compose file | Layer A (canonical) | Layer B (Dockerfile) | Layer C (scripts) |
|---------|--------------|---------------------|----------------------|-------------------|
| **API** | `stack0_b.yml` | `curl -f ${API_HEALTH_URL}` (in-container `/api/health`) | none — compose only | `curl :29000/api/health`; `podman exec … curl :8000/api/health` — `prod_core_deploy_smoke_stack0`, `prod_core_deploy_wait_api_baked` |
| **Frontend (nginx)** | `stack0_f.yml` | `curl -sf http://127.0.0.1:8080/` | `stack0-frontend/Dockerfile` — same HTTP `/` | `curl :29001/`; deploy-id match nginx ↔ API — `prod_core_deploy_smoke_stack0` |
| **RabbitMQ queue-worker** | `stack0_b.yml` | `python /app/smoke/smoke_queue_worker_boot.py` (cold `aio_pika`) | script COPY in `stack0-api/Dockerfile`; no `HEALTHCHECK` | container running; sidecar DNS + `:8095`/`:8096` from API pod — `prod_core_deploy_smoke_stack0_contract` |
| **Site Studio queue-worker** | `stack0_b.yml` (profile) | same aio_pika smoke | same image family | domain smokes when profile enabled |
| **Celery general / agentic / companion** | `stack0_b.yml` | `pgrep -f '[c]elery.*worker'` | `procps-ng` in runtime-base; no `HEALTHCHECK` | **`celery inspect ping`** — migration acceptance only; Admin Workers snapshot on demand |
| **Celery beat** | `stack0_b.yml` | `pgrep -f '[c]elery.*beat'` | same | Admin beat slice; container must be single instance |
| **LAN Celery (gpu141)** | `stack0_b_workers_lan.yml` | same pgrep as prod | — | LAN recovery gates |

### Smoke script ownership

| Script | Path | Layer | Use |
|--------|------|-------|-----|
| `smoke_queue_worker_boot.py` | baked into `eliteew-queue-worker` / `eliteew-site-studio-worker` | **A** for RabbitMQ workers only | No broker; verifies aio_pika import |
| *(none for Celery)* | — | **A** uses shell `pgrep` | Do not add aio_pika smoke to Celery images |
| `celery … inspect ping` | CLI in container | **C** / Admin | Broker broadcast; expensive — never interval healthcheck |

## Layer C entrypoints (reference)

| Script | Checks |
|--------|--------|
| `docker/scripts/prod-core-deploy-lib.sh` → `prod_core_deploy_smoke_stack0` | Host `:29000` / `:29001`, deploy-id parity, mobile profile 401/403 |
| same → `prod_core_deploy_smoke_stack0_contract` | API venv (bcrypt, no playwright), queue-worker up, sidecar HTTP |
| `docker/scripts/verify-stack0-deploy-contract-gate.sh` | Wrapper for contract function (live / negative-dns) |
| `docker/scripts/verify-stack0-user-path-gate.sh` | Public edge `/api/health`, Socket.IO sid |
| `docker/scripts/eliteew-migration-command-center.sh` acceptance | API, frontend, gpu141, edge, **celery inspect ping** (Layer C) |
| `docker/scripts/eliteew-public-surface-smoke.sh` | Public `/api/health` JSON shape |
| `docker/scripts/ugs-stack0-smoke.sh` | Domain UGS smoke via `/api/health` |

## Anti-patterns (Layer A)

| Forbidden | Why | Use instead |
|-----------|-----|-------------|
| `celery … inspect ping` on interval | Cold-imports `celery_app`, Redis broadcast; ×3 workers hammers CPU | `pgrep` for workers; inspect only in Layer C / Admin |
| `smoke_queue_worker_boot.py` on Celery workers | Checks RabbitMQ import, not Celery process | `pgrep` worker pattern |
| `curl /api/health` on workers without HTTP server | Workers are not HTTP services | process smoke or sidecar curl from API (Layer C) |
| Duplicate conflicting checks in Dockerfile **and** compose without comment | Drift (e.g. old `pgrep nginx` vs HTTP `/`) | Align both to HTTP `/` for frontend; document in this table |

## Frontend Dockerfile vs compose

Both must agree: **HTTP GET `/` on `:8080`**, not `pgrep nginx`.

- Compose: `docker/stack/stack0_f.yml` — `curl -sf http://127.0.0.1:8080/`
- Image: `docker/builders/stack0-frontend/Dockerfile` — `HEALTHCHECK` with same URL

Compose wins at runtime when both are set; keep them identical when changing either.

## After changing Layer A

1. Edit `docker/stack/stack0_b.yml` / `stack0_f.yml` / LAN override.
2. Update this doc if the matrix row changes.
3. Celery pools: extend lock in `tests/test_remediation_celery_topology_s4.py`.
4. Recreate affected containers on prod-core (compose healthcheck is not in baked image tag).
5. Layer C scripts: change only when **contract** changes, not when Layer A cheap check changes.

## Related

- [STACK0-BACKEND-IMAGES.md](STACK0-BACKEND-IMAGES.md) — smoke manual probes
- [CELERY-BEAT-AND-QUEUES.md](../CELERY-BEAT-AND-QUEUES.md) — beat ↔ queues (Celery Layer A summary)
- [SERVICES-VERIFICATION-CHECKLIST.md](../SERVICES-VERIFICATION-CHECKLIST.md) — operator podman ps + curl cheatsheet
- [STACK-CONTAINER-CONTROL.md](STACK-CONTAINER-CONTROL.md) — `eectl` recreate
