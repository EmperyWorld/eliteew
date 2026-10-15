# EWA workers: registered tasks, queues and storage

Source review: 2026-10-11. [API task registration](../../tasks/tasks.py) imports runnable workers. [Celery configuration](../../tasks/celery_app.py) declares routes, queues, annotations and beat; [orchestration task enums](orchestration_tasks.py) alone do not register anything with the broker.

## Task names and queue behavior

- [Companion runner](companion_task_runner.py): `ewa.platform.companion_run_task`; [normal enqueue](../companion/jobs/enqueue.py) explicitly selects `ewa_companion`.
- [Agentic loop](agentic_task_runner.py): `ewa.platform.agentic_loop_tick`; [normal enqueue](../agentic/jobs/enqueue.py) explicitly selects `ewa_agentic`.
- [Agentic step](agentic_step_runner.py): `ewa.platform.agentic_step_task`; the enqueue helper explicitly selects `ewa_agentic_step`.
- [Evolution](evolution_tick_task.py): `ewa.platform.companion_evolution_tick`; its shared scheduling helper uses `.delay` without a queue override and currently resolves to `short`.
- [Meta sweep](meta_evolution_sweep_task.py): `api.ewa_platform.workers.meta_evolution_sweep_task.run_companion_meta_evolution_sweep`; its matching module route selects `ewa_companion`.
- [Episodic re-embed](episodic_reembed_task.py): `api.ewa_platform.workers.episodic_reembed_task.run_companion_episodic_pending_reembed` and `...run_companion_episodic_drain_backlog`; the module route selects `ewa_reembed`.
- [Daily rollup](daily_rollup_task.py): `api.ewa_platform.workers.daily_rollup_task.run_companion_daily_rollup`; no dedicated route is declared, so the default is `short`.

Configured module-path routes for the first three enum-named runners and evolution do not match their registered task names. Explicit helper queues protect the ordinary companion/agentic paths; they do not repair direct `.delay` or name-based routing. The actual router was checked without publishing: [DOC-CODE-014](../../../../docs/CODE_ISSUES.md#doc-code-014--celery-routes-use-module-names-instead-of-registered-ewa-task-names). Do not infer successful consumption merely from a declared queue or compose worker name. The factory and cleanup runners are additional registered surfaces; this guide does not certify their complete business workflows.

## Pool and execution boundaries

[ewa_pool.py](ewa_pool.py) reuses a process/event-loop asyncpg pool; [data-plane bootstrap](../bootstrap/data_plane.py) initializes schema/settings. Source defaults are minimum 1 / maximum 4 for worker pool sizing, with bounded `EWA_CELERY_POOL_MIN` / `EWA_CELERY_POOL_MAX` overrides. Lifecycle shutdown closes the pool; tasks must not close the shared pool after each call. HTTP uses its own runtime/pool lifecycle.

The runner helpers bridge synchronous Celery functions to async domain execution. Companion/agentic jobs use persisted domain run/session/step state and their dedicated auth/enqueue/recovery code. Retry limits, lease handling and time limits differ by runner; an outbox enum is not proof of a working durable outbox consumer. Reserved-only names include `ewa.platform.process_run`, `ewa.platform.outbox_flush`, `ewa.platform.orchestration_tick` and `ewa.platform.outbox_desktop_flush`.

Evolution and meta return explicit skip reasons when their EWA pool is unavailable from a missing DSN. Evolution Redis markers are best-effort applied-result deduplication, not broker acknowledgements or an exactly-once lock. See [evolution pipeline](../docs/COMPANION-EVOLUTION-PIPELINE.md).

## Beat and re-index boundaries

Source beat schedules pending episodic re-embedding every 5 minutes and daily rollup at 04:20 UTC. Meta sweep is conditional on its master/beat flags. Empty re-embed backlog skips settings/vector clients; nonempty work bootstraps settings and performs vector work. Some upstream connection/timeout failures become `upstream_unreachable`; other failures propagate. Drain accepts optional principal and `max_rounds`; it is a separate on-demand entry, not a second periodic schedule.

Deployment topology and worker service placement belong to [PRODUCTION-TOPOLOGY-STATE.md](../../../../documentation/platform/PRODUCTION-TOPOLOGY-STATE.md) §Current. No running worker, queue length, beat delivery or live re-index was inspected during the documentation audit. Review detailed companion/agentic and queue-auth references before changing task lifecycle or tenant boundaries.
