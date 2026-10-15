# Celery beat schedule and E0 queues

Living ownership map for EliteEW Celery (stack0 on prod-core). Operator UI: Admin → Workers (`?section=workers`). Ops API: [ADMIN-WORKERS-OPS.md](docker-re_doc/ADMIN-WORKERS-OPS.md). Topology: [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current.

## E0 worker pools (baked)

| Pool | Container | Queues | Notes |
|------|-----------|--------|-------|
| General | `stack0-eliteew-celery-worker-prod-baked` | `short`, `maintenance`, `broadcast`, `ewa_reembed` | Concurrency `STACK0_CELERY_GENERAL_CONCURRENCY` (default 4) |
| Agentic | `stack0-eliteew-celery-agentic-worker-prod-baked` | `ewa_agentic`, `ewa_agentic_step`, `ewa_factory` | Soft/hard 900/960s (factory ticks 120/180s) |
| Companion | `stack0-eliteew-celery-companion-worker-prod-baked` | `ewa_companion` | Soft/hard 540/600s |
| Discussion | `stack0-eliteew-celery-discussion-worker-prod-baked` | `desktop_discussion` | Soft/hard 540/600s; concurrency `STACK0_CELERY_DISCUSSION_CONCURRENCY` (default 2). Product: [DESKTOP-AI-CHAT-DISCUSSION-MODE.md](../product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md) |
| Beat (SPOF) | `stack0-eliteew-celery-beat-prod-baked` | — | Single scheduler; schedule file `/tmp/celerybeat-schedule` |
| Queue-worker | `stack0-eliteew-api-worker-prod-baked` | RabbitMQ (not Celery) | UGS / Site Studio aio-pika |

Source of truth for CLI queues: `docker/stack/stack0_b.prod-baked.override.yml` (mirrored in `stack0_b.dev-bind.override.yml`). App config: `shared/api/tasks/celery_app.py`.

## Rate limits

- Default annotation: `100/m` on `*`.
- Exempt (no Celery rate_limit): agentic loop/step, companion_run, universal orphan reaper, companion music/image/presentation stale reapers, agentic lease reaper, UGS stale reaper, video ringing reconcile.
- Admin snapshot exposes `celery.rate_limit_policy` for operators.

## Beat entries → queue → owner

Beat tasks without an explicit `task_routes` match use default queue **`short`**. Routes with wildcards (`*stale*` → `maintenance`, etc.) apply by task name prefix.

| Beat name (typical) | Task module | Queue | Owning product |
|---------------------|-------------|-------|----------------|
| `desktop-ai-solo-slot-cleanup` | `api.tasks.desktop_ai_solo_slot_cleanup` | maintenance | desktop-ai-chat |
| `desktop-discussion-lease-reaper` | `api.tasks.desktop_discussion_lease_reaper` | maintenance (`*stale*`) | desktop-ai-chat Discussion (every 2 min) |
| `music-batch-stale-running-reaper` | `api.tasks.music_batch_stale_running_reaper` | maintenance | music-forge |
| `companion-music-stale-run-reaper` | `api.tasks.companion_music_stale_run_reaper` | maintenance | ewa-companion |
| `companion-presentation-stale-run-reaper` | `api.tasks.companion_presentation_stale_run_reaper` | maintenance | ewa-companion / ewrp |
| `companion-image-stale-run-reaper` | `api.tasks.companion_image_stale_run_reaper` | maintenance | ewa-companion |
| `ewa-universal-orphan-reaper` | `api.tasks.ewa_universal_orphan_reaper` | maintenance | ewa-companion |
| `music-evolution-stale-run-reaper` | `api.tasks.music_evolution` | maintenance | music-forge |
| `music-forge-orphan-run-reconcile` | `api.tasks.music_forge` | short (default) | music-forge |
| `ugs-stale-request-reaper` | `api.tasks.ugs_stale_request_reaper` | maintenance | ugs-hub |
| `companion-episodic-reembed-pending` | `api.ewa_platform.workers.episodic_reembed_task` | ewa_reembed | ewa-companion |
| `companion-daily-rollup-utc` | `api.ewa_platform.workers.daily_rollup_task` | short (default) | ewa-companion |
| `companion-turn-dedup-cleanup` | `api.ewa_platform.workers.turn_dedup_cleanup_task` | short (default) | ewa-companion |
| `web-search-events-cleanup` | `api.tasks.web_search_events_cleanup` | short (default) | web-search |
| `video-call-ringing-reconcile` | `api.tasks.video_call_ringing_reconcile` | short | meet-jitsi / GAF video |
| `agentic-lease-reaper` (flagged) | `api.tasks.agentic_lease_reaper` | maintenance | ewa-companion |
| `companion-meta-evolution-sweep` (flagged) | `api.ewa_platform.workers.meta_evolution_sweep_task` | ewa_companion | ewa-companion |
| `mobile-wg-edge-peer-reconcile` (flagged) | `api.tasks.mobile_private_tunnel_edge_sync` | maintenance | mobile-android |
| `unified-content-hard-purge` (flagged) | `api.tasks.unified_content_hard_purge` | short (default) | content-manager |

Exact live catalog: Admin Workers → Beat tab, or `celery.conf.beat_schedule` in process.

**Route order invariant:** in `task_routes`, specific prefixes (e.g. `video_call_ringing_reconcile.*`) must appear **before** broad wildcards like `api.tasks.*stale*` — otherwise names containing `stale` are mis-routed to `maintenance`. Locked by `tests/test_celery_beat_schedule_routes.py`.

## Countdown tasks (not beat)

| Task | Queue | Note |
|------|-------|------|
| `video_call_delivery_watchdog` / `video_call_answer_timeout` | short | ETA lost on worker hard restart; **beat reconcile** every 15s recovers overdue ringing |
| Mobile WG edge sync on bind | maintenance | Also beat reconcile when enabled |

## Container healthcheck policy

Full three-layer map (compose vs Dockerfile vs deploy scripts): **[STACK0-HEALTHCHECK-LAYERS.md](docker-re_doc/STACK0-HEALTHCHECK-LAYERS.md)**.

Compose Layer **A** for Celery (cheap process liveness only):

| Service | Healthcheck | Interval |
|---------|-------------|----------|
| Celery workers (general / agentic / companion / discussion) | `pgrep -f '[c]elery.*worker'` | 60s |
| Celery beat | `pgrep -f '[c]elery.*beat'` | 30s |
| RabbitMQ queue-worker / site-studio-worker | `python /app/smoke/smoke_queue_worker_boot.py` | 60s |

**Forbidden as interval healthcheck:** `celery … inspect ping` (Layer **C** / Admin only).

Source compose: `docker/stack/stack0_b.yml`, LAN: `docker/stack/stack0_b_workers_lan.yml`.

## Log noise (ops)

| Symptom | Meaning |
|---------|---------|
| Frontend nginx `111` to API `:8000` on `/api/health` | Expected during API recreate; wait for healthy API before trusting proxy smoke |
| `PATCH /desktop/shell-state` **412** | Expected ETag conflict (multi-tab); logged at DEBUG, not WARNING |
| ES `ConnectionTimeout` on general Celery worker | Often content/search plane sharing the worker; episodic reembed with **0 pending** skips vector/ES I/O (`[STEP] companion_episodic_reembed_empty_skip`) |
| Beat `…pending_reembed` / `…ringing_reconcile` **succeeded** with zeros | Healthy idle tick (every 5 min / 15 s). Some log UIs prefix the **container** as `[!] ERROR in: stack0-…-celery-…` even when the line is Celery **INFO** — trust the level inside the line, not the banner |
| Ensemble blueprint DNS / ConnectError | Soft-degrade SSE (`Upstream temporarily unreachable`); typical when `stack2-llama-chat` is **Exited** or DNS fails inside the API container — not a Celery failure. See [STACK2-LLM-CONTRACT.md](STACK2-LLM-CONTRACT.md) §nvidia-uvm |
| High CPU with frequent `celery inspect ping` | Misconfigured interval healthcheck — replace with `pgrep` (this section) |

## Regression locks

- `tests/test_remediation_celery_topology_s4.py` — queue isolation + celery worker healthcheck = `pgrep` (not inspect ping / aio_pika smoke)
- `tests/test_ewa_trust_t5_celery_beat_health.py` / T6 dev-bind isolation
- `tests/test_workers_ops_service.py` — snapshot + baked labels + depths
- `tests/test_celery_beat_schedule_routes.py` — every beat task has a resolvable queue (default or route)
- `tests/test_video_call_ringing_reconcile.py` — ringing reconcile branches
- `tests/test_episodic_reembed_celery_empty_skip.py` — empty pending skips ES/Qdrant bootstrap
- `tests/test_monitoring_shell_state_412.py` — shell-state 412 not WARNING
