# EWA Hierarchical Context Management (HCM) memory

Source review: 2026-10-11. HCM combines profile facts/story, optional atoms and episodic recall for the companion prompt. EWA Postgres stores episodes; Qdrant provides a rebuildable vector index. Profile namespaces remain defined by [the profile ADR](EWA-COMPANION-PROFILE-ADR.md). HCM retrieval layers and the L0–L5 [evolution layers](EWA-COMPANION-EVOLUTION-CANON.md) are different classifications.

## Implementation map

- [Profile memory helpers](../../../shared/api/ewa_platform/companion/memory/hcm_store.py): normalize, hash/deduplicate, merge, select facts and render a bounded memory block.
- [Memory composer](../../../shared/api/ewa_platform/companion/memory/retrieval.py): story/identity, task recency, atoms, semantic recall and recency fallback.
- [Episodic writer](../../../shared/api/ewa_platform/companion/episodic/writer.py), [PG adapter](../../../shared/api/ewa_platform/persistence_pg/episodes_asyncpg.py), [Qdrant adapter](../../../shared/api/ewa_platform/persistence_vector/companion_qdrant.py).
- [Re-embed runner](../../../shared/api/ewa_platform/companion/episodic/reembed.py) and [backoff](../../../shared/api/ewa_platform/companion/episodic/reembed_backoff.py).
- [Task outcome bridge](../../../shared/api/ewa_platform/companion/episodic/task_outcome_bridge.py), [body builder](../../../shared/api/ewa_platform/companion/episodic/task_outcome.py).
- [Context anchor](../../../shared/api/ewa_platform/companion/context/anchor.py), [anchor composer](../../../shared/api/ewa_platform/companion/context/anchor_compose.py), [controller](../../../shared/api/ewa_platform/companion/context/controller.py), [noise filters](../../../shared/api/ewa_platform/companion/context/noise.py), [episode sanitizer](../../../shared/api/ewa_platform/companion/episodic/body_sanitize.py).

The old flattened module paths and `api/tasks/companion_*` filenames are historical references; current implementations are linked above. Operator-local rollout plans under `documentation/plans/` are not the living contract.

## Records and writing

`ewa_companion_episodes` fields include string id/principal/optional turn id, `kind`, `source`, persona, importance/valence in 0–1, bounded body, JSONB `extra`, vector status/model/dimension and timestamps. Migration [005](../../../shared/api/ewa_platform/migrations/applied/005_ewa_companion_episodes.sql) defines episodes; [006](../../../shared/api/ewa_platform/migrations/applied/006_ewa_companion_episode_link.sql) adds episode links. Bootstrap also initializes schema; see [migration guidance](../../../shared/api/ewa_platform/migrations/README.md) before any actual database operation.

User-turn recording sanitizes text, inserts a PG row with `vector_status: pending`, awaits optional [atom ingestion](EWA-ATOM-LAYER.md), then attempts embedding/collection creation/upsert. Missing vectors/client/collection initialization leaves the inserted row available in PG. Successful upsert marks it indexed. A false upsert result marks it failed; this foreground path does not use the re-embed runner's transient-error classification. PG insertion failure logs and returns no row. The final failed-status update is not inside a universal catch, so the writer's source comment saying it never raises is not an unconditional error guarantee.

The chat side-effect helper schedules user recording in the running event loop; it is not a durable broker handoff. The writer records user text rather than every assistant reply. Observer and task-outcome writers are separate paths; these mechanisms already exist and are not described as future PR phases.

Qdrant collection names are `ewa_companion_episodic_v1_d{dim}` using the configured embedding dimension (source default 768). Point ids are deterministic UUIDv5 from principal plus episode id. A dimension in the collection name separates dimensions; it does not by itself handle changing to another model with the same dimension. Payload includes principal/body/kind/source/persona, importance/valence/time and optional intent/session metadata.

## Terminal task memory

The bridge accepts `completed`, `failed`, `cancelled` and `abandoned` run statuses; abandoned is represented as failed memory. It determines `agentic`, `companion_task` or `chat_tool` source and builds a compact goal/status/outcome/artifact body, without task-progress scaffold text. Extra includes `dedupe_key`, run/status and optional session/mode.

Dedup checks `source:run_id:status` in `extra` before insertion. This is a best-effort check without a unique dedupe constraint; concurrent duplicate calls are not guaranteed exactly-once. Async task-run update/mirror code awaits the bridge so it completes in the runner lifecycle. A separate scheduler exists for callers that cannot await and skips if no event loop exists.

Task outcomes contribute a five-row recent-task section and can also appear in semantic/recency recall. The `recall_memory` tool consumes related memory helpers; run status/operations UI remain separate from remembered summaries.

## Prompt retrieval order

For typed input, `compose_memory_window` returns a `MemoryWindow`: prompt section, used layers, episodic hit count, fallback flag, layer telemetry and deep-short-circuit flag.

1. Up to 32 story anchors are pinned under their story heading. Identity/preference facts exclude story rows and select up to 128 entries by `importance * 0.7 + recency * 0.3` (recency half-life 14 days).
2. With a pool/principal, the composer adds up to five recent task outcomes, sanitized and deduplicated against earlier content.
3. Optional atom snippets form a middle layer. See [atom contracts and known decoder defect](EWA-ATOM-LAYER.md); stored TTL/task metadata currently loses its values on the default-codec read path.
4. Unless the retrieval router short-circuits, nonempty query/principal trigger embedding and Qdrant search. The Qdrant adapter filters by principal and optionally kinds/personas; it prefers `query_points` and retains an older `search` fallback. Missing collection errors can initialize the collection and retry once.
5. Hits may be ordered by confident intent/session topic, reranked by the HTTP reranker and ranked using [persona style](../../../shared/api/ewa_platform/companion/affective/persona_style.py). Episodic body duplicates of earlier facts/anchors are removed.
6. If no usable episodic lines remain and deep retrieval was not short-circuited, PG recent episodes provide fallback. It can run after a timeout/empty embedding/client as well as after an empty vector search.
7. Composition errors inside the guarded path log `companion_memory_compose_window_failed` and return legacy profile memory. The typed entry prepares legacy memory/top-k before that guard; this is not a guarantee for arbitrary malformed caller arguments.

Empty memory produces no substantive memory text. With HCM retrieval disabled the early path uses legacy memory and optional story heading; it skips atoms, recent task retrieval and vectors. A remembered fact is asserted input, not an independently verified truth.

## Flags, budgets and telemetry

Source defaults and bounds:

- `EWA_COMPANION_HCM_EPISODIC_ENABLED=1`: writer and re-embedding switch. `EWA_COMPANION_HCM_RETRIEVAL_ENABLED=1`: composed retrieval switch.
- Profile memory stores up to 5000 entries of at most 4096 content characters. Display helpers cap visible memory lines at 32; this differs from prompt selection.
- `EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS` defaults to 8000 and clamps to 256–262144. The 262144 value is a character bound, not a guarantee of model token capacity. Merge of memory layers and later discuss text is capped before prompt insertion.
- Episode PG body cap is 8192 characters. Composer episodic top-k defaults to 8 and clamps to 1–12.
- `EWA_COMPANION_RETRIEVAL_BUDGET_MS` defaults to 4500, clamps to 50–30000, and bounds embed/client/vector work. Rerank gets remaining budget with a 50 ms floor and its own timeout cap (default 8 seconds). Atom/PG-task/recency work is outside the vector timer; this is not an end-to-end HTTP deadline.
- Retrieval router defaults on. `EWA_COMPANION_ANCHOR_SHORT_CIRCUIT_SCORE` defaults to 0.45: values above 1 are divided by 100, then clamped to 0–0.95 (`85` means 0.85). Sufficient keyword overlap with a stored anchor skips deep vector **and** recency retrieval, while atoms/recent tasks can still run.
- Intent/session prioritization and episodic rerank default on. Rerank limits default to eight documents and 512 characters per document; see the composer for bounds.

`layer_telemetry` includes anchor overlap, router/short-circuit decision, atom count, embed/Qdrant time and related-text estimate. Logs include `retrieval_latency_ms`, `retrieval_latency_budget_exceeded` and adapter failure markers. A nonzero hit count is not a quality evaluation or evidence that a live tenant was correctly configured.

[EWA Qdrant client selection](../../../shared/api/services/chat_memory_service.py) uses optional `EWA_QDRANT_URL` (alias `EWA_QDRANT_HTTP_URL`) and `EWA_QDRANT_API_KEY`; otherwise it uses unified internal configuration. Identical catalog URL without a separate key can reuse the generic client. These URL/key settings come from unified configuration; writer/retrieval flags read the EWA settings/environment interface. Changing a process environment externally does not prove a running process picked it up without reload.

## Context anchor, condensation and ground truth

Anchor prompt injection defaults off via `EWA_COMPANION_CONTEXT_ANCHOR_ENABLED=0`; controller pruning/refresh also defaults off via `EWA_COMPANION_CONTEXT_CONTROLLER_ENABLED=0`. Anchor sections hold core truths, decisions, active tasks, uncertainties, attached resources and constraints. Noise filters sanitize derived text; controller refresh/prune policy has its own character/history/latency thresholds. Prompt budgets are estimates rather than exact tokenizer counts.

[Chat condensation](../../../shared/api/ewa_platform/companion/memory/chat_condense.py) maintains `companion_chat_condensed_v1` before profile persistence when its flag is enabled or a positive `EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET` enables it. Source message threshold defaults to eight new rows outside the LLM tail; a token-budget trigger can also force compression. The current coverage offset is relative to a rolling transcript and stops advancing after pruning: [DOC-CODE-015](../../../docs/CODE_ISSUES.md#doc-code-015--condensed-chat-coverage-stops-advancing-after-history-pruning). It is not a complete archive of every dropped turn.

[Ground truth](../../../shared/api/ewa_platform/companion/memory/ground_truth.py) optionally loads `extracted_text` or description from the configured Unified Content id. It requires a nondeleted row whose `user_id` equals the current principal UUID; failed/missing/invalid inputs return empty text. The default text cap is 6000 (400–24000). [Wire slimming](../../../shared/api/ewa_platform/companion/sidecar/lp_llm_slim.py) bounds profile action-log/rollup fragments for model input and removes the separate condensed namespace from that JSON copy.

## Story and forget HTTP boundary

All paths below have prefix `/api/v1/ewa`, require `require_oauth2_user` and operate on the authenticated principal's profile through [the profile router](../../../shared/api/ewa_platform/gateways/routers/companion_profile.py). They are user-authenticated routes; their source does not add a special operator-role dependency.

- `GET /companion-profile/story`: array of story rows (`content`, importance, valence, since/last-used timestamp strings and `content_hash`).
- `POST /companion-profile/story`: body `content` 2–280 characters, optional importance 0–1/default 0.9 and valence 0–1/default 0.6. Returns the story array. Hash duplicate returns the current array without a patch. Example: `{"content":"We completed our first shared project","importance":0.9,"valence":0.6}`.
- `DELETE /companion-profile/story/{content_hash}`: removes only that story row, returns the remaining story array.
- `DELETE /companion-profile/memory/{content_hash}`: removes that profile memory row, returns the shaped `CompanionProfileOut`. It does **not** delete matching episodic rows, atom rows or Qdrant points. Do not describe this as erasure across every memory layer.

Pool absence yields structured 503; an uninitialized profile yields 404; missing story/memory hash yields the respective 404; a revision patch conflict yields 409; request-model validation yields 422. Mutations use audited optimistic profile patches. Authentication failures are governed by the shared auth dependency/middleware.

Context anchor routes are `GET`/`PATCH /companion-profile/context-anchor`, `POST .../refresh` and `POST .../diagnose`. Their input/output models are in [companion schemas](../../../shared/api/ewa_platform/schemas/pydantic/companion.py); anchor helpers have separate no-op/normalization behavior. The broader profile reference covers initialization, patch/delete and other namespaces.

## Re-index and operating checks

[Worker reference](../../../shared/api/ewa_platform/workers/README.md) defines actual task names and queue behavior. Source beat schedules pending re-embedding every **5 minutes** and UTC daily rollup at **04:20**. Batch size defaults to 128 (1–500), row pacing to 25 ms; on-demand drain defaults to 48 rounds (1–200). Settings are read after bootstrap; pending-only selection does not automatically retry rows already marked failed.

Backfill uses classified bounded Qdrant retries: exhausted transient failures stay pending; invalid/nontransient rows can become failed. Foreground user/task writers still use a boolean upsert and can mark a transient failure failed: [DOC-CODE-016](../../../docs/CODE_ISSUES.md#doc-code-016--foreground-episodic-writers-exclude-transient-upsert-failures-from-pending-recovery). Keep this distinction when assessing recovery; it is not safe to promise that every temporary outage recovers on the next beat.

In an authorized test environment, verify migrations/pool, configured dimension/collection and actual queue consumption before sending synthetic turns. Inspect principal-filtered PG rows and indexing state, then retrieve a known past topic and observe both vector and empty/unavailable fallback cases. `indexed` is an outcome to check, not a guaranteed result of sending a turn. Deployment names and host placement belong only to [the topology SoT](../../platform/PRODUCTION-TOPOLOGY-STATE.md).

Audit checks: 64 existing tests across retrieval/context filters/memory budgets/Qdrant compatibility/re-embed/task outcomes passed with mocks; rerank was disabled for that bounded run. Synthetic atom and condensation probes expose the documented open defects. No live PG, Qdrant, embeddings, inference, migration or production acceptance was performed. Current proactive, affective/persona and simulation implementations have their own references; the old PR-2–PR-6 delivery list is not a current implementation status report.
