# Background asyncio task tracking (A-05, A-08)

**Status:** Canon  
**Updated:** 2026-07-04

Critical in-process background work must not use bare `asyncio.create_task` without lifecycle visibility. Audit A-05: silent loss when the event loop drops an unhandled exception with no operator trace.

## Module

| Path | Role |
|------|------|
| `shared/api/core/async_utils.py` | `BackgroundTaskManager`, `track_background_task`, `await_tracked_background_task`, `correlation_id_from_request`, `correlation_id_from_queue_payload` |

## Contract

- Every tracked task gets a **`task_id`** (UUID hex) and optional **`correlation_id`** (HTTP `X-Request-Id` / `X-Correlation-Id` or minted UUID).
- Lifecycle is logged as JSON lines prefixed with **`[BG_TASK]`** — no SQL row per start/stop.
- In-memory registry supports:
  - `running_count()` / `list_running()`
  - `failed_since(datetime)`
  - `stale_tasks(max_age_sec)` for started/running rows older than threshold
- Fire-and-forget wrappers **log failures** (with traceback) and do not re-raise after logging.
- Queue handlers use **`await_tracked_background_task(..., swallow_errors=True)`** — inline await with the same registry; failures are logged and swallowed so primary processing flow continues.

## Usage (HTTP fire-and-forget)

```python
from api.core.async_utils import correlation_id_from_request, track_background_task

track_background_task(
    _run_ewrp_pipeline(job_id, user_id),
    name="ewrp_pipeline",
    correlation_id=correlation_id_from_request(request),
    metadata={"job_id": job_id, "user_id": user_id},
)
```

## Usage (queue inline await)

```python
from api.core.async_utils import (
    await_tracked_background_task,
    correlation_id_from_queue_payload,
)

correlation_id = correlation_id_from_queue_payload(payload)
await await_tracked_background_task(
    _index_unified_content_elasticsearch(content_id, db_pool),
    name="unified_content_es_index",
    correlation_id=correlation_id,
    metadata={"content_id": str(content_id)},
    swallow_errors=True,
)
```

## Refactored call sites

| Area | Change |
|------|--------|
| `api/routers/ewrp.py` `_enqueue_ewrp_pipeline` | `track_background_task` instead of `asyncio.create_task`; correlation_id from create endpoint |
| `api/workers/queue_handlers.py` `handle_unified_content_processing` | ES / marketing RAG / Qdrant indexing wrapped with `await_tracked_background_task`; replaces silent `except Exception: pass` (A-08) |

Other `asyncio.create_task` usages (SSE pump, health monitors) are short-lived or already joined — migrate when audit flags them as durable/critical.

## Tests

| File | Scope |
|------|-------|
| `shared/api/tests/test_asyncio_task_loss.py` | Phase-0 evidence (raw `create_task` untracked) + tracked failure with correlation_id (A-05) |
| `shared/api/tests/test_indexing_visibility.py` | Legacy silent index failure vs tracked registry + `[BG_TASK]` log; handler integration + happy path (A-08) |

## Operator grep

```bash
rg '\[BG_TASK\].*background_task_failed' docker/logs/stack0/
```

Filter by `correlation_id` or `task_name` in the JSON payload.

---

## Celery companion runs (R-02, A-03)

Durable step rows in Postgres are the **single source of truth** for `companion_run_task` idempotency. Celery `max_retries` may re-invoke `execute_companion_run`; the executor must not re-dispatch handlers for steps already terminal or actively in-flight.

| Path | Role |
|------|------|
| `shared/api/ewa_platform/companion/jobs/step_idempotency.py` | `evaluate_step_dispatch`, `should_mark_step_in_progress`, `log_task_step_skip` |
| `shared/api/ewa_platform/companion/jobs/executor.py` | DB refresh → short-circuit before `mark_step_in_progress` / `dispatch_step` |
| `shared/api/ewa_platform/workers/celery_beat_guard.py` | Beat tasks: structured `[STEP] …_failed` log + re-raise (no swallow) |

### Skip audit log

Skipped steps emit **`[TASK_SKIP]`** with `run_id`, `step_index`, `step_kind`, `reason` — grep alongside `[STEP] companion_job_executor_step_short_circuit`.

Env: `EWA_COMPANION_STEP_IN_PROGRESS_FRESH_SEC` (default **120**) — fresh `in_progress` without output is treated as an active lease.

### Tests

| File | Scope |
|------|-------|
| `tests/test_celery_task_retry_idempotency_risk.py` | R-02 Phase 0: without-guard double step-1; with-guard + Network Timeout retry |
| `tests/test_companion_task_retry_idempotency.py` | A-03 regression lock |

```bash
bash docker/scripts/run-worker-tests.sh -k task_retry_idempotency -q
```

Product canon: [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](../product/ewa/EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) §2.3.
