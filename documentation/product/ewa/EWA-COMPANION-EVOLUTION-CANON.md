# EWA companion evolution: persona and memory layers

Source review: 2026-10-11. This is the entry reference for changes to companion `learned_preferences`, episodic records and derived memory. Implementation details for the shared Celery entry are in [COMPANION-EVOLUTION-PIPELINE.md](../../../shared/api/ewa_platform/docs/COMPANION-EVOLUTION-PIPELINE.md). Source defaults below do not claim a deployment is enabled.

Historical evolution/auto-summary plans were previously soft-retired under `trash/` (recorded ids 20260812-154629 / 20260718-021522). They are historical provenance, not current implementation evidence.

## Layer responsibilities

### L0 — per-turn character

[Turn side effects](../../../shared/api/ewa_platform/companion/turn/turn_memory_sideeffects.py) use [character helpers](../../../shared/api/ewa_platform/companion/persona/character.py) to write `companion_character_v1` and optional `companion_memory_v1` echoes after a chat response. Inputs include the user line, affective routing and an optional trust delta. Character contains traits, mood, bonds, interaction style, beliefs, pride and a bounded growth log.

`apply_drift_patch` moves a trait toward a target by at most 0.05 per call and clamps traits to 0–1. This is a helper-call bound, not a global bound over every update made during a whole turn. Mood, direct bond updates and multiple character helper passes have their own rules. It is not model weight training.

### L0b — continuity micro-state

[Continuity](../../../shared/api/ewa_platform/companion/persona/continuity.py) writes `companion_continuity_v1` only with `EWA_COMPANION_CONTINUITY_V1_ENABLED` enabled (default 0). It contains mood tint, valence/arousal, short sanitized topic notes and a decay timestamp. Default decay half-life is 18 hours; decay is a read-time view until the next write. Turn valence/arousal movement is bounded to 0.15 each. Prompt text is capped at 180 characters and can be empty when neutral/rested.

This micro-state is separate from long-term facts and episodic recall. The implementation's notes are bounded topic fragments; they are not raw private reasoning. See [proactive observer](EWA-COMPANION-PROACTIVE-OBSERVER.md) for the separate observer integration. The previously retired Cause roadmap is historical material.

### L1 — chat summary

[Trigger](../../../shared/api/ewa_platform/companion/persona/evolution_chat_trigger.py) tracks an epoch in `companion_evolution_chat_v1` and schedules `ewa.platform.companion_evolution_tick` after successful chat persistence. Auto enqueue defaults off; summary execution defaults on when explicitly called. Every-N/minimum/cooldown source defaults are 10/6/1200 seconds. Arlika lightweight turns skip enqueue.

[Summary](../../../shared/api/ewa_platform/companion/persona/evolution_summary.py) reads the retained transcript, character and memory, requests bounded model JSON and writes character/memory via optimistic revision checking. Invalid output, too-short transcript or merge conflict can produce an audit without an applied change. The chat counter currently saturates with the 240-message transcript cap; see [DOC-CODE-012](../../../docs/CODE_ISSUES.md#doc-code-012--chat-triggered-evolution-stops-advancing-at-the-transcript-cap).

### L2 — plan metadata

[Meta helpers](../../../shared/api/ewa_platform/companion/plans/meta_tick.py) summarize active-plan open task titles into `companion_meta_v1` (`goals_digest`, `last_plan_id`, update timestamp). They do not use a summary model. Both plan/meta flags are required for the successful-plan hook; a separate conditional beat sweep finds active-plan principals. Missing plan data can fall back to scalar/heartbeat processing at the shared worker entry.

### L3 — episodic and atom memory

[Episodic writer](../../../shared/api/ewa_platform/companion/episodic/writer.py) records sanitized user-turn text in EWA PG, then attempts optional atom ingestion and vector indexing. Episodic flag `EWA_COMPANION_HCM_EPISODIC_ENABLED` defaults to 1; atom flag defaults to 0. Recording and indexing are different success boundaries. Caller scheduling can be asynchronous; inside recording, atom ingestion is awaited before vector work.

See [HCM memory](EWA-COMPANION-HCM-MEMORY.md) for its wider recall/reindex contract and [atom layer](EWA-ATOM-LAYER.md) for node/edge fields, filters and the currently ineffective default-codec metadata round trip. A stored atom TTL is not evidence of automatic deletion.

### L4 — daily operational recap

[Daily rollup](../../../shared/api/ewa_platform/companion/episodic/daily_rollup.py) aggregates the previous UTC day's nonempty episodes per principal and patches `companion_daily_rollup_v1`: day, episode count, a snippet up to 480 characters, generation time and UTC-boundary note. It uses up to 24 recent bodies, truncating each to 220 characters before assembling the snippet. This is text aggregation, not LLM inference or a claim of consciousness.

An optional valid `target_day_iso` payload selects another day; invalid text falls back to yesterday UTC. Repeating a day overwrites the same namespace, but also follows normal patch/audit behavior; it is not an exactly-once job.

### L5 — scalar merge

[Scalar evolution](../../../shared/api/ewa_platform/companion/persona/evolution_tick.py) sanitizes shallow scalar preference deltas. It cannot express the nested character/memory/meta structures handled by their dedicated branches. Empty sanitized input creates an audit heartbeat without `applied: true`.

## Scheduling and completion

The shared task routes `llm_summary`/`llm_evolution_summary` to L1, a successfully built scheduled/plan meta delta to L2, and other input to L5. [Pipeline guide](../../../shared/api/ewa_platform/docs/COMPANION-EVOLUTION-PIPELINE.md) defines payloads, fallbacks, result reasons and sanitizer limits.

Redis completion markers are best-effort and written only for applied, non-skipped results. Default TTL is 86400 seconds. Explicit keys distinguish chat epochs, plan ids and scheduled UTC hour buckets; a derived scalar key includes the sanitized delta. Neither Redis failure nor simultaneous GET/work/SET calls provides exactly-once execution.

[Celery configuration](../../../shared/api/tasks/celery_app.py) uses timezone UTC and declares:

- episodic pending re-embedding every **5 minutes**;
- daily rollup at **04:20 UTC**;
- meta sweep only when meta and its conditional beat switch are enabled, at the configured 15–1440 minute interval (default 60).

These are source schedules. Actual beat activity and worker delivery were not observed. Evolution's normal `.delay` currently resolves to `short` because of a registered-name routing mismatch: [DOC-CODE-014](../../../docs/CODE_ISSUES.md#doc-code-014--celery-routes-use-module-names-instead-of-registered-ewa-task-names).

## Configuration and verification

Plan/meta/continuity/atom master flags default off; episodic and LLM summary execution default on. Meta beat defaults on only after meta is enabled. An empty evolution model override uses configured model fallbacks; set `EWA_COMPANION_EVOLUTION_USE_LLM=0` to disable that summary branch. Model/predict/timeout and enqueue threshold limits are detailed in the pipeline guide.

Check profile revision/audit action and task results separately from enqueue logs. Useful markers include `companion_evolution_enqueue_scheduled`, `companion_evolution_enqueue_skipped`, `companion_evolution_llm_summary_scheduled`, `companion_meta_from_plan_scheduled`, `companion_meta_evolution_sweep_done` and `companion_meta_evolution_applied`. A scheduling log does not prove an applied profile change.

Audit verification used existing pure/mock-backed atom, idempotency, trigger and sanitizer tests plus synthetic probes. No production PG, broker, inference server or enabled live beat was exercised. In an authorized test environment, verify flags/pool/migrations/actual queue consumption first, then chat summary, active-plan metadata and a known UTC rollup, observing both no-op and applied results. The transcript-cap and atom decoder/schema defects remain open in [the append-only findings log](../../../docs/CODE_ISSUES.md).

Related: [profile ADR](EWA-COMPANION-PROFILE-ADR.md), [operations panel](EWA-COMPANION-OPERATIONS-PANEL.md), [server plans](EWA-COMPANION-SERVER-PLANS-ADR.md), [chat phases](EWA-COMPANION-CHAT-TURN-PHASES.md). Music generation is a companion task/UGS operation, with its own run lifecycle; it is not a persona-evolution layer.
