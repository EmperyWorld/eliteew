# ADR: per-principal EWA companion profile

Decision: keep the companion profile in EWA Postgres, keyed by authenticated principal. Source review: 2026-10-11. This describes storage and the current user HTTP boundary; it does not certify production data, all chat workflows or erasure across every storage system.

## Storage and update contract

[Migration 003](../../../shared/api/ewa_platform/migrations/applied/003_ewa_companion_profile.sql) and [PG facade](../../../shared/api/ewa_platform/persistence_pg/companion_asyncpg.py) define `ewa_companion_profile` / audit. `principal_id` is `str(auth_user.id)`. The pool is the EWA pool configured with `EWA_DATABASE_URL`, separate from marketing AMKA storage. Desktop orchestration has its own session stores and currently lacks equivalent session ownership: [DOC-CODE-009](../../../docs/CODE_ISSUES.md#doc-code-009--desktop-orchestration-session-readswrites-lack-principal-isolation).

The row contains schema version, seed, `baseline`, `learned_preferences`, `style_parameters`, revision and update timestamp. Initialize uses `ON CONFLICT (principal_id) DO NOTHING`; it does not replace an existing seed/baseline. Profile patch locks the row, optionally checks `expect_revision`, shallow-merges supplied JSON maps, bumps revision and audits. A nested namespace replaces that top-level value; it is not recursively merged. Even an empty patch follows the revision/audit path. Omitting `expect_revision` permits last-writer updates at the namespace level.

Window payload `ewaDesktopPersonaId` is a client UX/cache hint. Once a profile exists, the server row controls its seed. The user patch model has no seed field; internal transformation/admin helpers can change seed, so the entire profile is not immutable. The HTTP model validates JSON-compatible maps; it does not individually normalize or enforce every arbitrary nested namespace on write. Namespace consumers have their own bounded normalization.

## User HTTP API

[Router](../../../shared/api/ewa_platform/gateways/routers/companion_profile.py) mounts under `/api/v1/ewa`; every route requires `require_oauth2_user` and uses the authenticated principal. It does not add a special operator-role dependency to the context-anchor routes. [Pydantic models](../../../shared/api/ewa_platform/schemas/pydantic/companion.py) define field-level constraints. Missing pool returns structured 503; authentication is governed by shared auth. Valid successful operations below return 200.

`CompanionProfileOut` includes principal/schema/seed, the three JSON maps, revision >=1, nullable update timestamp, `memory_display` (up to 32 derived lines), typed `character_state` (mood/bond/interaction style), and current voice/reactive-chrome flags. Hostile `arlika` suppresses the memory-display strip; this shaping does not erase the returned learned-preference map.

### Get, initialize and patch

- `GET /companion-profile`: returns the shaped profile; uninitialized → 404 `companion_profile_not_initialized`. For allowlisted internal usernames, the handler can perform a best-effort audited trust promotion to 10; this read is not strictly side-effect-free.
- `POST /companion-profile/initialize`: required `seed_persona_id` (1–64 characters, normalized to one of `parent`, `mela`, `zera`, `kora`, `tala`, `feni`), optional JSON `baseline`. Example: `{"seed_persona_id":"mela"}`. Runtime-only Arlika seeds/unknown ids → request validation 422. Existing row is returned; missing character state can be seeded via a separate optimistic patch, and trust promotion can also update it. This is not an unconditional total no-op on repeated calls.
- `PATCH /companion-profile`: optional nullable `baseline`, `learned_preferences`, `style_parameters`, `expect_revision` (integer >=1). Example: `{"style_parameters":{"answer_length":"short"},"expect_revision":2}` illustrates a shallow JSON update, not a separately typed style enum. Returns profile; missing row without expected revision → 404; expected-revision mismatch or missing row → 409 `companion_revision_mismatch_or_missing_row`.

There is no ordinary `DELETE /companion-profile` in this router. Admin wipe and shell reset are separate privileged operations.

### Friendly Arlika mode

`POST /companion-profile/arlika-v2-mode-toggle` has no request body. It applies the same eligibility/soft switch as the chat phrase path and returns profile fields plus `switched` and nullable `transform_event_kind`. Missing profile → 404; hostile v1 → 409 `arlika_v1_active_calm_first`; unavailable eligibility/revision switch → 409 `arlika_v2_mode_not_available`. It does not initialize a new profile or bypass the eligibility state.

### Quick-action presets

- `GET /companion-profile/quick-actions`: preset array scoped by principal.
- `POST` at the same path: required `label` (1–80), `prompt_text` (1–4000), optional `sort_order` (0–10000, default 100). Example: `{"label":"Daily review","prompt_text":"Review my current priorities","sort_order":100}`. Returns a preset with id/principal/text/order and nullable created/updated timestamp strings.
- `PATCH /companion-profile/quick-actions/{preset_id}`: optional nullable label/prompt/order with the same non-null bounds; returns the updated preset, or 404 `quick_action_preset_not_found`.
- `DELETE` at that id path: returns `{"ok":true}` or the same 404. The PG id lookup includes principal; ids are string path parameters, not UUID-typed route validation.

Request-model violations yield 422. Creating a preset follows its PG foreign-key/storage requirements; an absent parent profile is not explicitly translated into a dedicated 404 by the create handler.

### Story and forget

`GET`/`POST /companion-profile/story` and `DELETE .../story/{content_hash}` manage profile story rows; `DELETE .../memory/{content_hash}` forgets one profile memory row. [HCM memory](EWA-COMPANION-HCM-MEMORY.md#story-and-forget-http-boundary) defines bodies, row response fields, duplicate behavior and 404/409/422 boundaries. Profile forget does not purge episodes, atoms or vector points.

### Context anchor

- `GET /companion-profile/context-anchor`: returns `anchor` (typed/nullable) and `companion_revision`; uninitialized profile → 404.
- `POST .../context-anchor/refresh`: body `user_line` optional, default empty, max 4096. The declared response contains `profile: CompanionProfileOut` and `telemetry` with `ok`, nullable `chars_before`, `chars_after`, `reason`, `normalized`. Missing profile/failed patch can produce 404; an existing profile with refresh disabled/no-op can return 200 with `telemetry.ok:false`. The current successful-refresh helper returns an object for `normalized`, while the response model expects a boolean; response construction then fails after persistence: [DOC-CODE-019](../../../docs/CODE_ISSUES.md#doc-code-019--successful-context-anchor-refresh-fails-response-validation).
- `PATCH .../context-anchor`: body `patch` object, default empty. Helpers normalize/merge it into the anchor namespace using the current revision; returns the profile. Missing → 404; failed optimistic patch → 409.
- `POST .../context-anchor/diagnose`: optional `system_prompt_sample`, default empty, max 120000. Returns `anchor_present`, `condensed_chars`, `memory_section_chars` and `flags` containing `noise_risk`, `drift_risk`, `prompt_bloat_risk`, `action_execution_risk`. There is no revision or notes field in this response. It diagnoses heuristically; it does not run actions or prove model correctness. Missing profile → 404.

See [anchor helpers](../../../shared/api/ewa_platform/companion/context/anchor_ops.py) and the exact models for telemetry/risk fields. Diagnose and refresh are distinct read/write boundaries.

## Character and learned namespaces

Initial character uses deterministic trait jitter from principal/seed (±0.10 around 0.5), then seed bootstrap. Existing character maps are retained on initialize. Main namespaces include character, durable facts/story, retained chat, actions log, continuity, condensed chat, context anchor, daily rollup, plan meta and evolution enqueue state. They are extensible values, not all mandatory fields of every stored row. [Evolution canon](EWA-COMPANION-EVOLUTION-CANON.md) and [HCM guide](EWA-COMPANION-HCM-MEMORY.md) define their writers/readers and current decoding/counter limitations.

Audit actions and details differ by operation. Audit storage can include user/prompt/namespace information from individual paths; this ADR does not promise that it contains no personal data. Retention/export policy requires a separate explicit product/operations decision.

## Trust, hostile Arlika and restoration

[Pre-turn trust](../../../shared/api/ewa_platform/companion/sidecar/trust_turn.py) and [state helpers](../../../shared/api/ewa_platform/companion/sidecar/trust_state.py) keep trust/wrath 0–10 in baseline. Friendly ordinary seeds use classifier signals and local rude-abuse heuristics. Confirmed abuse transforms to hostile v1 regardless of the current trust score; hostile transformation sets lock/origin/time/wrath and an audited revision. A stored next-v2 hint does **not** make a subsequent abusive turn auto-transform into v2.

Hostile v1 checks idle duration (one hour since last completed activity or transformation fallback) before wrath classification. Successful idle revert uses full-amnesia profile memory; a revision conflict falls through to wrath handling. Wrath <=0 also attempts healing/revert. Quarrel keeps wrath and records that it occurred; calm reduces it by one. Classifier failure acts as calm when `EWA_COMPANION_ARLIKA_WRATH_CLASSIFY_FAIL_OPEN` is enabled (source default true).

[Revert](../../../shared/api/ewa_platform/persistence_pg/companion_asyncpg.py) restores the origin seed (fallback parent), resets trust/wrath/lock state, replaces durable profile memory with a single idle-amnesia or mystic row and reseeds character. It does not erase all episodic/vector data or every learned namespace. Hostile v1 skips explicit remembered-fact insertion and displays no memory strip.

Friendly v2 skips the trust/wrath classifier/idle branches, but local abuse can demote it to hostile v1. [Explicit phrase/toggle switch](../../../shared/api/ewa_platform/companion/sidecar/arlika_v2_chat_switch.py) requires next-v2 eligibility or an unlocked flag to enter v2; it uses soft seed switching, preserves character and merges dual-mode memory rows. Return-to-EWA uses the stored origin. Both Arlika modes pass only user history rows to the main chat model while retaining the full UI transcript. Transform kinds are `arlika`, `ewa_restore`, `ewa_to_arly`, `arly_to_ewa`; actual UI/video behavior belongs to the chat/seed guides.

## Privileged clear/reset boundaries

[Admin users service](../../../shared/api/ewa_platform/companion/admin_users.py) and [admin router](../../../shared/api/ewa_platform/gateways/routers/companion_admin.py) expose write-gated namespace clear and per-principal wipe. They require admin roles and feature/write gates; confirmation fields must match the selected namespace/principal. Soft clear replaces only an allowlisted learned root and does not purge vectors.

Wipe probes a Qdrant client, audits, deletes user workflows/profile (FK cascades), then purges points in the **current dimension collection**. It is not a distributed transaction. The vector delete adapter currently swallows failures and returns zero, allowing an apparent successful wipe after PG deletion: [DOC-CODE-018](../../../docs/CODE_ISSUES.md#doc-code-018--admin-wipe-can-report-success-after-vector-purge-fails). It also bounds scrolling to 64 pages of 256 and does not enumerate old dimension collections. Complete erasure cannot be inferred from `wiped:true` alone.

[Operator helper](../../../docker/scripts/ewa-companion-user-admin.sh) has inventory, per-user reset/trust and reset-all modes. Per-user reset deletes PG first, then vector points; a purge failure is reported after PG deletion. Reset-all probes Qdrant first but its later PG/vector writes are still not atomic; it preserves platform settings/prompt/workflow catalogs by its selected table scope. `truncate-all-ewa` is explicitly deprecated/incomplete. None of these destructive paths was executed in the audit. Client localStorage/pins/onboarding are a separate scope. Topology belongs to [the topology SoT](../../platform/PRODUCTION-TOPOLOGY-STATE.md).

Verification: source/schema/SQL inspection and existing pure/mock-backed persona/trust/settings tests; no real user profile, database reset, migration, broker or model request was used. [Seed matrix](EWA-COMPANION-SEED-PERSONA-MATRIX.md), [operations](EWA-COMPANION-OPERATIONS-PANEL.md), [admin UI](EWA-COMPANION-ADMIN-UI.md) and chat contracts have separate review scopes.
