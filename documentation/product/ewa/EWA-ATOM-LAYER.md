# EWA atom layer: contracts, storage and retrieval

Source review: 2026-10-11. This describes the checked-in implementation, not a deployment acceptance result. Atoms add typed nodes and derived edges to companion episodic memory. They do not replace the profile's `companion_memory_v1` facts or prove the truth of a user's statement.

## Sources and storage

- [Pydantic contracts](../../../shared/api/ewa_platform/contracts/atoms_v1.py): `StarAtomV1`, `CometAtomV1`, `NebulaAtomV1`, parsing and JSON dumps.
- [Classifier](../../../shared/api/ewa_platform/atoms/classifier.py), [ingestion](../../../shared/api/ewa_platform/atoms/ingest.py) and [graph builder](../../../shared/api/ewa_platform/atoms/graph.py).
- [PG adapter](../../../shared/api/ewa_platform/persistence_pg/atoms_asyncpg.py) and [migration 007](../../../shared/api/ewa_platform/migrations/applied/007_ewa_atoms.sql): `ewa_atom` and `ewa_atom_edge` in EWA Postgres. [Migration guidance](../../../shared/api/ewa_platform/migrations/README.md) distinguishes scripts, bootstrap DDL and deployment verification.
- [Episodic writer](../../../shared/api/ewa_platform/companion/episodic/writer.py) creates the episode; [retrieval](../../../shared/api/ewa_platform/companion/memory/retrieval.py) selects prompt snippets.

`ewa_companion_episodes` stores episode text and indexing state; Qdrant is the separate vector index. Atom rows store common columns plus JSONB `payload`, kind-specific `particle`, and `meta` (episode, expiry, TTL, priority, module/task). Edges are scoped by principal and have unique `(principal_id, from_atom_id, to_atom_id, link_kind)` with a database self-loop check. The ingestion graph reads only that principal's recent atoms.

## Model contract

All atom models forbid extra fields. Common fields are:

- `id` (UUID, generated), `timestamp` (current UTC by default), `importance` (0–1, default 0.5), `tags` (string list) and required `payload` (string or JSON object).
- Optional `affective_overlay`: Nebula UUID and `weight_delta` from -1 to 1. The field represents a hint; ingestion does not populate overlays merely by inserting affective edges.
- Optional `episode_id`, `ttl_seconds` (0–31,536,000), `expires_at`, `module_id`/`task_id` (up to 128 characters). `priority` is 0–100, default 50.

Kinds and additional fields:

- **Star** (`particle_kind: star`): asserted fact; `origin_source` defaults to `user` (1–120 characters), `stability_index` is fixed at 1, `veracity_score` is 0–1 (default 0.5).
- **Comet** (`comet`): event; `duration_iso` defaults to `PT60S` (2–32 characters); validation trims/uppercases and checks the `P` prefix, without a full ISO duration parser. `impact_magnitude` is 0–1 and `trajectory_vector` has three numbers.
- **Nebula** (`nebula`): affective signal; `valence` -1–1, `arousal` 0–1 and `color_hex` matching `#RRGGBB`; defaults are 0, 0.5 and `#808080`.

A minimal Pydantic Star input is `{"particle_kind":"star","payload":"User prefers concise replies"}`. Serialization adds generated/default fields; that example is not a public HTTP endpoint request. The [checked-in JSON Schema](../../../shared/api/ewa_platform/schemas/json/ewa_atom_v1.json) is currently incompatible with the model shape: see [DOC-CODE-013](../../../docs/CODE_ISSUES.md#doc-code-013--atom-json-schema-rejects-valid-models-and-accepts-invalid-flat-data). Use the actual model contract when assessing existing code; the schema mismatch is awaiting a separate fix.

## Ingestion and classification

`EWA_ATOM_LAYER_ENABLED` defaults to `0`; `1`, `true`, `yes`, `on` enable writes and retrieval. Episodic recording has its own `EWA_COMPANION_HCM_EPISODIC_ENABLED` switch (source default `1`). After a successful episode insert, the writer awaits best-effort atom ingestion before attempting vector indexing. This is sequential work inside the recording coroutine, even when its caller schedules that coroutine in the background.

One nonempty user line produces one atom in the current implementation. The LLM classifier v1 returns `None`; deterministic v0 handles the line:

1. Explicit remember/note-to-self phrases produce a Star, with an importance floor of 0.62 and veracity 0.78.
2. Emotion markers produce a Nebula (importance floor 0.48), converting episode valence 0–1 to the atom's signed range.
3. Event markers produce a Comet (floor 0.55, `PT120S`). Other text falls back to a Comet (`PT60S`, importance at least 0.35).

The text is bounded by the episode-body limit. Ingestion adds `episode_id`, module from context or `companion_chat`, and task from `task_id` or `intent_hint`. `EWA_ATOM_TTL_DEFAULT_SEC` defaults to 604800 seconds; parsing clamps it to 60–31,536,000, with invalid input falling back to the default. `expires_at` is computed from ingestion time. This does not install an automatic deletion job.

After inserting an atom, ingestion rebuilds candidate edges over the 48 most recent atoms: temporal links between adjacent Comets; semantic links between Stars with tag Jaccard similarity at least 0.25; affective links from Nebulas to nearby Stars/Comets within 900 seconds by default. These are deterministic tag/time rules, not embedding-based semantic inference. Edge UUIDs are regenerated; the database uniqueness key suppresses repeated structural links. Atom and edge work is not a single transaction guaranteeing a complete graph. Ingestion failures log `ewa_atom_ingest_failed` and are caught.

## Retrieval and current limitations

Recent fetches order by timestamp/id descending and clamp the query limit to 1–500. Invalid model rows are skipped with a warning. Expiry is not filtered in that SQL query.

Prompt retrieval requires the atom flag, an EWA pool and a principal. It fetches a bounded recent slice (8–96), sanitizes/deduplicates snippets, and applies these intended filters:

- `EWA_ATOM_RETRIEVAL_DROP_STALE` defaults to `1`: exclude decoded atoms whose `expires_at` has passed.
- `EWA_ATOM_IMPORTANCE_FLOOR` defaults to `0`, clamped to 0–1.
- With a task id, include matching-task atoms or atoms with priority at least 70. Snippets are capped at 520 characters before prompt assembly.

**Known decoding defect:** `particle`/`meta` strings from the configured default asyncpg codec are ignored by the row converter. Kind-specific values revert to defaults and expiry/task/priority metadata is lost. Consequently the expiry/task filters cannot be treated as effective retention guarantees for that path. See [DOC-CODE-011](../../../docs/CODE_ISSUES.md#doc-code-011--atom-row-decoding-drops-jsonb-particle-and-expiry-metadata) and the [official asyncpg type mapping](https://magicstack.github.io/asyncpg/current/usage.html#type-conversion). No live database round trip was performed in this audit.

## Verification and related guidance

Existing pure atom tests and synthetic row/schema probes were run during the documentation audit. They cover bounded helpers; they do not certify a deployed graph, Qdrant indexing, migration state or TTL deletion.

See [HCM memory](EWA-COMPANION-HCM-MEMORY.md), [profile ADR](EWA-COMPANION-PROFILE-ADR.md) and [evolution canon](EWA-COMPANION-EVOLUTION-CANON.md). Context-anchor rollout notes under `documentation/plans/product/ewa/` are operator-local process material, not the living contract.
