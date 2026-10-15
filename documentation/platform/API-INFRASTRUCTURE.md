# API Infrastructure – Single Owner and Zero Legacy

**Status:** living canon (2026-07-18).  
**Scope:** in-process connection ownership inside **EliteEW API** (`DatabaseManager`).  
**Not this doc:** host topology, edge, Meet WG, deploy lines — see [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) and [DOCKER-STACKS-PROD-OVERVIEW.md](DOCKER-STACKS-PROD-OVERVIEW.md).

This document describes the **unified infrastructure layer** for the EliteEW API: a single owner for all connections, a single source of truth for health, and how modules must obtain access.

## 1. Single owner: DatabaseManager

**Legacy removed:** a second SQLAlchemy engine + `get_db()` (historical `api/database.py`) duplicated the manager and skipped shared session behavior (encryption key, single pool). **Use only** `get_postgres_session` from `shared/api/core/database_manager.py`.

**All** infrastructure used by the API is owned and created only by `DatabaseManager` in `shared/api/core/database_manager.py`:

- **PostgreSQL** – SQLAlchemy engine + asyncpg pool  
- **Redis** – main pool + per-DB pools (e.g. Telegram, caches)  
- **Elasticsearch** – async client  
- **Minio/SeaweedFS** – S3 client  
- **RabbitMQ** – connection (when enabled)

Startup and shutdown are centralized in the FastAPI **lifespan** in `shared/api/main.py`: on startup the manager is initialized and `app.state` is populated; on shutdown `close_all_connections()` and related cleanup run.

## 2. Rule: no own connections

**Modules (routers, services, tasks) must not create their own clients or pools.**

Do **not** use:

- `asyncpg.create_pool`
- `redis.from_url` / `aioredis.from_url`
- `AsyncElasticsearch(...)`
- `Minio(...)`
- `aio_pika.connect_robust` (for RabbitMQ)

Use **only** the following entry points:

| Need | Usage |
|------|--------|
| PostgreSQL (SQLAlchemy) | `get_postgres_session()` (async context manager) |
| PostgreSQL (asyncpg pool) | `await get_asyncpg_pool()` or `await (await get_database_manager()).get_asyncpg_pool()` |
| Redis (default DB) | `await (await get_database_manager()).get_redis_client()` |
| Redis (other DB, e.g. Telegram) | `await (await get_database_manager()).get_redis_client(db=N)` |
| Redis (high-level API) | `get_redis_service()` (uses DatabaseManager pool internally) |
| Elasticsearch | `await (await get_database_manager()).get_elasticsearch_client()` |
| Minio/SeaweedFS | `await (await get_database_manager()).get_minio_client()` |

All of these resolve to the **same** DatabaseManager instance and its connections. Do not close pools/clients obtained from the manager; they are shared.

## 3. Redis: when to use which

- **`get_redis_client()` / `get_redis_client(db=N)`** – raw Redis client for ad‑hoc commands, rate limiters, caches, Telegram, etc. Use for one-off or service-specific logic.
- **`get_redis_service()`** – high-level RedisService (caching, sessions, TTL helpers). Use when you need its API; it already uses the manager’s pool.

Redis DSN/URL comes only from config: `DatabaseConfig.get_redis_url(...)` / `unified_settings`; no hardcoded Redis URLs in feature code.

## 4. Health: single source of truth

The **only** source of infrastructure health is `DatabaseManager.get_health_summary()`.

- **`/api/health`** – builds the response from `get_database_manager()` and `get_health_summary()`; no temporary Redis or other clients.
- **`/api/database/health`** – returns the same health summary (status, databases, connection_stats, timestamp).
- **`/metrics`** – Prometheus metrics include infrastructure status from the same health summary (e.g. `service_health_status{service="postgresql"}`).

All health endpoints must rely on the manager and must not create their own connections for checks.

## 5. Startup and shutdown

- **Startup (lifespan — API / long-lived loop)**  
  - Create/assign `DatabaseManager`, call `await manager.initialize()`.  
  - Set `app.state.db_pool` (and any other app.state used by routers) from the manager.  
  - Start the internal health monitor loop.

- **Celery prefork workers**  
  - Same `initialize()` for pools/clients, but **do not** start `_health_monitor_loop`.  
  - Cause: `run_celery_async` only pumps the process loop inside `run_until_complete`;  
    `asyncio.wait_for` deadlines are monotonic and expire while the loop is idle between  
    tasks → false `elasticsearch=down` / soft-reconnect timeouts on one ForkPoolWorker  
    while peers and the API stay healthy.  
  - Flag: `api.core.celery_async.mark_celery_worker_mode()` from `worker_process_init`  
    (also set by `ensure_celery_worker_loop`). Log: `[STEP] database_health_monitor_skip reason=celery_prefork_loop`.

- **Shutdown**  
  - Call `await manager.close_all_connections()` (Postgres, Redis, ES, Minio, RabbitMQ, per-DB Redis pools).  
  - Shutdown HTTP/session-related cleanup as needed.

No module should perform its own global connection lifecycle; it should only use the manager’s clients/pools and avoid closing them.

## 6. Observability

- **Logging** – On initialization the manager logs a short infrastructure summary (e.g. `postgres=ok, redis=ok, ...`). When health is not fully healthy, the health loop logs a brief line (e.g. `Infrastructure health degraded: postgres=healthy, redis=down`).
- **Metrics** – `/metrics` exposes infrastructure status via Prometheus gauges derived from `get_health_summary()` (e.g. `service_health_status`).
- **Structured health** – `get_health_summary()` returns overall status, per-database status, and connection_stats; use it for dashboards and alerts.

## 7. References

- **Implementation**: `shared/api/core/database_manager.py`
- **Lifespan and health routes**: `shared/api/main.py`
- **Redis layout**: [REDIS_ARCHITECTURE.md](REDIS_ARCHITECTURE.md)
- **Observability / no stack3**: [OBSERVABILITY-SLO-AND-INCIDENTS.md](OBSERVABILITY-SLO-AND-INCIDENTS.md)
