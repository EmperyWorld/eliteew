# Admin Workers Ops (Celery + RabbitMQ)

Operator surface in unified Admin for stack0 background workers.

## UI

Admin shell → **System** group → **Workers** (`?section=workers`).

Tabs: Overview | Celery | Beat | RabbitMQ | Actions.

Auto-refresh every **30s** while the section is mounted (manual Refresh still available).

Modular FE (no monolith panel file):

| Module | Role |
|--------|------|
| `WorkersAdminSection.tsx` | Shell, New World tabs/refresh/`DangerConfirmModal`, actions wiring |
| `WorkersOverviewPanel.tsx` | Pool KPIs + inspect honesty |
| `WorkersCeleryPanel.tsx` | Nodes, depths, live task tables |
| `WorkersBeatPanel.tsx` | Beat health + schedule |
| `WorkersRabbitmqPanel.tsx` | Queue-ops summary + raw JSON |
| `WorkersActionsPanel.tsx` | Revoke / purge (New World fields + buttons; confirm in section) |
| `workersOpsApi.ts` | Typed client |

## API

Mounted under `/api/v1/desktop/admin/workers-ops/` (desktop admin router).

| Method | Path | Auth | Role |
|--------|------|------|------|
| `GET` | `/snapshot` | OAuth2 | `admin` or `emperyworld_admin` |
| `POST` | `/revoke` | OAuth2 | `emperyworld_admin` only (JWT must carry that role; not collapsed to `admin`) |
| `POST` | `/purge-queue` | OAuth2 | `emperyworld_admin` only |

Actions tab: without `emperyworld_admin` the UI shows an honest empty state (no fake disabled forms). Overview / Celery / Beat / RabbitMQ remain available to any Unified Admin role.

### Snapshot payload (high level)

- **celery** — phased `control.inspect`:
  - **Phase A (essential):** `ping` + `active_queues` (drives pool online + `workers_online`)
  - **Phase B (detail, best-effort):** `stats` / `active` / `reserved` / `scheduled` / `registered` within remaining budget
  - configured queue catalog, **`queue_depths`** (Redis LLEN on `CELERY_REDIS_DB`; `status: degraded` + empty `depths` on failure — no fake zeros), **`rate_limit_policy`**, **`inspect_phases`** timings, status `ok|degraded|unavailable`
- **beat** — `build_celery_beat_health_slice()` + static `beat_schedule` catalog
- **rabbitmq** — reuse UGS `build_queue_ops_snapshot` (Postgres + RabbitMQ management + Redis leases)
- **expected_pools** — compose-aligned **`-prod-baked`** container names with online heuristics:
  - Celery pools: hostname prefix (`worker@` / `agentic-worker@` / `companion-worker@`) **or** queue coverage from `active_queues`
  - Beat: beat health slice
  - RabbitMQ: leases / management `ok`
  - Each pool may include `matched_workers` + `online_reason`

### Inspect budgets (cause of false Offline)

Celery inspect waits ~reply window per broadcast. Do **not** pack seven inspect calls under a ~6s outer `asyncio.wait_for` — that yields `inspect_timeout` and **0 workers** in Admin while CLI ping still works.

Canonical budgets live in `api/services/workers_ops/inspect_celery.py` (`INSPECT_REPLY_TIMEOUT_SEC`, essential + detail budgets, `INSPECT_TOTAL_BUDGET_SEC`).

### Revoke body

```json
{ "task_id": "<celery-task-id>", "terminate": false }
```

`terminate: true` asks Celery to SIGTERM the running child.

### Purge body

```json
{ "queue": "short" }
```

Queue name must be in `celery_app.conf.task_queues` (whitelist). Unknown names → `400`.

## Expected containers (prod-core)

| Pool | Container | Queues | Hostname prefix |
|------|-----------|--------|-----------------|
| Celery general | `stack0-eliteew-celery-worker-prod-baked` | `short`, `maintenance`, `broadcast`, `ewa_reembed` | `worker@` |
| Celery agentic | `stack0-eliteew-celery-agentic-worker-prod-baked` | `ewa_agentic`, `ewa_agentic_step` | `agentic-worker@` |
| Celery companion | `stack0-eliteew-celery-companion-worker-prod-baked` | `ewa_companion` | `companion-worker@` |
| Celery discussion | `stack0-eliteew-celery-discussion-worker-prod-baked` | `desktop_discussion` | `discussion-worker@` |
| Celery beat (SPOF) | `stack0-eliteew-celery-beat-prod-baked` | — | — |
| RabbitMQ queue-worker | `stack0-eliteew-api-worker-prod-baked` | UGS / Site Studio / documents (aio-pika) | — |

Compose marks workers **healthy** via cheap `pgrep` process checks — see [STACK0-HEALTHCHECK-LAYERS.md](STACK0-HEALTHCHECK-LAYERS.md) (Layer A) and [CELERY-BEAT-AND-QUEUES.md](../CELERY-BEAT-AND-QUEUES.md). Admin snapshot `inspect` is Layer **C** / on-demand — not the container healthcheck.

## Out of scope

- Flower
- Restart/recreate containers from Admin (use `eectl` / `eliteew-deploy.sh` / host ops on command-center; DEWA soft-retired → `trash/`)
- Runtime edit of beat schedule
- GPU141 inference as a first-class tab

## Code

Backend package (modular):

| Module | Role |
|--------|------|
| `api/services/workers_ops/snapshot.py` | Aggregate snapshot |
| `api/services/workers_ops/inspect_celery.py` | Phased inspect |
| `api/services/workers_ops/pools.py` | Expected pools + online match |
| `api/services/workers_ops/catalog.py` | Queues / beat schedule / rate limits |
| `api/services/workers_ops/queue_depths.py` | Redis LLEN |
| `api/services/workers_ops/actions.py` | Revoke / purge |
| `api/services/workers_ops/celery_workers_ops_service.py` | Compatibility facade |

- Router: `shared/api/routers/desktop_admin_workers_ops.py`
- FE: `shared/web/frontend/src/pages/Admin/workers/`
- Tests: `shared/api/tests/test_workers_ops_service.py`, FE `workers/__tests__/workersAdmin.contract.test.ts`

## Related

- [CELERY-BEAT-AND-QUEUES.md](../CELERY-BEAT-AND-QUEUES.md) — beat ↔ queue ownership, E0 pools, log-noise notes
- [STACK0-HEALTHCHECK-LAYERS.md](STACK0-HEALTHCHECK-LAYERS.md) — compose vs deploy vs Admin inspect layers
- [UGS-QUEUE-OPERATIONS-RUNBOOK.md](UGS-QUEUE-OPERATIONS-RUNBOOK.md) — RabbitMQ plane details
- [UGS-QUEUE-OPERATOR-ENV.md](UGS-QUEUE-OPERATOR-ENV.md) — queue-ops env
- Compose: `docker/stack/stack0_b.yml` + `stack0_b.prod-baked.override.yml`

## Frontend proxy noise

During API container recreate, spa/nginx may log `connect() failed (111)` to upstream `:8000` for `/api/health`. That is expected until the API is healthy again; smoke after release should wait on API health before treating frontend proxy failures as regressions.
