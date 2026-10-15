# Companion evolution: worker contract and scheduling

Source review: 2026-10-11. The cross-layer reference is [the evolution canon](../../../../documentation/product/ewa/EWA-COMPANION-EVOLUTION-CANON.md). This module guide covers the implemented Celery entry, its dispatch and completion semantics. It does not certify production flags, consumers or model availability.

## Entry and payload

[evolution_tick_task.py](../workers/evolution_tick_task.py) registers `ewa.platform.companion_evolution_tick`, imported through [API task registration](../../tasks/tasks.py). It accepts one optional object `payload` (also usable as the keyword argument):

- `principal_id`: required for useful work; blank returns `missing_principal_id` after pool setup.
- `tick_reason`: defaults to `scheduled`.
- `learned_preferences_delta`: optional mapping. Scalar processing sanitizes accepted fields; nested structured profile updates use the dedicated summary/meta branches.
- `idempotency_key`: optional string, trimmed/truncated to 128 characters.

`max_principals_per_tick` appears in the symbolic payload type but is not consumed by this single-principal worker. Active-plan fan-out uses a separate sweep. Without `EWA_DATABASE_URL`, pool opening yields `skipped: true, reason: EWA_DATABASE_URL_unset`. Other PG failures are not guaranteed to become a successful no-op.

Dispatch order:

1. `llm_summary` / `llm_evolution_summary` select [LLM summary](../companion/persona/evolution_summary.py), independently of a supplied scalar delta.
2. With no mapping delta, meta enabled and reason `scheduled` / `companion_meta_from_plan`, the worker attempts to build active-plan metadata. A nonempty result selects [meta apply](../companion/plans/meta_tick.py).
3. Otherwise [scalar evolution](../companion/persona/evolution_tick.py) merges sanitized shallow keys or records an empty-delta audit heartbeat. A scheduled reason alone does not guarantee a meta update.

Scalar sanitizer accepts at most 48 keys (letter first, alphanumeric/underscore, up to 128 characters) and scalar bool/int/finite-float/null/string values. Strings are trimmed and capped at 512 characters; nested objects/lists are dropped. Audit action is `evolution_tick`. Summary and meta use `evolution_tick_llm_summary` and `evolution_tick_meta` respectively.

## Best-effort completion deduplication

The worker uses Redis derived from the Celery Redis DB selection. An explicit key is preferred; otherwise it derives a key from principal, reason and canonical JSON of the sanitized scalar delta. The storage key is hashed/namespaced. `EWA_COMPANION_EVOLUTION_IDEMPOTENCY_TTL_SEC` defaults to 86400 seconds; invalid/nonpositive input falls back to that value.

A completed marker suppresses a later call before PG work, returning `duplicate_idempotency_key`. The marker is written **only when the result has `applied: true` and is not skipped**. Empty scalar heartbeats, too-short transcript audits, invalid model output and merge conflicts do not mark completion. Redis read/write failures allow execution without effective deduplication. The GET/work/SET sequence is not an atomic claim, so it does not promise exactly-once execution for concurrent duplicates.

Worker idempotency logs use a short hash prefix; the shared scheduling helper logs the first 40 characters of its explicit key and a principal. Do not put secrets in keys or assume every scheduling log contains only hashed material.

## Chat-triggered summary

[Trigger evaluation](../companion/persona/evolution_chat_trigger.py) runs before the profile patch and records enqueue state in `companion_evolution_chat_v1`; [turn side effects](../companion/turn/turn_memory_sideeffects.py) schedule after persistence. It counts retained user rows in `desktop_friend_chat_v1.messages`, requires a minimum/delta threshold plus cooldown, and skips the Arlika lightweight path.

Defaults: `EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT=0`, `EWA_COMPANION_EVOLUTION_USE_LLM=1`, every-N=10, minimum=6, cooldown=1200 seconds. The corresponding threshold variables are `EWA_COMPANION_EVOLUTION_AUTO_EVERY_N_USER_TURNS`, `...AUTO_MIN_USER_TURNS`, `...AUTO_COOLDOWN_SEC`. The explicit key is `llm_summary:chat:v1:{principal_id}:{epoch}`.

Current limitation: the transcript is trimmed to 240 messages, so its retained user count eventually stops advancing. [DOC-CODE-012](../../../../docs/CODE_ISSUES.md#doc-code-012--chat-triggered-evolution-stops-advancing-at-the-transcript-cap) reproduces loss of periodic triggers beyond that cap. The enqueue state is also persisted before `.delay`; a scheduling failure does not prove a job was delivered. The helper returns false/logs failures without raising into the HTTP caller.

Summary reads up to 60 retained message rows (30 pairs), needs at least four usable rows, and asks the configured model for bounded JSON. Model selection falls back through evolution/chat/orchestration/default configuration; an empty override does not disable summary. Predict budget defaults to 1024 (256–4096), timeout 120 seconds (20–600), controlled by `EWA_COMPANION_EVOLUTION_NUM_PREDICT` / `...TIMEOUT_SEC`. Invalid/empty suggestions become audited no-ops. Successful output applies bounded character drift and merges up to two beliefs, two pride entries and three memories, with an optimistic profile revision check. Model failure handling does not make every DB failure nonfatal.

## Plan metadata and beat

[Plan hook and sweep](../companion/plans/meta_schedule.py) enqueue through the same helper:

- A successful `plan_v1` hook requires both `EWA_COMPANION_PLAN_ENABLED` and `EWA_COMPANION_META_EVOLUTION_ENABLED` (both default 0); key `meta:plan:v1:{principal_id}:{plan_id}`.
- Active-plan sweep requires meta and `EWA_COMPANION_META_EVOLUTION_BEAT_ENABLED` (beat defaults to 1 conditional on meta). Interval defaults to 60 minutes, clamped to 15–1440. Sweep limit defaults to 500, clamped to 1–5000, via `EWA_COMPANION_META_EVOLUTION_SWEEP_LIMIT`.
- Scheduled key uses a UTC hour bucket: `meta:scheduled:v1:{principal_id}:{plan_id}:{YYYYMMDDHH}`. Keys are capped at 128 characters.

Meta builds a digest of up to five open task titles and `last_plan_id`, then revision-checks the profile patch under `companion_meta_v1`. It does not call the summary LLM. See [server plans](../../../../documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md).

## Queue, pool and observability

The source routing pattern for evolution does not match its registered task name. The ordinary `.delay` path resolves to default queue `short`, despite the intended companion route: [DOC-CODE-014](../../../../docs/CODE_ISSUES.md#doc-code-014--celery-routes-use-module-names-instead-of-registered-ewa-task-names). Do not assume a companion-only worker consumes it. [Worker guide](../workers/README.md) distinguishes explicit queue overrides from configured routes.

Workers reuse a process/event-loop EWA pool; they do not close it after each task. Audit rows/profile revision, task result and scheduling/application logs are separate evidence: `scheduled` means enqueue returned, `applied` means the profile path returned a patch, and an audit-only result can be unapplied. User-facing change summaries remain a product presentation concern; this guide does not assert a complete UI export.

Existing idempotency/trigger/sanitizer tests were executed without a broker/DB/model request. Runtime verification needs an authorized environment with flags, migrations, worker queues and model connectivity checked independently.
