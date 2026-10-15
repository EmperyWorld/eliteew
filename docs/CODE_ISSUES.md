# Code issues found during the documentation audit

Append-only audit record requested by the operator on 2026-10-11. Each block records a source-backed defect, its trigger and the limits of verification. Application code/configuration is unchanged. Add new findings and later status corrections at the end; do not rewrite earlier blocks. These records are not a complete security or correctness audit.

## DOC-CODE-001 — frontend package-manager conflict in the primary PR gate

- Recorded: 2026-10-11. Status: open; static configuration mismatch confirmed.
- Evidence: [SPA manifest](../shared/web/frontend/package.json#L7) pins pnpm 12.4.1 and requires pnpm >=12. [PR gate](../.github/workflows/eliteew-pr-gate.yml#L55) explicitly provisions version 10 before installing the same package.
- Trigger: the primary frontend CI installation. The workflow's explicit tool version conflicts with the package's tool contract; action/package-manager enforcement can fail before regression tests.
- Verification: read both configuration files; CI and network installation were not run. The exact action failure mode is unverified.
- Separate fix: align the workflow and declared package manager, then run the install/regression gate. No dependency/configuration change was made here.

## DOC-CODE-002 — frontend validation script resolves to an absent path

- Recorded: 2026-10-11. Status: open; filesystem failure confirmed.
- Evidence: [package script](../shared/web/frontend/package.json#L36) is `bash ../../scripts/validate-local.sh`. From `shared/web/frontend`, this resolves to `shared/scripts/validate-local.sh`, which is absent. The actual helper is [scripts/eliteew/validate-local.sh](../scripts/eliteew/validate-local.sh).
- Trigger: `pnpm run validate:eliteew` from the SPA package. Bash cannot open the declared script.
- Verification: resolved the relative path and checked existence; did not run a broad validation gate.
- Separate fix: correct the relative path and verify the script from the package workdir.

## DOC-CODE-003 — Vite HTTPS switch has reversed boolean semantics

- Recorded: 2026-10-11. Status: open; expression/branch behavior confirmed.
- Evidence: [Vite config](../shared/web/frontend/vite.config.ts#L53) sets `useHttps` when `VITE_DEV_SERVER_HTTPS === 'false'`; [server configuration](../shared/web/frontend/vite.config.ts#L121) uses it to enable HTTPS and select WSS/443.
- Trigger: setting the environment value to `false` enables HTTPS; setting it to `true` selects HTTP. This contradicts the switch's name and conventional boolean configuration.
- Verification: read the expression and both consuming branches. A dev server/certificate handshake was not started.
- Separate fix: define consistent truthy parsing and cover both explicit boolean values.

## DOC-CODE-004 — Vite API proxy removes the prefix required by EWA routes

- Recorded: 2026-10-11. Status: open; source routing mismatch confirmed for this dev proxy.
- Evidence: [Vite proxy](../shared/web/frontend/vite.config.ts#L134) strips `/api` before forwarding to the backend container. [EWA router composition](../shared/api/ewa_platform/gateways/companion_http.py#L28) mounts `/api/v1/ewa`, including the [desktop turn route](../shared/api/ewa_platform/gateways/routers/desktop.py#L41).
- Trigger: forwarding `/api/v1/ewa/desktop-orchestration/turn` through Vite sends `/v1/ewa/desktop-orchestration/turn` to the configured direct API target. That path differs from the mounted route. The target hostname also requires the container network.
- Verification: compared string rewriting with static registrations; no live HTTP request or ingress configuration was exercised.
- Separate fix: reconcile proxy paths/target with the API mount and verify an authenticated local turn. Do not infer the same defect in production nginx routing.

## DOC-CODE-005 — Olenti development compose invokes an absent npm script

- Recorded: 2026-10-11. Status: open; missing script confirmed.
- Evidence: [development compose](../site-templates/olenti/docker-compose.yml#L10) invokes `npm run dev`; the [frontend manifest](../site-templates/olenti/package.json#L8) declares `vite:dev:admin` and has no `dev` script. The compose file contains frontend/database services and no API service.
- Trigger: starting the provided frontend dev service reaches a missing-script error after dependency installation. The file alone also does not provide a complete frontend/API/database development stack.
- Verification: read service command and script keys; no image pull, install or compose start was performed.
- Separate fix: correct the command and document/provide the intended API connection; verify the chosen dev composition.

## DOC-CODE-006 — Olenti API Dockerfile invokes an absent build script

- Recorded: 2026-10-11. Status: open; missing script confirmed.
- Evidence: [server Dockerfile](../site-templates/olenti/server/Dockerfile#L13) invokes `npm run build`; the [server manifest](../site-templates/olenti/server/package.json#L14) declares `tsc:build:api` and has no `build` script.
- Trigger: building the API from that Dockerfile stops at the missing build command; copying `dist` into the runner cannot follow successfully.
- Verification: compared the Dockerfile with the exact manifest in its build context; no container build or dependency install was performed.
- Separate fix: align the build command and verify the image from the intended context.

## DOC-CODE-007 — desktop config intent is absent from the dataclass serializer

- Recorded: 2026-10-11. Status: open; pure-function failure reproduced.
- Evidence: [contract](../shared/api/ewa_platform/contracts/desktop_intent.py) declares `PatchDesktopConfigIntent` and recognizes `patch_desktop_config`; [serializer](../shared/api/ewa_platform/io/desktop_payload.py) omits that dataclass from both its accepted union and dispatch branches. The policy and HTTP adapter support the corresponding mapping.
- Trigger: `desktop_intent_to_wire(PatchDesktopConfigIntent(patch={'theme': 'dark'}))` raises `TypeError` instead of producing the declared intent wire object.
- Impact: typed callers cannot serialize that supported intent through the common helper. Existing mapping-based orchestration can still use it; this is not proof that all desktop config changes fail.
- Verification: executed this pure-function call with the existing virtual environment and bytecode disabled; no service or storage connection.
- Separate fix: add serializer/type-union parity and a contract regression test.

## DOC-CODE-008 — published desktop JSON Schemas differ from runtime validators

- Recorded: 2026-10-11. Status: open; bounded schema/runtime mismatch reproduced.
- Evidence: [intent schema](../shared/api/ewa_platform/schemas/json/desktop_intent_v1.json) and [observation schema](../shared/api/ewa_platform/schemas/json/desktop_observation_v1.json) require only their discriminators, without per-kind conditional requirements. [Intent predicate](../shared/api/ewa_platform/contracts/desktop_intent.py) and [observation predicate](../shared/api/ewa_platform/contracts/desktop_observation.py) require additional fields for each kind.
- Trigger: `{'intent_kind': 'open_app'}` and `{'observation_kind': 'active_app_changed'}` pass Draft 2020-12 JSON Schema validation but fail the corresponding runtime `*_wire_wellformed` predicate.
- Impact: a consumer validating only the checked-in schema can send an observation that the HTTP entry rejects with 400. Runtime predicates also permit unknown properties that `additionalProperties: false` rejects; the two validators do not define identical acceptance sets.
- Verification: compared both samples with the installed `jsonschema.Draft202012Validator` and the pure runtime predicates. No remote schema retrieval or HTTP service was used.
- Separate fix: reconcile conditional fields/additional-properties policy and cover both validators with shared examples. Historical AMKA schema ids are retained by source and are a naming caveat rather than evidence of marketing routing.

## DOC-CODE-009 — desktop orchestration session reads/writes lack principal isolation

- Recorded: 2026-10-11. Status: open; cross-principal access reproduced in an isolated in-memory ASGI app. Production exploitation was not tested.
- Evidence: [desktop routes](../shared/api/ewa_platform/gateways/routers/desktop.py) require authentication, but the SSE handler discards `auth_user`. [Runtime](../shared/api/ewa_platform/desktop/runtime.py) uses caller-supplied `session_id` for turn/event lookup without binding it to the principal. [PG stores](../shared/api/ewa_platform/persistence_pg/orchestration_asyncpg.py) and [memory stores](../shared/api/ewa_platform/persistence/in_memory_orchestration.py) key sessions/events only by `session_id`; PG schema has no principal column or per-principal predicate.
- Trigger: user A creates a session; authenticated user B supplies the same session id. B can read A's event journal and append a second turn to that session.
- Impact: journal disclosure and cross-user state contamination when a shared store is used and another session id is known. Client-side random ids do not establish server-side ownership.
- Verification: mounted only the desktop router in an in-memory FastAPI app, overrode authentication with two synthetic principals, disabled every outbound orchestration HTTP/LLM/hint flag and used `httpx.ASGITransport`. B received A's synthetic marker with HTTP 200 and appended a turn increasing the shared count to 2. No network, PG, production credentials or real user data was used. PG behavior is supported by static SQL inspection, not a database test.
- Separate fix: persist/verify session ownership consistently for turn and SSE, then add two-principal regressions for memory/PG implementations. No security or application code was changed in this docs-only audit.

## DOC-CODE-010 — desktop HTTP entry accepts unsupported envelope versions

- Recorded: 2026-10-11. Status: open; acceptance of an unsupported version reproduced in isolated ASGI.
- Evidence: [envelope mapper](../shared/api/ewa_platform/io/envelope.py) defines version `1`, but `_ensure_api_version` checks only a nonempty string. [Desktop runtime](../shared/api/ewa_platform/desktop/runtime.py) validates payload kind/session/observation without comparing the envelope version to the supported constant. Responses always label themselves version `1`.
- Trigger: an otherwise valid turn with `api_version: '999'` is processed and returns HTTP 200/version `1`.
- Impact: the HTTP boundary cannot reject incompatible major envelope versions even though the module's documented supported version is 1. Extensible `message_type` strings are explicitly allowed by the mapper and are not separately classified as a defect here.
- Verification: repeated the isolated ASGI request from DOC-CODE-009 with the version changed to `999`; no external services were used.
- Separate fix: establish and enforce version compatibility at the HTTP boundary and test supported/unsupported versions.

## DOC-CODE-011 — atom row decoding drops JSONB particle and expiry metadata

- Recorded: 2026-10-11. Status: open; row-conversion loss reproduced with synthetic default-codec data. No database was connected.
- Evidence: [atoms_asyncpg._row_to_atom_dict](../shared/api/ewa_platform/persistence_pg/atoms_asyncpg.py) accepts `particle`/`meta` only when already mappings, otherwise replacing them with empty objects. It does decode string `payload`. [The EWA pool constructor](../shared/api/ewa_platform/persistence_pg/orchestration_asyncpg.py) calls `asyncpg.create_pool` without a custom JSONB codec. The [official asyncpg type mapping](https://magicstack.github.io/asyncpg/current/usage.html#type-conversion) returns JSON/JSONB as strings by default.
- Trigger: fetching a stored atom using the configured default pool. Its string-valued JSONB particle/meta are ignored before model parsing.
- Impact: kind-specific values revert to model defaults; `episode_id`, `expires_at`, TTL, task/module and priority metadata disappear. [Retrieval](../shared/api/ewa_platform/companion/memory/retrieval.py) then cannot drop expired atoms or apply task metadata from those rows. Persisting the metadata is not proof that retrieval preserves it.
- Verification: passed a synthetic Nebula row with JSON strings to the actual converter/parser: valence/arousal/color became defaults, priority became 50, expiry/episode/task became None. The same data with decoded mappings retained the values. Pool setup and the absence of a codec were inspected statically; live PG behavior is inferred from that setup and the documented codec, not claimed as executed.
- Separate fix: decode both JSONB objects consistently or configure a compatible codec without breaking existing JSON binds; add a string-JSONB round-trip regression and verify expiry retrieval against a test DB.

## DOC-CODE-012 — chat-triggered evolution stops advancing at the transcript cap

- Recorded: 2026-10-11. Status: open; deterministic scheduling failure reproduced.
- Evidence: [evolution_chat_trigger.py](../shared/api/ewa_platform/companion/persona/evolution_chat_trigger.py) computes progress from the count of user rows currently in `desktop_friend_chat_v1.messages` and stores that count at enqueue. [Main persist](../shared/api/ewa_platform/companion/turn/phases/main_llm_persist.py) and [orchestrated persist](../shared/api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py) trim the transcript to 240 messages before evaluating the trigger.
- Trigger: sustained alternating user/assistant chat with auto evolution enabled. The retained user count saturates at 120; after storing 120 as the last enqueue count, later new turns produce delta 0. Transcript pruning/reset can also make the delta negative.
- Impact: periodic chat-triggered evolution no longer follows new user turns once the rolling transcript fills; a cumulative progress counter cannot be derived from retained-window length.
- Verification: called the actual pure trigger for 150 synthetic turns, applying the same 240-message trim, with every-N=10, cooldown=0 and minimum=6. It scheduled at turns 10 through 120, then returned `turn_threshold` through turn 150. No Celery enqueue, LLM, database or network operation occurred.
- Separate fix: persist a monotonic turn/sequence counter separate from the rolling transcript and define reset/prune behavior; cover a transcript exceeding the cap.

## DOC-CODE-013 — atom JSON Schema rejects valid models and accepts invalid flat data

- Recorded: 2026-10-11. Status: open; schema/model acceptance mismatch reproduced.
- Evidence: [ewa_atom_v1.json](../shared/api/ewa_platform/schemas/json/ewa_atom_v1.json) requires `particle_kind`/`payload` at the root but declares only `api_version` and an optional nested `atom`. Its `AtomBaseV1` sets `additionalProperties: false` without declaring `particle_kind` or the kind-specific properties added by `allOf`. [Pydantic atom contracts](../shared/api/ewa_platform/contracts/atoms_v1.py) define the actual discriminated flat models and additional metadata fields.
- Trigger: validating an atom model dump against the published schema. A flat object with an invalid kind and numeric payload passes root validation; a valid nested envelope fails the root requirements; a valid Nebula model also fails validation against `AnyAtomV1` because the base forbids its discriminator and kind-specific fields.
- Impact: this checked-in schema cannot provide compatible validation for the implemented atom contract. The persistence/retrieval path uses Pydantic parsing, so this is not evidence that all atom ingestion fails.
- Verification: ran the installed Draft 2020-12 validator with synthetic invalid flat data and an actual `NebulaAtomV1.model_dump(mode='json')`, testing both the root and `AnyAtomV1` reference. No schema/source file, service or database was changed.
- Separate fix: decide the intended flat/envelope wire shape, derive or reconcile the schema with the model union, and cover accepted/rejected examples for every particle kind and metadata field.

## DOC-CODE-014 — Celery routes use module names instead of registered EWA task names

- Recorded: 2026-10-11. Status: open; configured router fallback reproduced without a broker.
- Evidence: [task_routes](../shared/api/tasks/celery_app.py) routes companion/agentic runners by Python module/function paths and evolution by `api.ewa_platform.workers.evolution_tick_task.*`. Their decorators register [enum names](../shared/api/ewa_platform/workers/orchestration_tasks.py) under `ewa.platform.*`. [Evolution scheduling](../shared/api/ewa_platform/companion/persona/evolution_schedule.py) calls `.delay(payload)` without an explicit queue.
- Trigger: routing any of these four registered names without a queue override. None matches its configured route; Celery selects the default `short` queue. This affects the normal evolution enqueue path's intended companion-queue isolation.
- Impact limits: [companion enqueue](../shared/api/ewa_platform/companion/jobs/enqueue.py) and [agentic enqueue](../shared/api/ewa_platform/agentic/jobs/enqueue.py) explicitly pass their dedicated queues and therefore bypass the route mismatch in those paths. This finding does not establish that their normal jobs are misqueued or that a live worker failed to consume evolution.
- Verification: imported the existing configured Celery app using test environment setup and called its actual `amqp.router.route` locally for all four enum values. Each returned `short`; the companion explicit-queue control returned `ewa_companion`. No publish, Redis connection or worker process was started.
- Separate fix: align routing keys with registered task names and verify direct/beat/signature enqueue behavior; review adjacent task annotations for the same naming convention. No queue/configuration change was made here.

## DOC-CODE-015 — condensed-chat coverage stops advancing after history pruning

- Recorded: 2026-10-11. Status: open; deterministic loss of later summaries reproduced with mocked model output.
- Evidence: [chat_condense.py](../shared/api/ewa_platform/companion/memory/chat_condense.py) stores `covered_up_to_index` as an offset into the current history. [Main persistence](../shared/api/ewa_platform/companion/turn/phases/main_llm_persist.py) and [orchestrated persistence](../shared/api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py) retain only 240 messages, then reconstruct later history from that rolling window. The stored offset is not adjusted when old messages disappear.
- Trigger: chat condensation enabled, 48-message LLM tail, eight-new-message threshold, token-budget override disabled. Once the retained history fills, `tail_start` stops growing while the saved coverage offset still refers to an older window; new dropped-message slices no longer reach the threshold.
- Impact: `companion_chat_condensed_v1` can stop incorporating subsequent conversation despite continued new turns. This is separate from the evolution enqueue counter in DOC-CODE-012.
- Verification: simulated 160 alternating synthetic turns using the actual async condensation function, mocked completion output/prompt/runtime config and the same rolling 240-message persistence. It summarized 24 times, last at turn 120, and retained coverage offset 192 through turn 160. No network/model/database call occurred. Token-budget-triggered behavior was not separately accepted.
- Separate fix: track stable message sequence coverage or explicitly rebase coverage on pruning; verify repeated condensation beyond the rolling-window cap and both threshold modes.

## DOC-CODE-016 — foreground episodic writers exclude transient upsert failures from pending recovery

- Recorded: 2026-10-11. Status: open; failed-status transition reproduced with a synthetic Qdrant client.
- Evidence: [user/task writers](../shared/api/ewa_platform/companion/episodic/writer.py) call the boolean [Qdrant upsert](../shared/api/ewa_platform/persistence_vector/companion_qdrant.py), which returns false for any caught client error, then mark the PG episode `failed`. [Automatic re-embedding](../shared/api/ewa_platform/persistence_pg/episodes_asyncpg.py) selects only `pending` rows; its [backoff path](../shared/api/ewa_platform/companion/episodic/reembed.py) preserves pending status for classified transient errors, but foreground writes bypass it.
- Trigger: a temporary 503/rate-limit/timeout at the initial upsert after episode insertion. That row can be marked failed and disappear from the periodic pending-only recovery queue.
- Impact: PG text remains available for recency recall, but automatic vector recovery does not include the failed row after the service recovers. This does not apply to an earlier missing embedding/client/collection branch that leaves the row pending, or to transient errors encountered by the backfill path.
- Verification: executed actual `record_user_turn`/Qdrant adapter with mocked PG/embed/collection helpers and a fake client raising a synthetic 503. It made one upsert attempt and called the failed marker with `qdrant_upsert_failed`. Pending-only selection was inspected statically; no real database/vector service was connected.
- Separate fix: preserve error classification and pending status on transient initial indexing failures, or define a safe failed-row recovery policy; test initial writer and periodic recovery together. No code or status data was changed here.

## DOC-CODE-017 — admin validation rejects the persona numeric inheritance value

- Recorded: 2026-10-11. Status: open; pure validation mismatch reproduced.
- Evidence: [persona numeric catalog entries](../shared/api/ewa_platform/settings/catalog_entries.py) use empty defaults to mean no override. [Persona resolver](../shared/api/ewa_platform/companion/config.py) skips empty values and falls back through parent/canonical settings. [validate_setting_value](../shared/api/ewa_platform/settings/service.py) requires `float(value_text)` for every float key, so an empty string is rejected. [Admin PUT](../shared/api/ewa_platform/gateways/routers/companion_admin.py) returns that error as 422 before updating the row.
- Trigger: clearing an existing persona numeric override back to its catalog default/inheritance state via Settings PUT, for example `EWA_PERSONA_MELA_DIRECTNESS` with `value_text: ''`.
- Impact: bootstrap can create the empty inherited value, and runtime can read it, but the admin mutation boundary cannot restore that same supported state after an explicit override.
- Verification: imported the actual catalog and validator; the key is type float with an empty default, while validating empty text returns `invalid_float`. No setting/database row was changed.
- Separate fix: recognize the declared optional override state for the relevant persona keys, preserve strict validation elsewhere and test clear-to-inherit through the HTTP contract.

## DOC-CODE-018 — admin wipe can report success after vector purge fails

- Recorded: 2026-10-11. Status: open; false-success result reproduced entirely with synthetic adapters.
- Evidence: [wipe_companion_principal](../shared/api/ewa_platform/companion/admin_users.py) probes a client, deletes workflows/profile in PG, then calls [delete_companion_episodic_for_principal](../shared/api/ewa_platform/persistence_vector/companion_qdrant.py). That adapter catches scroll/delete exceptions and returns 0, so the caller's exception-to-failure path cannot see the error and returns `wiped: true`. It targets only the current dimension collection and caps scrolling at 64 pages of 256, without proving exhaustion when that cap is reached.
- Trigger: Qdrant becomes unavailable/fails after a client was obtained and PG deletion completed. Returning zero is indistinguishable from a legitimately empty collection to the wipe caller.
- Impact: admin HTTP can report successful wipe even though vector memory remains; PG deletion and vector deletion are not atomic. An already unavailable client is rejected before PG deletion, but that preflight does not cover later purge failure. Large or older-dimension collections also fall outside the adapter's complete-erasure guarantee.
- Verification: called the actual wipe service with mocked PG fetch/audit/transaction/execute, a mocked client factory and the actual vector-delete adapter whose fake scroll raised a synthetic 503. Two mock PG delete calls occurred and the service returned `wiped: true, qdrant_points_deleted: 0`. No user data, real wipe, network or database operation occurred. Scroll-cap/collection scope are static findings, not live volume tests.
- Separate fix: propagate typed purge failure/partial completion, define recoverable ordering/state and complete collection/page scope, then verify error/empty/success responses and retries without false success.

## DOC-CODE-019 — successful context-anchor refresh fails response validation

- Recorded: 2026-10-11. Status: open; helper/response-model incompatibility reproduced with mocked persistence.
- Evidence: [anchor refresh helper](../shared/api/ewa_platform/companion/context/anchor_ops.py) returns `model.to_lp_dict()` in telemetry `normalized` after `companion_profile_patch`. [Telemetry schema](../shared/api/ewa_platform/schemas/pydantic/companion.py) declares `normalized: bool | None`; the [HTTP handler](../shared/api/ewa_platform/gateways/routers/companion_profile.py) constructs its response with `CompanionContextAnchorRefreshOut.model_validate` after that helper returns.
- Trigger: refresh produces an anchor model and the optimistic profile patch succeeds. Response construction rejects the mapping in `normalized` with `bool_type`; it does not return the declared successful response. Disabled/no-op refresh omits this field and is not affected by this mismatch.
- Impact: a user can receive a server error after the profile was already persisted. Retrying the HTTP request cannot be assumed to be a read-only recovery operation.
- Verification: called the actual async refresh helper with mocked profile fetch/patch and anchor composition returning a real `ContextAnchorV1`; one mock patch occurred and revision 2 was returned. Validating its actual telemetry with the actual response telemetry model raised `bool_type` at `normalized`. A no-op telemetry control validated successfully. No real model, database or HTTP service was contacted; post-write HTTP failure is inferred from the handler's explicit validation, not a production request.
- Separate fix: agree whether normalized data or a boolean is intended, reconcile helper and response schema, and cover successful/no-op/conflict HTTP outcomes including persisted state on errors. No application/schema change was made here.

## DOC-CODE-020 — prompt-block audit cannot decode default-codec JSONB detail

- Recorded: 2026-10-11. Status: open; audit row conversion failure reproduced with synthetic default-codec data.
- Evidence: [list_prompt_block_audit](../shared/api/ewa_platform/persistence_pg/prompt_blocks_asyncpg.py) converts `detail` using `dict(r['detail'] or {})`. Updates bind a JSON string to the audit JSONB column. [EWA pool setup](../shared/api/ewa_platform/persistence_pg/orchestration_asyncpg.py) installs no JSONB codec; [official asyncpg type mapping](https://magicstack.github.io/asyncpg/current/usage.html#type-conversion) returns JSONB as a string. The [admin audit handler](../shared/api/ewa_platform/gateways/routers/companion_admin.py) does not translate that conversion error.
- Trigger: an audit query returns an update row with the pool's default JSONB representation. `dict` on the JSON object string raises ValueError rather than decoding it.
- Impact: prompt-block audit reads can fail once audit entries exist, even though the body update itself succeeded. An empty audit list is not affected.
- Verification: called the actual async audit helper with a fake pool/connection returning a JSON-string detail and a synthetic timestamp; it raised ValueError. No database or live admin API was contacted. Live default-codec behavior is inferred from the inspected pool and primary type documentation.
- Separate fix: decode the JSONB detail or introduce a compatible pool codec, retaining mapping compatibility and verifying empty/string/mapping audit rows. No implementation change was made.

## DOC-CODE-021 — proactive-review counter and suggestion deduplication are not persisted

- Recorded: 2026-10-11. Status: open; repeated-helper behavior reproduced; missing writer wiring traced statically.
- Evidence: [protocol enrichment](../shared/api/ewa_platform/companion/turn/protocol_enrichment.py) bumps a counter into a new temporary profile only. It neither updates the supplied learned-preference map nor returns/persists the state. [Main](../shared/api/ewa_platform/companion/turn/phases/main_llm_persist.py) and [terminal](../shared/api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py) construct the enriched payload after persistence. [Review engine](../shared/api/ewa_platform/companion/proactive/review_engine.py) exports `record_suggestion_shown` and `dismiss_suggestion`, but current non-test callers do not invoke them. Observation review also does not record shown/dismissed state or load completed/active task runs into the engine.
- Trigger: repeated chat turns start from a profile without proactive state. Each enrichment sees temporary turn 1, so the default every-third-turn fallback never becomes eligible. A queued-plan suggestion can repeat because the emitted id/time are not stored.
- Impact: the claimed periodic counter and 15-minute suggestion deduplication do not operate automatically on these integration paths. Pre-existing manually patched state can influence the engine; local UI dismiss/snooze remains separate and does not repair the counter. Run-based engine capabilities do not prove run-event integration.
- Verification: six actual enrichment calls with flags enabled and the same empty synthetic LP produced no fallback suggestion and left LP empty; three calls with a queued plan returned the same suggestion id with no state added. Source search traced both real final-payload callers and the absence of shown/dismissed writers; no model, PG or browser session was used.
- Separate fix: persist bounded counter/shown/dismissal state at the intended transactional boundary, wire run events explicitly if required, and test repeated turns/ticks and dismissal across requests without lost updates.

## DOC-CODE-022 — proactive-review timestamp parsing permits naive comparison errors

- Recorded: 2026-10-11. Status: open; pure TypeError reproduced with a schema-accepted stored timestamp.
- Evidence: [review engine](../shared/api/ewa_platform/companion/proactive/review_engine.py) uses `datetime.fromisoformat` for dismissed/shown/run timestamps and then compares/subtracts them with aware `datetime.now(UTC)` without normalizing timezone-naive results. [Profile PATCH](../shared/api/ewa_platform/schemas/pydantic/companion.py) permits arbitrary JSON maps in learned preferences; these namespaces have no timestamp validator at that boundary. Protocol enrichment does not catch this error.
- Trigger: a profile's matching `last_suggestion_at` is `2026-10-10T00:00:00` without an offset, and review generates that suggestion. Matching naive dismissal and supplied run timestamps have the same comparison problem.
- Impact: enabled proactive review can raise TypeError instead of safely ignoring/normalizing malformed stored state; final-payload construction may fail after the turn's persistence. This does not require a real task run, and missing/invalid ISO text follows other paths.
- Verification: called the actual engine with a synthetic queued plan and matching suggestion id/naive timestamp; it raised TypeError. No network/storage operation occurred. The post-persistence integration consequence is static call-order evidence, not a live HTTP reproduction.
- Separate fix: normalize or reject naive timestamps consistently and contain malformed state; cover aware/naive/invalid/future values in helpers and final-payload integration.

## DOC-CODE-023 — soft-initiative day calculation ignores the injected clock

- Recorded: 2026-10-11. Status: open; three existing regression tests fail at the current date.
- Evidence: [soft initiative](../shared/api/ewa_platform/companion/proactive/soft_initiative.py) accepts `now` for cap/gap/snooze evaluation and output timestamps, but `get_soft_initiative_state` and the next state's `day` call `_today_utc`, implemented with system-local `date.today()`. A supplied instant does not control the day/reset decision, and the helper name does not establish a UTC day.
- Trigger: an injected 2026-07-22 instant with a profile cap/gap state for that date, evaluated when the system day is 2026-10-11. The profile is reset as belonging to an older day before cap/gap evaluation; an emitted state uses October's day with July's timestamp.
- Impact: deterministic clock-based evaluation is inconsistent and the existing tests depend on the wall date. Deployments whose local day differs from UTC also do not follow a guaranteed UTC-day reset; live deployment timezone was not checked.
- Verification: the existing six-test soft-initiative file produced three failures (budget exhaustion, min gap, emitted day) in the 45-test bounded suite; 42 total tests passed. Failure inputs/actual results match this call path. No runtime state or test/source code was changed to force a pass.
- Separate fix: derive one agreed day from the same instant throughout state normalization/evaluation/emission, define its timezone and make the existing injected-clock tests independent of today's date.

## DOC-CODE-024 — synchronous chat response drops produced web and tool-trace fields

- Recorded: 2026-10-11. Status: open; response-model field loss reproduced.
- Evidence: [main final builder](../shared/api/ewa_platform/companion/turn/phases/main_llm_persist.py) attaches `web_search_result`; [protocol ledger](../shared/api/ewa_platform/companion/orchestration/execution_ledger.py) attaches `tool_trace`. [Sync HTTP handler](../shared/api/ewa_platform/gateways/routers/companion_chat.py) validates its raw result with [CompanionChatMessageOut](../shared/api/ewa_platform/schemas/pydantic/companion_chat.py), which declares neither field and uses Pydantic's default extra-ignore behavior. The chat entry source promises a web-search status when enabled.
- Trigger: a synchronous result contains search status or successful tool trace. Validation drops those fields before serialization, unlike raw SSE final emission.
- Impact: JSON callers cannot observe this produced search/trace metadata through the declared response; sync/SSE contracts diverge. This is not proof that web retrieval or the server tool itself failed.
- Verification: passed a synthetic valid reply/revision plus both fields through the actual response model and compared input/model-dump keys; both disappeared. Handler/builder call order was traced statically; no HTTP/model request was made.
- Separate fix: reconcile intended public metadata across schema/builders/clients and test actual synchronous serialization alongside SSE. No contract/source changes were made.

## DOC-CODE-025 — SSE replay loses original final-response metadata

- Recorded: 2026-10-11. Status: open; deterministic replay field loss reproduced.
- Evidence: [SSE replay helper](../shared/api/ewa_platform/companion/turn/turn_dedup.py) reconstructs only reply/revision/actions/task-run/transformation/config-apply fields instead of retaining the stored final response. [Fresh stream final](../shared/api/ewa_platform/companion/turn/phases/stream_main_llm_turn.py) stores the enriched payload including surfaces, turn-plan and protocol metadata.
- Trigger: a reconnect/retry uses an existing `client_turn_id` whose snapshot has enriched final fields.
- Impact: replay omits execution reports, orchestration outcome, proactive suggestion, turn-plan hints, output surface/blocks, web-search result and tool trace. The text can replay correctly while structured result/review UI disappears. Original token timing is intentionally not replayed; this finding concerns final metadata.
- Verification: collected/parsing the actual replay iterator for a synthetic enriched snapshot showed these eight supplied keys absent from `final`. No PG, browser or network was involved. The fresh snapshot store path was traced statically.
- Separate fix: preserve the agreed final-response contract on replay, retain explicit replay metadata and test nonempty surface/protocol/search fields rather than text-only samples.

## DOC-CODE-026 — chat grounding runs before a replay-cache hit is checked

- Recorded: 2026-10-11. Status: open; entry ordering reproduced with synthetic spies.
- Evidence: both [chat entrypoints](../shared/api/ewa_platform/companion/turn/chat_turn.py) resolve image context and await grounding before [early entry](../shared/api/ewa_platform/companion/turn/phases/turn_entry.py) checks dedup. [Grounding](../shared/api/ewa_platform/companion/turn/web_search_prefetch.py) can perform web/KBSEW requests and enrichment; image resolution can perform OCR. Replay-cache source comments claim no side effects on replay.
- Trigger: resend an already-completed turn id with grounding/image inputs enabled. The server repeats preparation before discovering the saved reply.
- Impact: unnecessary provider/OCR work, latency and possible search quota use on an otherwise cached retry; cache replay does not skip every preparatory side effect. No duplicate tool dispatch or actual quota debit was established by this probe.
- Verification: called actual sync entry with mocked profile, grounding spy and early-cache result; call order was `grounding`, then `cache_hit`. Stream order is static equivalent source evidence. No external request or real quota operation occurred.
- Separate fix: check the principal-scoped replay snapshot before costly/side-effectful preparation, retaining required request/auth checks; verify sync/SSE retries with provider spies and image inputs.

## DOC-CODE-027 — ordinary SSE chat buffers upstream token deltas until completion

- Recorded: 2026-10-11. Status: open; ordinary upstream streaming is accumulated before client delta emission.
- Evidence: [consume_main_llm_stream_tokens](../shared/api/ewa_platform/companion/turn/phases/main_llm_stream_llm.py) consumes the entire upstream async iterator into a tuple. [Stream caller](../shared/api/ewa_platform/companion/turn/phases/stream_main_llm_turn.py) awaits that function before yielding any returned token chunks. This buffering applies to ordinary text, not only the deliberately buffered JSON/document-replacement cases.
- Trigger: an ordinary text model response whose tokens arrive over time.
- Impact: typing deltas reach the client in a burst after upstream completion instead of progressively during generation; keep-alives/stage events can still arrive meanwhile. This does not establish loss of final text or a total request failure.
- Verification: actual accumulator with a fake two-chunk iterator paused after its first chunk had no returned result until release/upstream completion, then returned both chunks. Caller await-before-yield was inspected statically. No real model or production latency was measured.
- Separate fix: retain incremental safe emission for ordinary text while explicitly buffering JSON/document-replacement forms; test first-delta availability before the fake upstream completes, including split markup.

## DOC-CODE-028 — SSE merge regression patches a module instead of its bound consumer

- Recorded: 2026-10-11. Status: open; ineffective mock target confirmed.
- Evidence: [test_merge_layer_failure_surfaces_terminal_error](../shared/api/tests/test_companion_chat_sse_termination.py) replaces `task_events.iter_task_events_sse`. [Chat router](../shared/api/ewa_platform/gateways/routers/companion_chat.py) already imported that function directly and invokes its own bound name; changing the source-module attribute does not replace the router binding.
- Trigger: run this intended isolated merge test. The Redis pump can invoke the original transport instead of `empty_redis`.
- Impact: the test is not reliably isolated from Redis/configuration; it can attempt transport work or hang in cleanup. The 50-test bounded attempt was interrupted around the SSE merge tests and is not accepted as passing. Causation of every observed wait is not claimed from the binding probe alone.
- Verification: with the exact source-module monkeypatch, the router binding remained the original function and was not the fake. The remaining 49 tests passed with this test deselected. No Redis connection success was established or transport executed in the identity probe.
- Separate fix: mock the name consumed by the router and verify the Redis pump/cleanup under an explicit fake, with bounded waits. No test/source change was made in the repository.

## DOC-CODE-029 — synchronous terminal conflict fallback can lose the chat turn

- Recorded: 2026-10-11. Status: open; success outcome without transcript persistence reproduced with mocked PG.
- Evidence: [terminal persistence](../shared/api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py) on failed optimistic patch in `fetch_fallback` mode only fetches the newer profile and returns outcome OK with `patch_succeeded:false`. [Sync entry](../shared/api/ewa_platform/companion/turn/chat_turn.py) selects that mode and finalizes/caches the reply without retrying the transcript merge or exposing this flag in [chat output](../shared/api/ewa_platform/schemas/pydantic/companion_chat.py). SSE chooses fail instead.
- Trigger: another update changes the profile revision between bootstrap and a terminal orchestration patch.
- Impact: sync can return a successful reply/newer revision while its user/assistant transcript and LP mutations were not stored. A tool may already have executed, so blindly redispatching the turn is not safe. The explicit fallback is an implementation choice; its unreported persistence loss conflicts with the endpoint's persistence contract.
- Verification: actual terminal persistence with mocked helpers/PG patch returning None and fetch returning an empty newer transcript made one patch call, returned outcome ok / patch_succeeded false and still-empty stored history. No database/tool operation occurred; final caching follows static source call order.
- Separate fix: safely retry/merge persistence without rerunning tools or expose conflict/partial persistence to callers; test concurrent updates for both channels and recovery/replay semantics.

## DOC-CODE-030 — final companion system prompt exceeds its declared character cap

- Recorded: 2026-10-11. Status: open; final-size overflow and tail eviction reproduced with synthetic context.
- Evidence: [main system builder](../shared/api/ewa_platform/companion/turn/phases/main_llm_prepare.py) concatenates raw blocks, truncates to `get_system_max_chars`, then calls [wall-clock append](../shared/api/utils/llm_wall_clock_context.py). It does not use [assemble_system_prompt](../shared/api/ewa_platform/companion/turn/system_budget.py)'s prioritized block algorithm tested by the budget suite. Tool/action/output instructions appear after potentially large early ground-truth/memory blocks.
- Trigger: system cap 2,000 characters and a large synthetic ground-truth block. The added clock context comes after cap enforcement.
- Impact: the final model-bound system text exceeds the declared cap; late tool/action/guard sections can be clipped wholesale rather than kept through an explicit priority policy. This is not proof of a particular harmful model response, token-window exhaustion or production setting.
- Verification: actual builder with the minimum configured cap and synthetic repeated context returned 2,780 characters; tool-catalog/action-instruction markers were absent. Existing seven budget-helper tests passed, but they exercise the separate assembler rather than this complete builder. No model call occurred.
- Separate fix: apply one final budget including time/image extensions, define mandatory instruction priorities and test the actual complete prompt builder under oversized context rather than relying only on the helper's contract.


## DOC-CODE-031 — two Russian builtin prompts drift from the quick-intent registry

- Recorded: 2026-10-11. Status: open; existing contract tests fail and pure matching confirms the gap.
- Evidence: [Russian translation](../shared/web/frontend/src/i18n/locales/ru/marketing.json) `musicGenerate` omits `(XL Turbo)` and `xlBaseInteractive` uses the renamed wizard copy, while [registry](../shared/api/ewa_platform/companion/ux/quick_intents.py) retains the earlier phrases. [Preset builder](../shared/web/frontend/src/features/ewa/ewaCompanionQuickPresetsUi.ts) uses translated text; the matcher only recognizes registry prefixes.
- Trigger: submit either current Russian prompt through normal companion chat. `match_quick_intent` returns None, losing the intended `music_generation` or `music_xl_base_interactive` bypass hint.
- Impact: the supposedly synchronized builtin phrase path falls through to normal routing/planner/model behavior. This does not prove all music generation fails; the catalog's direct interactive-wizard callback avoids its text path when present.
- Verification: existing registry/route suites returned 72 passed, 2 failed on exact phrase sync. Pure matching of all 22 current Russian translated prompts matched 20, missing precisely these two. No model/tool/storage request occurred.
- Separate fix: reconcile approved public copy with stable route identity or maintained aliases, and test actual translated prompts through orchestration. Translation/application/test files remain unchanged in this documentation task.

## DOC-CODE-032 — English builtin prompts never match the quick-intent fast path

- Recorded: 2026-10-11. Status: open; localization-to-routing gap confirmed by pure matching.
- Evidence: [English translations](../shared/web/frontend/src/i18n/locales/en/marketing.json) supply 22 English builtin prompt texts used by [preset builder](../shared/web/frontend/src/features/ewa/ewaCompanionQuickPresetsUi.ts). [Backend matcher](../shared/api/ewa_platform/companion/ux/quick_intents.py) considers only `prompt_ru` for current and legacy specs. Normal chat request carries text, not a stable builtin id selecting this branch.
- Trigger: an English-language builtin submits its English prompt through chat.
- Impact: none receives the deterministic quick-intent registry/workflow bypass; requests rely on ordinary routing and model behavior. Local OCR/music-wizard UI paths can differ. This is not proof of universal English tool failure or an authorization bypass.
- Verification: actual matcher returned None for all 22 source English prompt texts, versus 20/22 current Russian texts. Existing sync tests inspect Russian copy only; no live provider/tool request was performed.
- Separate fix: introduce explicitly supported multilingual aliases or an authenticated validated stable intent field, keeping tool permission/prerequisite gates; exercise each supported locale instead of only key equality.

## DOC-CODE-033 — image-turn labels break echo clearing and text-only restore

- Recorded: 2026-10-11. Status: open; pure helper composition reproduces both effects.
- Evidence: [Submit hook](../shared/web/frontend/src/features/ewa/companionUx/useCompanionChatSubmit.ts) builds final optimistic user rows through [pendingUserTurnLabel](../shared/web/frontend/src/features/ewa/companionUx/companionPendingTurnUi.ts), adding localized `Image attached` / `Изображение прикреплено`. [Backend history helper](../shared/api/ewa_platform/companion/turn/vision_attachment.py) instead stores `[Изображение]`. `shouldClearPendingTurnEcho` requires exact content equality; [restore resolver](../shared/web/frontend/src/services/ewa/ewaCompanionChatCoerce.ts) returns the entire selected user content without stripping either synthetic marker.
- Trigger: successfully send an image-only or image-plus-text turn, reload the same stored user/assistant pair, then use restore after the pending request ends.
- Impact: optimistic echo remains because marker strings differ; restore can place only an image label into an otherwise text-free draft or append it to real text. After remount, stored history's marker is still restorable. The handler does not restore attachment bytes. No loss of backend image processing or every UI state transition is established.
- Verification: evaluated the actual pure function definitions from source after Node type stripping, with synthetic stored rows shaped by the inspected backend helper. Both image cases returned false echo clearing and restored marker-bearing text; text-free input returned `Image attached` (optimistic) or `[Изображение]` (stored). Existing selected helper/control suites passed but do not cover this composition. No browser/network/storage-service operation was involved.
- Separate fix: distinguish canonical user text from attachment/display metadata, compare stable turn identity or aligned canonical content and restore text only. Add integrated image-turn echo/recovery coverage in a separately authorized code change.

## DOC-CODE-034 — workflow catalog JSONB strings lose definitions and audit detail

- Recorded: 2026-10-11. Status: open; default-codec-shaped conversion reproduced.
- Evidence: [catalog converters](../shared/api/ewa_platform/persistence_pg/companion_workflow_catalog_asyncpg.py) return an empty definition/detail unless the JSONB value is already a Mapping. [EWA pool](../shared/api/ewa_platform/persistence_pg/orchestration_asyncpg.py) calls asyncpg.create_pool without a custom JSON codec. The default JSON/JSONB string behavior is documented in [asyncpg usage](https://magicstack.github.io/asyncpg/current/usage.html#type-conversion).
- Trigger: load a valid catalog definition/audit detail delivered as a JSON string. Downstream runtime/admin validation sees an empty definition.
- Impact: PG workflow overrides can be ignored/skipped or fail model validation; audit detail is silently empty. A builtin fallback can still work. This does not establish corruption of persisted JSON or a live catalog incident.
- Verification: actual `_row_from_catalog` with a complete synthetic JSON-string definition returned `{}`. Source calls trace this converter to list/get/enable/read results. No PG connection or catalog mutation occurred.
- Separate fix: consistently decode string JSONB and mappings, reject/log malformed shapes, and test list/detail/activation/audit using default-codec-shaped rows rather than only Python dictionaries.

## DOC-CODE-035 — workflow validation accepts invalid regex triggers

- Recorded: 2026-10-11. Status: open; validator/matcher mismatch reproduced.
- Evidence: [v1 trigger model](../shared/api/ewa_platform/schemas/pydantic/companion_workflow.py) checks nonblank regex text only; [service validation](../shared/api/ewa_platform/companion/services/workflow_catalog.py) checks tools and broadness but does not compile it. Runtime uses unguarded `re.search`.
- Trigger: a structurally valid workflow with regex `(`. Validate returns ok true; once effectively enabled and encountered, matching an ordinary line raises PatternError.
- Impact: an invalid admin definition can pass the intended pre-save/pre-enable check and break matching instead of returning no match. Reachability through a live PG row is also limited by DOC-CODE-034; no production failure is claimed.
- Verification: actual validator returned ok true; actual runtime matcher with an injected enabled-definition list and master gate then raised PatternError. No DB, provider or tool dispatch occurred.
- Separate fix: compile patterns during validation and reject/report invalid syntax before persistence/enablement, retain runtime defensive handling and cover trigger limits/complexity separately.

## DOC-CODE-036 — public confirm claim erases workflow gate state before resume

- Recorded: 2026-10-11. Status: open; full confirmation helper failure reproduced with mocked persistence.
- Evidence: [apply_companion_task_run_confirmation](../shared/api/ewa_platform/companion/orchestration/task_run_confirm.py) claims confirm by replacing confirmation_state with `{state:confirming, decision:confirm}` and passes the updated run into [workflow confirmation](../shared/api/ewa_platform/companion/workflows/action/confirm_flow.py). Generic workflow resume requires the original kind `workflow_confirm_gate` and step_index, now absent.
- Trigger: confirm an awaiting generic action-workflow gate through the normal public confirmation service.
- Impact: workflow resume declines the run; normal fallback can mark it failed with `missing_saved_action` instead of completing the gate/enqueueing the next step. Direct workflow-helper tests bypass the claim and can pass. Other specialized/DAG paths require their own complete reproduction.
- Verification: actual public helper with a complete synthetic gate/run and fake revisioned updates returned failed/missing_saved_action, made zero step updates and no enqueue. No PG/broker/tool call was performed.
- Separate fix: preserve gate identity while atomically claiming confirmation or pass an explicit immutable gate snapshot; exercise the public service with generic, specialized and DAG gates and concurrent confirmations.

## DOC-CODE-037 — inline declarative confirm gates save an incomplete resume state

- Recorded: 2026-10-11. Status: open; state mismatch reproduced without the public claim path.
- Evidence: [inline dispatch](../shared/api/ewa_platform/companion/workflows/user/declarative_advance.py) saves only `{step_key}` for a confirm_gate, while [generic resume](../shared/api/ewa_platform/companion/workflows/action/confirm_flow.py) requires kind plus positive step_index. The inline gate branch also passes an empty list to `_mark_workflow_step` when step_rows is omitted, rather than loading the gate row.
- Trigger: a generic v1 chain reaches an explicit confirm gate through inline advancement/default step_rows.
- Impact: the parent may be awaiting_confirmation without a resume-compatible gate state, and its persisted gate row may remain pending; direct generic resume returns None. This is independent of DOC-CODE-036's later state erasure.
- Verification: actual inline dispatcher with mocked updates captured `{step_key:gate}`; the actual direct workflow-confirm helper returned None for that state. The row-list default no-op follows inspected `_mark_workflow_step`. No live storage or tool operation occurred.
- Separate fix: share one canonical gate-state constructor/step persistence contract across inline/Celery paths and test inline dispatch through public confirm, not just manually constructed complete state.

## DOC-CODE-038 — generic catalog workflow continuation reloads only builtins

- Recorded: 2026-10-11. Status: open; custom-id continuation loss confirmed.
- Evidence: [starter](../shared/api/ewa_platform/companion/workflows/action/starter.py) can select PG definitions and start a generic non-user action run with workflow_id/version. [Continuation loader](../shared/api/ewa_platform/companion/workflows/user/declarative_advance.py) reads personal definitions only when user_workflow_id exists; otherwise it calls `get_builtin_workflow(id)` and ignores catalog pool/version.
- Trigger: continue a multi-step custom PG catalog workflow or a PG override of a builtin after its first step.
- Impact: custom ids have no continuation definition; same-id overrides can continue using builtin steps rather than the started version. This does not prove every builtin/user workflow fails. DOC-CODE-034 can prevent PG selection earlier.
- Verification: actual loader for a synthetic non-user custom catalog run returned None with no DB call; source verifies lookup only in builtin registry. No persisted catalog run or real child job was executed.
- Separate fix: bind runs to an immutable definition/version snapshot or reload the exact PG version with explicit fallback policy, and test custom/overridden definitions across sync and background-child continuation.

## DOC-CODE-039 — four registered tools lack required v2 catalog metadata

- Recorded: 2026-10-11. Status: open; existing contract test failure.
- Evidence: [v2 metadata/contract](../shared/api/ewa_platform/companion/orchestration/tool_catalog_v2.py) requires an overlay for every [registry](../shared/api/ewa_platform/companion/orchestration/tools/registry_core.py) key. Missing: `call_expert_chat`, `doc_append_block`, `mcp_call`, `mcp_list`.
- Trigger: export/check the current tool catalog after these handlers are registered.
- Impact: these entries fall back to default capability/execution/router/confirmation metadata, and the declared registry/catalog invariant fails. Export still returns entries; no permission bypass or universal tool failure is inferred from missing metadata alone.
- Verification: existing `test_tool_v2_meta_covers_registry` failed with those four names; registry/executor/confirm/catalog selection had 23 passes and one failure. No source/test metadata was modified.
- Separate fix: supply reviewed overlay semantics for all four tools and validate catalog, handler, router, workflow/editor consumers together; keep metadata distinct from actual execution/ACL enforcement.

## DOC-CODE-040 — saving an existing workflow version keeps live activation

- Recorded: 2026-10-11. Status: open; SQL contradicts disabled-until-enable save invariant.
- Evidence: [save handler](../shared/api/ewa_platform/gateways/routers/companion_admin.py) documents create/update as disabled until explicitly enabled. [Catalog INSERT](../shared/api/ewa_platform/persistence_pg/companion_workflow_catalog_asyncpg.py) starts new rows disabled but ON CONFLICT updates definition/actor/time without resetting enabled. It has no expected revision or immutable-version enforcement.
- Trigger: save changed content at the same id/version as an enabled catalog row.
- Impact: the active row's definition changes while activation remains true, bypassing a separate reviewed Enable action and violating the handler's stated invariant. This is an administrator workflow boundary, not unauthorized anonymous access; runtime PG decoder defects can prevent use independently.
- Verification: inspected exact conflict SQL; actual persistence function with a fake connection shaped as an existing enabled row returned enabled true. No real SQL or live workflow alteration occurred. This probe checks control/data conversion, not a deployed concurrent transaction.
- Separate fix: enforce immutable/create-only versions or deliberately disable/review activation on overwrite with revision checks and audit of changed definitions; align editor/API contract with the chosen behavior.

## DOC-CODE-041 — raw workflow validator can raise while reporting a bad version

- Recorded: 2026-10-11. Status: open; bounded helper error-path defect.
- Evidence: [validate_workflow_definition_raw](../shared/api/ewa_platform/companion/services/workflow_catalog.py) catches model validation errors, then calls `int(definition.get("version") or 0)` inside the failure response without conversion handling.
- Trigger: direct raw validation of a mapping with version `invalid`.
- Impact: the helper raises ValueError instead of returning ok false/errors. Typed HTTP validate/create rejects malformed version before this helper, so this probe does not establish an HTTP 500 for that exact request.
- Verification: actual raw helper with synthetic malformed input raised ValueError. No persistence, network or tool dispatch was involved.
- Separate fix: normalize error-report metadata defensively, and test malformed id/version/types in the raw service independently of typed HTTP validation.

## DOC-CODE-042 — future pending steps advance music status to the last stage

- Recorded: 2026-10-11. Status: open; pure helper mismatch reproduced.
- Evidence: separate `_music_progress_from_run` implementations in [single-task status](../shared/api/ewa_platform/companion/orchestration/check_task_status.py) and [active-task prompt/status](../shared/api/ewa_platform/companion/orchestration/active_task_runs_prompt.py) treat pending step indexes as current progress and select the highest index.
- Trigger: a music run snapshot contains stage 1 running and stages 2–4 pending. Both helpers return `(4, 4, Stage 4)`.
- Impact: chat/status/prompt progress can describe a future stage as current, contrary to the ground-truth progress invariant. This does not assert that all normal music runs precreate four pending rows or that every live run is affected; synthetic row shape and helper behavior are confirmed.
- Verification: actual pure functions with a four-row synthetic run, no database/provider/broker access. Existing eleven status/prompt tests passed but do not cover this row shape.
- Separate fix: derive current stage from running/terminal evidence while separating queued stages, share one progress contract across prompt/tool/UI, and cover sparse, precreated, failed, cancelled and completed stage lists.

## DOC-CODE-043 — task-status completed step count includes failed steps

- Recorded: 2026-10-11. Status: open; snapshot/formatter mismatch reproduced.
- Evidence: [build_task_status_snapshot](../shared/api/ewa_platform/companion/orchestration/check_task_status.py) increments `completed_steps` for both completed and failed rows, then the formatter presents the value as steps done/завершено.
- Trigger: an action run with one completed, one failed and one pending step.
- Impact: output reports `completed_steps=2` and “Steps: 2 of 3 done.” although only one step succeeded. Overall FAILED is preserved; this is misleading success/progress metadata, not a claim that the whole failure is hidden.
- Verification: actual pure snapshot and formatter on the synthetic mapping, no storage/tool call. Existing selected tests do not cover mixed failed/completed counts.
- Separate fix: expose distinct success/failure/terminal counts or rename terminal-count metadata and align user copy; test failure and skipped/cancelled step semantics.

## DOC-CODE-044 — content guard loses different ids under repeated field names

- Recorded: 2026-10-11. Status: open; actual async guard reproduced with mocked existence lookup.
- Evidence: [content reference guard](../shared/api/ewa_platform/companion/operations/result_payload_content_guard.py) merges `field_name -> id` dictionaries across result/step mappings and across list rows. Repeated unified_content_id keys overwrite earlier ids before existence lookup.
- Trigger: one run's result points to missing content A and its step output points to missing B under the same key, or multiple list rows use the same key with different ids.
- Impact: only the last id is checked; a missing earlier result can be marked available, leaving broken artifact controls. The guard is best effort independently when the catalog pool is unavailable.
- Verification: actual async sanitizer queried only B with a mock returning no existing ids; result A gained available while step B gained missing. No real catalog/storage call or HTTP acceptance occurred; the existing orphan module skipped on absent jose.
- Separate fix: collect every distinct normalized id in a set while preserving per-mapping fields, and test multiple result/step/list references plus partial availability.

## DOC-CODE-045 — normal operations status undercounts multiple active runs

- Recorded: 2026-10-11. Status: open; actual registered handler with mocked run loader.
- Evidence: [operations handler](../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py) normal path sets active_count to 1 from the first task_run; [answer helper](../shared/api/ewa_platform/companion/orchestration/active_task_runs_prompt.py) can format several rows but returns only the first. Router-bypass path counts the actual capped list.
- Trigger: a recognized normal status request while two or more active rows are selected.
- Impact: reply lists two operations while data.active_count says 1; structured semantics differ by dispatch path. This is a metadata defect, not loss of the second reply paragraph.
- Verification: actual handler with two mock active image runs returned two paragraphs and active_count 1; no pool/provider access.
- Separate fix: return count/list metadata from the common helper and align normal and bypass dispatch, including the empty/capped cases.

## DOC-CODE-046 — Confirm response schema strips the run snapshot before coercion

- Recorded: 2026-10-11. Status: open; actual Zod parser and coercer reproduced.
- Evidence: [chat coercion](../shared/web/frontend/src/services/ewa/ewaCompanionChatCoerce.ts) uses taskRunIdRowSchema with only id and strip inside the Confirm response schema. [Confirm client](../shared/web/frontend/src/services/ewa/ewaCompanionChatTaskRunsApi.ts) coerces the already stripped task_run.
- Trigger: any valid Confirm response containing completed status, revision 7 and result metadata.
- Impact: parsing retains only id; actual coercion returns pending/unknown, empty principal/payloads and revision 1. Immediate store patches can regress or be rejected as older while returned actions still dispatch; later list/SSE may repair state.
- Verification: actual source schema/parser/coercer with installed Zod and a synthetic response, no HTTP/React/provider call. Field loss and defaults printed by ephemeral Node probe.
- Separate fix: validate the complete run or preserve unknown run fields for reviewed coercion; test status, revision, payload, steps and principal through the actual HTTP-client parser.

## DOC-CODE-047 — summary trimming removes operation-card contract fields

- Recorded: 2026-10-11. Status: open; actual backend trim and frontend helper/merge probes.
- Evidence: [summary allowlists](../shared/api/ewa_platform/companion/orchestration/task_run_list_summary.py) omit user_workflow_id/workflow_id/title, availability tombstones, background_play and several presentation/progress fields. [Display/merge](../shared/web/frontend/src/features/ewa/companionOperations/companionOperationsDisplayFilters.ts) requires workflow identity and replaces equal/newer timestamp rows wholesale; the runtime polls summary by default.
- Trigger: a personal action workflow or artifact snapshot enters a normal summary poll, including after a full detail/SSE snapshot at the same timestamp.
- Impact: personal workflow recognition/cancel controls can disappear, missing-content markers can be lost, and full result metadata is overwritten. Step outputs can independently retain some presentation data; not every card/artifact is universally broken.
- Verification: actual trim produced only plan.kind and result.unified_content_id; actual UI helper then returned personal=false/cancellable=false, and actual merge replaced full PDF/progress result with the summary. Pure functions with synthetic rows, no live browser/storage.
- Separate fix: define minimum per-intent list contracts and retain required identity/availability/action/progress fields, or merge summaries explicitly without deleting full details; test the complete backend-list/client-card boundary.

## DOC-CODE-048 — SSE enabled flag prevents the documented outage polling fallback

- Recorded: 2026-10-11. Status: open; source control-flow evidence, not a live outage reproduction.
- Evidence: [operations runtime](../shared/web/frontend/src/features/ewa/companionOperations/useCompanionOperationsRuntime.ts) sets taskEventsStreamEnabledRef from pollEnabled && hasActiveOperations. [Stream hook](../shared/web/frontend/src/features/ewa/companionOperations/useCompanionTaskEventsStream.ts) reconnects internally and exposes no connection/health state to that ref.
- Trigger: SSE connection/Redis delivery is failing while polling remains enabled and active rows remain in the store.
- Impact: active safety GET stays at 300 seconds rather than entering the intended 20/45-second disabled-stream branch. A missed terminal event can remain stale until focus/manual/safety refresh. No live outage latency was measured.
- Verification: inspected both complete functions; existing runtime test passes the 300000-ms timer assertion with the SSE hook mocked to no-op, demonstrating enabled is independent of an actual connected stream.
- Separate fix: expose stream connection/freshness state and drive fallback polling from it with abortable reconnect; test failed connect, closed stream, lost terminal event and recovered transport.

## DOC-CODE-049 — operations regression fixtures expect live state without a heartbeat

- Recorded: 2026-10-11. Status: open; two existing frontend tests fail under current display contract.
- Evidence: [panel test](../shared/web/frontend/src/features/ewa/companionOperations/__tests__/CompanionOperationsPanel.test.tsx) and [store test](../shared/web/frontend/src/features/ewa/companionOperations/__tests__/companionOperationsStore.test.ts) construct active runs with updated_at null and expect live/active. [Display helper](../shared/web/frontend/src/features/ewa/companionOperations/companionOperationsMissionSurface.ts) deliberately marks missing timestamps stale for agentic and ordinary runs.
- Trigger: run the nine-file existing operations selection with the current fixtures.
- Impact: two assertions fail, reducing the usefulness of the declared live/selector regression gate. Stable reference assertions preceding the store status assertion pass; the result does not prove a React snapshot loop or broken product heartbeat policy.
- Verification: 37 passed, 2 failed; panel lacked live and store returned stale instead of active. No test/source changes were made.
- Separate fix: give live fixtures a controlled fresh heartbeat or assert stale deliberately, and keep selector reference stability and freshness as distinct test concerns.

## DOC-CODE-050 — embedded document primary save omits optimistic version

- Recorded: 2026-10-11. Status: open; mocked client dispatch and backend call signature evidence.
- Evidence: [document surface client](../shared/web/frontend/src/services/ewa/ewaCompanionDocumentSurfaceApi.ts) normally posts multipart replace-file with only file, even when body.expectedVersion is known. [Replace route](../shared/api/routers/unified_content_upload.py) has no expected-version input and calls replace_file_content without it; [storage service](../shared/api/services/unified_content/content_storage_service.py) performs version checking only when the optional argument is supplied. DocEditor fallback/force path does supply expected_version.
- Trigger: save a changed embedded document via a successful primary replace-file path after another editor has changed its version.
- Impact: that path can overwrite newer content without the intended version conflict. Version snapshots are separate recovery data, not optimistic conflict prevention. No concurrent live write was performed.
- Verification: actual client save function with expectedVersion 2 and mocked successful API sent multipart keys [file] and returned a mocked version 3 document. Backend route/service inspection establishes absent optional lock input; no content mutation/network call occurred.
- Separate fix: carry and enforce expected version atomically on the primary route or use one versioned save API; cover concurrent primary/fallback/force and storage-backend behavior.

## DOC-CODE-051 — stalled image recovery expects datetime after persistence converted it to ISO

- Recorded: 2026-10-11. Status: open; actual converter and recovery helper reproduced.
- Evidence: [task row converter](../shared/api/ewa_platform/persistence_pg/companion_task_asyncpg.py) returns created_at/updated_at as ISO strings. [Stalled-image kick](../shared/api/ewa_platform/companion/orchestration/companion_image_generation.py) skips a run unless created_at is a datetime, before loading step progress. The list GET with include_steps calls this intended recovery.
- Trigger: an eligible ten-minute-old running image row loaded through normal companion persistence conversion.
- Impact: poll-time orphan image recovery returns zero without inspecting its step or enqueueing, so the documented kick does not operate on normal converted rows. Other workers/reapers can independently recover/fail the run.
- Verification: actual converter on a synthetic datetime row, actual kick with its converted mapping and mocked persistence/enqueue: created_type str, zero recoveries/step reads/enqueues. No provider/broker/database operation.
- Separate fix: normalize timestamp representations consistently at the service boundary and cover the real persistence-to-recovery chain, including naive/aware/invalid times and heartbeat updates.

### Addendum to DOC-CODE-042 — frontend progress has the same pending-stage mismatch

- Recorded: 2026-10-11. New evidence appended without changing the earlier block. Actual [musicProgressFromRun](../shared/web/frontend/src/features/ewa/companionOperations/progressUi/musicPipelineProgress.ts) returned current 4, total 4 and Stage 4 for stage 1 running plus stages 2–4 pending. Client music_pipeline_progress can override this fallback, so this does not establish every displayed music run is affected. Pure Node source-function probe, no browser/provider operation.

## DOC-CODE-052 — TurnPlan enqueue reports success after a false persistence result

- Recorded: 2026-10-11. Status: open; actual enqueue wrapper reproduced with mocked persistence.
- Evidence: [enqueue](../shared/api/ewa_platform/companion/orchestration/turn_plan_v1.py) ignores the boolean returned by [profile upsert](../shared/api/ewa_platform/persistence_pg/companion_asyncpg.py), which returns false when the profile row is absent.
- Trigger: a nonempty queue request with upsert returning false rather than raising.
- Impact: callers publish queued hints/next_tool even though no profile plan was stored. Text truth guards can then describe an unsaved step as queued. This does not establish that normal authenticated profile creation always misses a row.
- Verification: actual enqueue with a one-step synthetic plan and AsyncMock upsert false returned true, one persistence call; no database/provider call.
- Separate fix: propagate the persistence result, classify missing-profile failure explicitly, and test caller hints/UI/protocol against false and exception outcomes.

## DOC-CODE-053 — TurnPlan cancellation claims success after clear failure

- Recorded: 2026-10-11. Status: open; actual resume/clear failure path reproduced.
- Evidence: [queue clear/resume](../shared/api/ewa_platform/companion/orchestration/turn_plan_v1.py) swallows clear exceptions and ignores persistence false; the cancel branch always returns a cancelled-steps reply.
- Trigger: an existing plan and recognized cancellation while the clear write raises or the profile disappears.
- Impact: the user is told planned steps were cancelled while the old persisted queue can remain eligible for a later proceed. This is distinct from cancelling an already running task and does not assert every cancellation fails.
- Verification: actual cancel helper with mocked clear exception returned turn_plan_cancel and the explicit cancelled reply; synthetic profile retained its one step. No real state mutation occurred.
- Separate fix: return a verified clear outcome and preserve truthful failure/resume metadata; cover storage errors and subsequent profile refresh/drain.

## DOC-CODE-054 — failed TurnPlan drain persistence permits repeated head dispatch

- Recorded: 2026-10-11. Status: open; actual sequential resume paths reproduced with mocked writes/tools.
- Evidence: [resume](../shared/api/ewa_platform/companion/orchestration/turn_plan_v1.py) dispatches the head before replacing the remaining queue or clearing the last step. It has no pre-dispatch claim/revision; remaining-write exceptions leave the old queue untouched.
- Trigger: a handled first tool followed by a failed remainder write, then another proceed with the unchanged persisted profile. Failed last-step clear has the same ordering risk.
- Impact: the completed/accepted head can be selected again, potentially duplicating effects. A row lock in each profile write does not make external dispatch and drain atomic. Live duplicate file/media effects were not executed.
- Verification: actual two-step resume twice with a failing mocked upsert called file_create twice and returned the same prefixed branch both times; mock profile stayed unchanged.
- Separate fix: use a durable claimed-step/idempotency contract and explicit acknowledgement/recovery state; test write failure after effect, two concurrent turns and cancellation races.

## DOC-CODE-055 — editor-open input can resume an unrelated queued music step

- Recorded: 2026-10-11. Status: open; actual queue selection/arguments reproduced.
- Evidence: [proceed regex/resume](../shared/api/ewa_platform/companion/orchestration/turn_plan_v1.py) accepts open/editor cues without comparing them with the queued tool. It preserves the stored action line and defaults bypass to true.
- Trigger: queued music_generation followed by «открой в редакторе» with no earlier branch handling the line.
- Impact: TurnPlan selects music rather than the requested editor route, with line-match bypass enabled. Actual provider dispatch still depends on downstream auth/feature/capacity gates; this probe does not bypass those checks.
- Verification: actual resume invoked a mock dispatcher for music_generation with the saved action line, current editor request and bypass true; no music/editor operation was run.
- Separate fix: make contextual proceed cues specific to the queued tool, preserve explicit queue continuation separately from new intent, and test queued cross-domain requests.

## DOC-CODE-056 — exported orchestration order disagrees with runtime defer precedence

- Recorded: 2026-10-11. Status: open; diagnostic/contract drift confirmed by source and actual runners.
- Evidence: [policy constants](../shared/api/ewa_platform/companion/orchestration/routing_policy.py) place catalog_discuss/list before compound/file-study/focus and leave DEFER_MEMORY_BRANCHES empty; [orchestrator](../shared/api/ewa_platform/companion/orchestration/task_orchestrator.py) calls run_defer_memory_phase before run_early_tool_branch_loop.
- Trigger: consumers treating ORCHESTRATION_PIPELINE_ORDER/orchestration_pipeline_order as a complete current execution trace.
- Impact: diagnostics, documentation and extension reasoning can predict the wrong winner; existing tests compare constants/fragments and miss the top-level discrepancy. This is not evidence that the actual compound-first runtime is itself wrong.
- Verification: actual runners recorded compound before catalog while the exported tuple has catalog before compound; all 42 existing routing/queue-related tests passed. No live tool execution.
- Separate fix: derive metadata and runtime phases from one representation or explicitly name metadata scope; test full orchestrator precedence including both pre passes and quick bypasses.

## DOC-CODE-057 — TurnPlan consumes a step on unavailable or failed tool response

- Recorded: 2026-10-11. Status: open; actual dispatch adapter and queue resume reproduced.
- Evidence: [dispatch adapter](../shared/api/ewa_platform/companion/orchestration/task_orchestrator.py) turns error/unavailable/missing-editor results into non-None terminal responses; [queue resume](../shared/api/ewa_platform/companion/orchestration/turn_plan_v1.py) drains every non-None response without a success/acknowledgement check.
- Trigger: queued tool cannot run and returns unavailable/error rather than None.
- Impact: its head is cleared or replaced by later steps despite no successful action; a subsequent continuation can skip the requested work. Accepted/confirmation responses have different semantics and need an explicit queue policy too.
- Verification: actual _run_tool_branch with a mocked unavailable file_open fed the real resume helper; unavailable reply was returned and queue-clear was called once. No real tool/PG call.
- Separate fix: retain/retry failed steps or record a deliberate skip policy using structured outcomes; test unavailable, error, needs_open_editor, needs_confirm, accepted and successful completion.

## DOC-CODE-058 — orchestrator TurnPlan wrapper omits its report collection

- Recorded: 2026-10-11. Status: open; bounded report integration gap reproduced.
- Evidence: [_run_turn_plan_resume_if_any](../shared/api/ewa_platform/companion/orchestration/task_orchestrator.py) calls resume without turn_reports and passes the bare _run_tool_branch; [queue failure helper](../shared/api/ewa_platform/companion/orchestration/turn_plan_v1.py) appends created reports only when that list is supplied. [Ledger](../shared/api/ewa_platform/companion/orchestration/execution_ledger.py) logs/returns reports without an implicit global collection.
- Trigger: queue resume returns None or remaining-step persistence fails while execution reporting is enabled.
- Impact: queue-specific failure evidence can be present in logs but absent from the outer turn's execution_reports/tool_trace. Other branch/tool reports can still exist; this does not assert every report is lost.
- Verification: actual wrapper with a mock None tool result and report-factory marker created one failure report, returned None and had no response/list path carrying the marker; queue remained unchanged. No live HTTP/protocol/store was exercised.
- Separate fix: pass the turn collection and reporting dispatcher through the wrapper, including fallthrough and drain failures; assert delivered reports on sync/SSE independently of logging.

## DOC-CODE-059 — TurnPlan strip regression asserts before lazy locale readiness

- Recorded: 2026-10-11. Status: open; existing test-readiness mismatch isolated.
- Evidence: [strip test](../shared/web/frontend/src/features/ewa/companionUx/__tests__/CompanionTurnPlanStrip.test.tsx) renders and immediately queries the DOM; [strip](../shared/web/frontend/src/features/ewa/companionUx/CompanionTurnPlanStrip.tsx) calls useTranslation(marketing). [Global setup](../shared/web/frontend/src/test/setupTests.ts) imports the cold [i18n bootstrap](../shared/web/frontend/src/i18n/config.ts) without loading marketing.
- Trigger: run the unchanged strip suite from a cold lazy-namespace environment.
- Impact: the queued-render assertion sees an empty DOM while locale loading suspends rendering. This is a regression gate readiness defect, not proof that the product component returns null for queued state.
- Verification: three-file selection 11 passed/1 failed; isolated unchanged strip 1 passed/1 failed. The same two tests with ephemeral setup awaiting i18nReady, RU and marketing namespace passed 2/2. Repo tests/config/source were unchanged; locale loading uses the local backend, no provider/storage acceptance.
- Separate fix: await the owning namespace/async render or provide controlled initialized translations, then retain button/pending/accessibility assertions.

## DOC-CODE-060 — direct catalog-discuss id/focus reads omit EwaFile membership

- Recorded: 2026-10-11. Status: open; workspace-contract gap reproduced with synthetic storage dependencies.
- Evidence: [handler](../shared/api/ewa_platform/companion/orchestration/tools/handlers_files.py) direct-id bypass and [focus reader](../shared/api/ewa_platform/companion/storage/catalog_file_discuss.py) read by UUID; [owner-byte method](../shared/api/services/unified_content/content_storage_service.py) checks owner/deleted status without folder membership. Named searches separately enforce the EwaFile query scope.
- Trigger: a known id or retained focus points to an owned file outside EwaFile, including after moving a formerly focused file.
- Impact: that path can read outside the documented companion workspace boundary. Owner authorization remains enforced; this is not evidence of reading another user's file or a complete security finding.
- Verification: actual handler, reader and owner-byte method with synthetic DB/backend objects returned memory_append for an outside-folder owned row; a different supplied owner returned no block and did not retrieve bytes. No real storage/database read.
- Separate fix: clarify whether explicit/focused ids intentionally permit broader owner scope; if the workspace invariant is required, recheck folder membership at the read boundary and cover move/stale-focus/direct-id cases.

## DOC-CODE-061 — catalog-discuss download limit is enforced after full retrieval

- Recorded: 2026-10-11. Status: open; actual reader ordering reproduced.
- Evidence: [reader](../shared/api/ewa_platform/companion/storage/catalog_file_discuss.py) awaits read_file_bytes_for_owner before checking length; [storage](../shared/api/services/unified_content/content_storage_service.py) retrieves the full backend body without that limit. The settings catalog describes the key as maximum bytes to fetch/protection from giant files.
- Trigger: a body larger than EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES.
- Impact: injection is rejected, but bandwidth/allocation have already been incurred; this is not a streaming resource cap. No production resource exhaustion or measured storage transfer was attempted.
- Verification: actual reader with configured 10000-byte cap and a mocked 10001-byte body called the full reader once before returning None; storage call ordering was inspected.
- Separate fix: apply a bounded retrieve/stream and verified size preflight at the storage boundary, with explicit behavior for missing/wrong metadata and expansion during normalization.

## DOC-CODE-062 — empty catalog text projection still claims a loaded document

- Recorded: 2026-10-11. Status: open; actual normalizer/read block reproduced.
- Evidence: [catalog reader](../shared/api/ewa_platform/companion/storage/catalog_file_discuss.py) checks raw bytes, then builds the directive/fence even when normalized markdown/plain_text strip to empty. Downstream checks see a nonempty metadata block.
- Trigger: nonempty whitespace bytes or an HTML body with no projected text.
- Impact: the main model receives a loaded-document directive with an empty body; later checks/reminders can treat it as successful grounding. This probe does not establish a fabricated final answer.
- Verification: actual reader/normalizer with whitespace bytes returned a nonempty loaded-by-server block and empty fence, mocked storage only.
- Separate fix: reject/explicitly classify empty projected text before declaring read success, and test blank, empty HTML and unsupported extraction paths.

## DOC-CODE-063 — NUL-free PDF bytes are injected as raw catalog text

- Recorded: 2026-10-11. Status: open; bounded format/projection mismatch reproduced.
- Evidence: [binary check](../shared/api/ewa_platform/companion/storage/catalog_file_discuss.py) tests only the first 4096 bytes for NUL; [text normalizer](../shared/api/services/doc_editor_text_normalizer.py) falls back to UTF-8 text for application/pdf without invoking an extractor. Filename resolution accepts PDF references.
- Trigger: PDF data without NUL in the inspected prefix.
- Impact: raw PDF syntax can be presented as the loaded document body rather than extracted text or an explicit unsupported-format result. This is not proof that all PDFs or every binary type are accepted.
- Verification: actual reader/normalizer with synthetic PDF-header/object bytes and application/pdf returned a loaded-document block containing %PDF and object syntax; no real PDF/Tika/provider processing.
- Separate fix: restrict this local projection to supported text formats or use an approved bounded extraction path; test representative PDF/DOCX/binary and invalid-encoding behavior.

## DOC-CODE-064 — disabled discuss still suppresses catalog-find prefetch

- Recorded: 2026-10-11. Status: open; pure feature-gate mismatch reproduced.
- Evidence: [prefetch skip predicate](../shared/api/ewa_platform/companion/storage/catalog_file_discuss.py) accepts named/deictic discuss intent without checking catalog_file_discuss_env_enabled. The handler separately rejects input when that gate is off; find verbs overlap discuss recognition.
- Trigger: discuss disabled, no injected memory/branch, and a matching find/read filename request that could otherwise use catalog-find.
- Impact: list/find appendix is suppressed despite no discuss read; subsequent chat can lose grounding. Catalog-find has its own independent feature/availability predicates, so no successful fallback for every such request is claimed.
- Verification: actual pure predicate with EWA_COMPANION_CATALOG_DISCUSS_ENABLED=0 and “find document report.pdf” returned skip true while discuss_enabled false; no query/model call.
- Separate fix: base suppression on enabled/successful ownership or preserve fallback after discuss failure; cover disabled, missing, ambiguous, denied and empty-content turns.

## DOC-CODE-065 — catalog-inject regression mock patches a re-export

- Recorded: 2026-10-11. Status: open; ineffective existing test binding confirmed.
- Evidence: [Wave C test](../shared/api/tests/test_ewa_companion_catalog_discuss_wave_c.py) patches tool_registry.dispatch_tool_by_name; the re-exported [resolver](../shared/api/ewa_platform/companion/orchestration/tools/registry_core.py) resolves dispatch_tool_by_name from registry_core globals.
- Trigger: run test_resolve_catalog_discuss_memory_inject_delegates expecting only fake dispatch.
- Impact: actual catalog handler/pool/query initialization may run instead of the fake; the declared no-DB test can stall or touch unintended dependency paths. Live DB access/result was not verified.
- Verification: initial selection stalled after two tests and was interrupted. Pure binding probe confirmed barrel_fake true but resolver_global_fake false and resolver_global_is_core true. Safe repeat deselected this test: 31 passed; four separate registry cases passed.
- Separate fix: patch where the resolver looks up dispatch and assert actual mock invocation/no dependency escape; keep re-export API coverage separate.

## DOC-CODE-066 — same-name create ignores the requested destination folder

- Recorded: 2026-10-11. Status: open; actual create-pipeline branch reproduced with mock storage.
- Evidence: [catalog pipeline](../shared/api/ewa_platform/companion/storage/catalog_pipeline.py) searches owner root/task scope before resolving destination, then replaces the existing id without expected_version or relocation.
- Trigger: create notes.md in task folder B while an exact-name hit exists in task folder A.
- Impact: the request can overwrite A's document and return A's location instead of creating in B. Bounded name lookup also is not a concurrent uniqueness guarantee. This is separate from DOC-CODE-050's editor-save caller.
- Verification: actual helper with an existing A row, explicit B target and synthetic storage called replace once/create zero, returned A, and supplied no expected_version. No real content or folder was mutated.
- Separate fix: define folder-scoped collision/reuse policy; require an explicit overwrite decision when another destination is selected, and pass a checked content version to replacement. Cover same/different folders, moved rows, result pagination and concurrent create.

## DOC-CODE-067 — external replacement changes objects before its version conflict

- Recorded: 2026-10-11. Status: open; actual replace method ordering reproduced with synthetic external objects.
- Evidence: [replace_file_content](../shared/api/services/unified_content/content_storage_service.py) deletes an old external path and stores the new body before the conditional metadata UPDATE; UPDATE 0 raises ContentVersionConflictError.
- Trigger: preflight read matches expected version, then another writer advances metadata before the conditional update.
- Impact: a reported conflict/DB rollback does not restore the old external object or undo the new one. Snapshot preservation may provide recovery data when enabled, but it is not an atomic rollback. No production loss, real transaction or backend persistence was exercised.
- Verification: actual method with fake SeaweedFS-name backend, fake transaction and UPDATE 0 recorded external_delete → external_store → conditional_update_0 → conflict exit; old synthetic object was absent, new one remained, current version reported 2. preserve_version=False isolated ordering; existing PostgreSQL mock tests do not cover this external effect.
- Separate fix: claim/lock the content revision before irreversible object operations, write to a distinct staged object, commit metadata with recovery/cleanup semantics, and cover conflict/store/verify/commit failures across backend switches.

## DOC-CODE-068 — research text overrides document request language and scale

- Recorded: 2026-10-11. Status: open; actual enrichment/compose prompt mismatch reproduced.
- Evidence: [request-first enrichment](../shared/api/ewa_platform/agentic/kernel/tool_args_enrich.py) appends Research context after Document request; [doc-create locale slice](../shared/api/ewa_platform/companion/orchestration/flows/doc_create.py) retains everything after Document request and language detection also scans the whole line. Long markers precede brief markers.
- Trigger: a brief English document request with Cyrillic research containing a long marker such as “Исследование”.
- Impact: the prompt forces Russian and long scale despite the English brief. The supplied short synthetic output was rejected after long minimum enforcement. This shows prompt/quality-gate behavior, not actual model language/factual output.
- Verification: actual enrichment and composer with mocked completion/runtime changed scale brief → long, emitted Output language MUST be Russian and returned no accepted body. No provider, database or file write was performed.
- Separate fix: parse authoritative request, mission context and research as separate fields; derive language/scale only from the request, then cover both mixed-language directions and research marker collisions.

## DOC-CODE-069 — confirmed insert reuses a stored target body without a version/buffer guard

- Recorded: 2026-10-11. Status: open; stale full-body proposal confirmed, client boundary inspected.
- Evidence: [doc_insert](../shared/api/ewa_platform/companion/orchestration/flows/doc_insert.py) reads stored target/source and saves a complete doc_editor_set_body action. [Confirmation](../shared/api/ewa_platform/companion/orchestration/task_run_confirm.py) emits that saved action without target reread/version check. [Editor consumer](../shared/web/frontend/src/components/UltimateDocEditor/hooks/useUltimateDocEditorInnerContentCompose.ts) checks content id/collaboration, then updates normalized content without a dirty-state/version guard.
- Trigger: unsaved editor changes already exist at proposal, or the target changes while awaiting confirmation.
- Impact: the prepared replacement body omits those changes and can replace current editor content with the older stored base plus source. The companion task revision does not validate content/buffer revision. Actual UI data loss or persistence was not tested.
- Verification: actual proposal with mock owner-byte reads saved old target plus new source in a complete action, read twice and stored no version guard. Client and confirm source paths were inspected; no mounted real editor or storage mutation was used.
- Separate fix: apply a versioned insertion operation against the current buffer, or capture/revalidate target and editor edit generation and require conflict handling before whole-body replacement. Cover unsaved changes, delayed confirm, document switches and collaboration.

## DOC-CODE-070 — compose regression mocks reject the new user_line keyword

- Recorded: 2026-10-11. Status: open; three existing regression failures reproduced.
- Evidence: [generative tests](../shared/api/tests/test_doc_create_generative.py) patch _doc_create_llm_runtime with zero-argument lambdas; [composer](../shared/api/ewa_platform/companion/orchestration/flows/doc_create.py) calls it with user_line=line.
- Trigger: run continuation, sliced-draft or below-minimum compose tests.
- Impact: all three fail with TypeError before the fake completion, so their intended continuation/quality assertions are not exercised. This does not demonstrate a production runtime signature failure.
- Verification: ten-file selection 60 passed/3 failed/1 deselected; separate generative confirmation test passed. Three ephemeral actual-function scenarios with keyword-compatible runtime mocks passed their multi-pass/continue/reject assertions. Repository tests/config/source were unchanged.
- Separate fix: update mock signatures and assert runtime receives the intended request/job-class inputs, then retain the bounded transport/output assertions.

## DOC-CODE-071 — shadow router telemetry always reports would_dispatch=false

- Recorded: 2026-10-11. Status: open; actual dispatcher telemetry reproduced.
- Evidence: [dispatcher](../shared/api/ewa_platform/companion/orchestration/tool_router_dispatch.py) includes router_tool_allowed_in_current_mode in its counterfactual; [mode predicate](../shared/api/ewa_platform/companion/sidecar/tool_router.py) always returns false in shadow.
- Trigger: any confident executable plan while mode=shadow.
- Impact: telemetry cannot indicate which decisions would dispatch under the proposed partial/full allowlist. Shadow correctly avoids execution, but rollout evaluation based on would_dispatch is misleading.
- Verification: actual dispatcher with a fake file_open plan at confidence .99 logged would_dispatch=false and invoked zero branches. No router HTTP or real tool effect.
- Separate fix: evaluate the counterfactual against an explicit target mode independently of shadow execution gating, and cover allowed/disallowed/low-confidence/chat-only observations.

## DOC-CODE-072 — router advertises Paperless id but drops it before dispatch

- Recorded: 2026-10-11. Status: open; schema-to-handler slot loss reproduced.
- Evidence: [FC schema](../shared/api/ewa_platform/companion/sidecar/tool_router.py) advertises paperless_id and paperless_import; [router model](../shared/api/ewa_platform/schemas/pydantic/companion_tool_router.py), parser and argument mapper have no paperless_id field. [Import handler](../shared/api/ewa_platform/companion/orchestration/tools/handlers_llm_utils.py) requires it and does not extract it from the line.
- Trigger: a valid router decision selects paperless_import with paperless_id=123.
- Impact: the handler returns a missing-id error despite the model supplying the requested id. This path cannot import solely through the advertised slot.
- Verification: actual payload parser/mapping and early handler gate with synthetic ToolContext dropped the id and returned error before any gateway/DB call. No Paperless service access.
- Separate fix: keep FC/Pydantic/parser/mapper/handler slots consistent, with positive integer bounds and a complete no-network argument-flow test.

## DOC-CODE-073 — planner nested args can carry internal auto-accept flags

- Recorded: 2026-10-11. Status: open; internal control-plane separation gap reproduced with synthetic plan/store.
- Evidence: [from_blob/from_v2](../shared/api/ewa_platform/schemas/pydantic/companion_intent.py) retain arbitrary nested args; [planner dispatcher](../shared/api/ewa_platform/companion/orchestration/intent_plan_registry_dispatch.py) merges them over server defaults; [registry](../shared/api/ewa_platform/companion/orchestration/tools/registry_core.py) passes them unchanged. [Create handler](../shared/api/ewa_platform/companion/orchestration/tools/handlers_files.py) accepts exact _auto_accept_hitl=True for immediate creation without a task confirmation.
- Trigger: parsed v2 file_create output includes nested _auto_accept_hitl=true (and can replace args.user_line), without a separately evaluated agentic policy/preference.
- Impact: model-provided args can choose the internal immediate-write path instead of normal confirmation. Owner storage authorization still applies. This is a bounded control-flag finding, not an end-to-end prompt-injection exploit or complete security assessment.
- Verification: actual from_blob → planner dispatch → registry → create handler with fake destination/store accepted the private flag, used the supplied argument line, invoked mock create once and returned status ok/task_run null. No actual file/provider/DB effect.
- Separate fix: allowlist per-tool public planner args, reject private/server-owned keys and apply internal flags after model arguments from verified policy only. Cover JSON/KV, user-line replacement and confirmation defaults.

## DOC-CODE-074 — router coerces NaN confidence to a dispatchable 1.0

- Recorded: 2026-10-11. Status: open; pure payload validation mismatch reproduced.
- Evidence: [payload parser](../shared/api/ewa_platform/companion/sidecar/tool_router.py) parses confidence with float then max(0, min(1, value)); NaN reaches the clamp rather than being rejected as nonfinite.
- Trigger: confidence supplied as the string NaN (or equivalent nonfinite model value accepted by JSON handling).
- Impact: the resulting typed plan has confidence 1.0 and passes the ordinary .62 threshold; malformed numeric output is treated as maximum certainty. This probe did not dispatch a real tool.
- Verification: actual parser on file_open/NaN returned confidence 1.0; threshold comparison was true. No HTTP/storage/runtime operation.
- Separate fix: reject nonfinite and invalid confidence before clamping, preserve a fail-closed parse result and cover NaN/infinity/missing/bool/string/out-of-range inputs.

## DOC-CODE-075 — bootstrap discards the planner's resolved sidecar model

- Recorded: 2026-10-11. Status: open; actual bootstrap-to-transport mismatch reproduced.
- Evidence: [fetch_companion_intent_plan](../shared/api/ewa_platform/companion/turn/phases/turn_bootstrap.py) resolves base/model but discards the model and passes base as explicit; [planner runner](../shared/api/ewa_platform/companion/sidecar/intent_planner.py) treats nonempty base_url as an override and selects _planner_model, whose fallback includes the chat model rather than shared router model.
- Trigger: ordinary planner enabled, sidecar model differs from chat model, and no explicit intent-model override.
- Impact: the chat bootstrap can send the chat-model id to the resolved router endpoint. A backend may reject it or route differently; actual backend behavior was not exercised.
- Verification: actual fetch and planner runner with mocked resolver returning router-model-synthetic and fake completion captured chat-model-synthetic at transport. No live inference request.
- Separate fix: pass the resolved model alongside base or resolve runtime once without reclassifying a default base as an explicit override; cover default, URL-only, model-only and combined overrides at the real bootstrap entry.

## DOC-CODE-076 — dynamic workflow routes shadow observation preferences

- Recorded: 2026-10-11. Status: open; actual ASGI route selection reproduced.
- Evidence: [router registration](../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py) declares GET/PATCH /{workflow_id} before GET/PATCH /observation-triggers. The dynamic id is a plain str and persistence casts it to UUID. [Client preferences](../shared/web/frontend/src/features/ewa/companionObservationTriggerPrefs.ts) silently falls back to local values on server errors.
- Trigger: authenticated GET or PATCH of /api/v1/ewa/companion-user-workflows/observation-triggers.
- Impact: the literal segment is handled as a workflow id; declared observation preference handlers are not reached. Server synchronization can fail while local controls continue to work. This is not proof of the current production response or preference loss.
- Verification: actual router in isolated async ASGI, mocked OAuth/pool/store, returned 500 for both requests; the store received observation-triggers as workflow_id and its synthetic UUID validation raised. Both preference handler dependency counters remained zero. No real PostgreSQL/profile/cache write or app lifespan.
- Separate fix: register static paths before dynamic paths or constrain/relocate the id route, validate UUID ids at the boundary and cover route selection plus server/local preference error reporting.

## DOC-CODE-077 — enable does not enable an initially disabled definition

- Recorded: 2026-10-11. Status: open; actual create/enable/matcher disagreement reproduced.
- Evidence: [create and enable routes](../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py) write enabled into the definition at creation but enable updates only the row. [Matcher](../shared/api/ewa_platform/companion/workflows/user/user_workflow_triggers.py) requires definition.enabled after the enabled-row query.
- Trigger: create a personal workflow with enabled=false, then POST its /enable endpoint (also applicable to a definition disabled by v2 metadata PATCH).
- Impact: row/UI enabled is true while the definition remains false, so its matching phrase does not start it. Disabling a previously true definition and re-enabling the outer row has a different outcome.
- Verification: actual ASGI routes with synthetic persistence and actual matcher produced row_enabled=true, definition_enabled=false and no match. No live task or database effect.
- Separate fix: define one authoritative enabled state or atomically synchronize row/definition on every mutation; cover initially disabled v1/v2 creation and both PATCH/toggle sequences.

## DOC-CODE-078 — v1 trigger-only PATCH leaves executable triggers unchanged

- Recorded: 2026-10-11. Status: open; actual route-to-matcher mismatch reproduced.
- Evidence: [v1 metadata PATCH branch](../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py) updates trigger_json without rebuilding definition_json when steps/dag are absent. [Matcher](../shared/api/ewa_platform/companion/workflows/user/user_workflow_triggers.py) reads definition.triggers; list helpers/collision checks use trigger_json.
- Trigger: PATCH only trigger.patterns on a linear personal workflow.
- Impact: UI/collision metadata displays the new phrase, while the previous phrase still executes and the new phrase does not. No runtime execution was performed by the probe.
- Verification: actual ASGI PATCH and matcher over an in-memory principal row returned visible new synthetic, old_matches=true and new_matches=false. No real PG/tool/model operation.
- Separate fix: rebuild v1 metadata from the existing steps for trigger/title/enabled edits, keep row and executable metadata consistent and verify matching after metadata-only saves.

## DOC-CODE-079 — empty steps PATCH raises an uncaught create-model error

- Recorded: 2026-10-11. Status: open; actual ASGI 500 reproduced.
- Evidence: [Patch model](../shared/api/ewa_platform/companion/workflows/user/user_workflow_validation.py) permits steps=[] (no min_length), but [route](../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py) constructs UserWorkflowCreateInV1, which requires at least one step, outside error translation.
- Trigger: PATCH {"steps": []} to an existing owned v1 workflow.
- Impact: a request accepted by the patch schema fails inside the handler with 500 instead of a bounded 422 authoring error. The probe did not mutate the stored row.
- Verification: actual router/validation through async ASGI with a synthetic existing row and raise_app_exceptions=false returned Internal Server Error. No live database/app lifespan.
- Separate fix: enforce matching step cardinality on Patch or catch/reclassify the reconstruction error before persistence; cover empty/null/omitted steps and v1/v2 replacement cases.

## DOC-CODE-080 — verified DAG validation and save use different quotas

- Recorded: 2026-10-11. Status: open; actual validation/save disagreement reproduced.
- Evidence: [validate-v2](../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py) uses auth_user.is_verified, while pooled create/PATCH calls [collision analysis](../shared/api/ewa_platform/companion/workflows/user/user_workflow_validation.py), which passes is_verified_user=False. [Limits](../shared/api/ewa_platform/companion/workflows/dag/limits.py) distinguish 3 regular and 10 verified nodes.
- Trigger: a verified user saves a valid personal graph with 4–10 nodes.
- Impact: validate-v2 reports success/max_nodes_allowed=10, but CRUD rejects the same graph under an unverified three-node limit. The route's pool-free verified branch is not used by CRUD, which already requires a pool.
- Verification: actual ASGI and graph validator with mocked auth/store accepted four print_log nodes at /validate-v2 (200/ok=true), then POST collection returned 422 node quota exceeded: 4 nodes (max 3 for unverified users). No nodes were executed or persisted to a real DB.
- Separate fix: pass the same authenticated validation context through collision/save validation, including PATCH; test regular/verified boundaries at both public routes.

## DOC-CODE-081 — one-step synchronous personal workflow leaves parent running

- Recorded: 2026-10-11. Status: open; actual starter/dispatcher state mismatch reproduced.
- Evidence: [starter](../shared/api/ewa_platform/companion/workflows/user/generic_workflow_starter.py) calls advance after inline success only when len(workflow.steps)>1. [Dispatcher](../shared/api/ewa_platform/companion/workflows/user/declarative_advance.py) marks a synchronous step complete but does not finalize the parent.
- Trigger: a personal workflow containing exactly one inline tool returning ok or memory_append.
- Impact: its only step completes but parent remains running with no terminal result/event/auth-snapshot deletion from advance; active-run reuse can report that it is still executing. Actual UI/retrigger behavior was not exercised.
- Verification: actual starter/dispatcher with in-memory task rows and synthetic theme_set result left parent_status=running, step_status=completed and result=null. Auth/cache/tool/event effects were explicitly stubbed.
- Separate fix: finalize single-step success through the same advance path and cover sync, memory_append, background, confirmation and failure outcomes.

## DOC-CODE-082 — personal workflow resume loads the current editable definition

- Recorded: 2026-10-11. Status: open; actual definition loader ignores recorded run version.
- Evidence: [resume loader](../shared/api/ewa_platform/companion/workflows/user/declarative_advance.py) fetches the current personal row by user_workflow_id and parses its definition_json without comparing workflow_version. Personal [PATCH/delete](../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py) permits edits/removal while runs remain active.
- Trigger: edit or delete a personal definition between an async/confirmation step and its continuation.
- Impact: later steps can use changed tools/args/order, or fail to load a deleted row, instead of the definition recorded at run start. V1 rebuilding version=1 can further obscure revision drift. No real side effect from a changed workflow was executed.
- Verification: actual loader given a synthetic run at workflow_version=1 returned the current synthetic definition at version=2 with changed theme args. No live row, worker or resumed tool execution.
- Separate fix: persist/resolve an immutable definition snapshot or revision by personal row id and run version, and define edit/delete behavior for existing runs with migration/recovery coverage.

## DOC-CODE-083 — synchronous advance replaces normalized outputs and drops later client actions

- Recorded: 2026-10-11. Status: open; actual two-step starter/advance payload loss reproduced.
- Evidence: [dispatcher](../shared/api/ewa_platform/companion/workflows/user/declarative_advance.py) initially stores reply/status/tool_name plus data; starter and recursive advance then supply raw data as step_output. [Step update](../shared/api/ewa_platform/persistence_pg/companion_task_asyncpg.py#L893) replaces nonnull JSONB, including repeated completed→completed updates. [Starter response](../shared/api/ewa_platform/companion/workflows/user/generic_workflow_starter.py) returns only step 1 reply/actions.
- Trigger: an inline multistep workflow whose successful tools return nonempty data and a reply/client actions; a later args template reads a prior reply.
- Impact: durable outputs lose reply/status/tool metadata, the next reply template resolves empty, and later inline actions are neither accumulated into the response nor stored by this output normalizer. Some intended desktop effects/review text can be absent. No mounted real client or external tool effect was tested.
- Verification: actual starter/dispatcher/advance over an in-memory store with two synthetic results changed both normalized outputs to {value:N}, passed empty text to step 2, completed parent with raw final data and returned only first reply/action. SQL replacement/terminal guard were inspected; broker/cache/thread effects were stubbed. Empty data is not the same overwrite case because the helper passes None.
- Separate fix: use one normalized result contract for dispatch/advance, avoid overwriting completed outputs with reduced data and define durable/client delivery for every synchronous action; cover prior-output templates and whole-chain response/review.

## DOC-CODE-084 — workflow rewrite regression patches the wrong pool binding

- Recorded: 2026-10-11. Status: open; ineffective mock binding confirmed and test attempt interrupted.
- Evidence: [workflow dispatch test](../shared/api/tests/test_user_workflow_tool_dispatch_args.py) patches tool_registry._resolve_main_pool, but [file handler](../shared/api/ewa_platform/companion/orchestration/tools/handlers_files.py#L132) invokes its own imported _resolve_main_pool.
- Trigger: test_file_rewrite_workflow_bypass_builds_server_first_line in the existing backend selection.
- Impact: the intended fake pool does not isolate the actual handler; the test can escape into real pool acquisition and stall. This does not prove a successful DB connection or production rewrite defect.
- Verification: initial selection reached the rewrite case after earlier passing tests and stalled; interrupted with exit 130, not accepted as isolated verification. Safe repeat excluded it (29 passed/1 failed/1 deselected). Actual handler with its local pool binding mocked invoked one fake pool/one fake server-first flow and passed the expected synthesized line with file name and brief.
- Separate fix: patch the dependency where consumed and assert no unexpected DB/provider/queue calls during test teardown; retain the argument-flow assertion through actual registry dispatch.

## DOC-CODE-085 — save-text workflow regression mock omits folder arguments

- Recorded: 2026-10-11. Status: open; existing regression TypeError reproduced.
- Evidence: [file-save test](../shared/api/tests/test_user_workflow_tool_dispatch_args.py) supplies fake_begin without task_key/folder_label/folder_item_id; [save handler](../shared/api/ewa_platform/companion/orchestration/tools/handlers_files.py#L757) forwards these fields to begin_doc_create_flow.
- Trigger: test_file_save_text_workflow_bypass_starts_doc_create_flow.
- Impact: the mock rejects task_key before its expected save assertions; the regression does not exercise its intended output/confirmation contract. The production flow accepts these arguments; this is not a runtime signature finding.
- Verification: safe existing six-file selection produced 29 passed, 1 failed, 1 deselected; failure was TypeError unexpected keyword argument task_key. No repository test/source/config was modified.
- Separate fix: update the fake signature to match the flow and assert default/explicit folder values alongside name/body/principal and confirmation status.

## DOC-CODE-086 — phrase regex boundaries reject punctuation and emoji triggers

- Recorded: 2026-10-11. Status: open; actual pure phrase conversion mismatch reproduced.
- Evidence: [phrase model/converter](../shared/api/ewa_platform/companion/workflows/user/user_workflow_validation.py#L188) accepts any nonempty bounded phrase and wraps escaped text with word boundaries on both sides; [matcher](../shared/api/ewa_platform/companion/workflows/user/user_workflow_triggers.py) executes that regex.
- Trigger: a phrase begins/ends with a nonword character, such as C++, !synthetic, synthetic! or a rocket emoji, and the user sends that identical phrase.
- Impact: these valid authored phrases fail exact self-matching; word-boundary placement assumes word characters at both edges. Related near-match behavior may also differ from literal phrase intent.
- Verification: actual _phrase_to_regex and re.search returned false for all four exact synthetic inputs, while ordinary synthetic trigger returned true. No database/task or provider operation.
- Separate fix: define phrase boundary semantics independently of edge character classes, or reject unsupported patterns at authoring with a clear error; cover Unicode letters, punctuation, emoji and embedded phrase boundaries.

## DOC-CODE-087 — DAG api_call can preserve user-authored outbound authorization

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [adapter reserved arguments](../shared/api/ewa_platform/companion/workflows/dag/tool_registry_adapter.py), [type-based guard](../shared/api/ewa_platform/companion/workflows/dag/dag_outbound_policy.py) and [actual outbound handler](../shared/api/ewa_platform/companion/orchestration/tools/handlers_comms.py).
- Trigger: A personal v2 api_call selects email_dispatcher and supplies inputs._dag_outbound_authorized=true, without a gate.
- Impact: The private flag survives sanitization, the validator/strict guard checks the api_call type, and the handler treats the flag as approval. A real send could be attempted when the adapter and email feature are enabled. This is not evidence that any real message was sent.
- Verification: Actual validator returned ok; actual runner/adapter/registry/email handler reached one AsyncMock send with zero proposals under a mocked strict guard=true. Removing the flag produced one synthetic confirmation proposal and no extra send. All persistence/send boundaries were local mocks.
- Separate fix: Remove caller control of private authorization; derive confirmation requirements from the resolved tool and trusted per-run gate state, with override/private-field regression coverage.

## DOC-CODE-088 — in-process DAG runner completes pending confirmation and accepted nodes

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [runner accepted/needs_confirm branch](../shared/api/ewa_platform/companion/workflows/dag/runner.py) and [confirm executor](../shared/api/ewa_platform/companion/workflows/dag/executors.py).
- Trigger: A library chain contains confirm_gate or a tool returning accepted followed by another node.
- Impact: The node is added to completed, outputs are registered and traversal continues without user approval/child completion. Library completed therefore does not establish workflow completion. Durable node handling has a different pause path.
- Verification: Actual two-node confirm→print_log run returned completed, gate outcome needs_confirm/confirmed=false and downstream completed. Actual outbound-without-private-flag probe also completed while its node outcome was needs_confirm. No live tool or worker was run.
- Separate fix: Give the library explicit suspended/awaiting states or reject noninline results; prevent downstream execution and resume only from trusted completion/approval.

## DOC-CODE-089 — DAG unresolved outputs escape retry and fallback handling

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [resolver](../shared/api/ewa_platform/companion/workflows/dag/variable_resolver.py), [runner](../shared/api/ewa_platform/companion/workflows/dag/runner.py) and [durable executor](../shared/api/ewa_platform/companion/workflows/dag/dag_node_executor.py).
- Trigger: A producer declares reply but returns no such output; a later node resolves that reply and has fallback_value/retry configured.
- Impact: Preflight accepts declarations, but resolution occurs before the NodeExecutionError catch and raises UnresolvedPlaceholderError rather than a structured failed/fallback outcome. Output declarations are not validated against execution results.
- Verification: Actual validator accepted the synthetic chain; actual library runner with a local producer returning {} raised UnresolvedPlaceholderError despite the consumer fallback mapping. Durable source has the same resolve-before-catch boundary; no live durable failure frequency was measured.
- Separate fix: Validate required output fields/types and route resolution errors through the explicit node policy, preserving diagnostic node/path and durable terminal state.

## DOC-CODE-090 — v1-to-v2 migration loses gates and leaves incompatible placeholders

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [migration helper](../shared/api/ewa_platform/companion/workflows/dag/migration.py) and [v2 validation](../shared/api/ewa_platform/companion/workflows/dag/validation.py).
- Trigger: Convert a linear definition containing a confirm_gate and a {{steps.0.output.reply}} argument.
- Impact: The gate becomes logic_filter, and the old placeholder is copied without rewriting to UUID outputs. The result can lose approval semantics or fail validation. Step order alone does not preserve workflow behavior.
- Verification: Actual converter produced [logic_filter, api_call], retained the legacy template and actual validator reported an unknown placeholder node. No migrated workflow was stored or executed.
- Separate fix: Map gates to durable confirm nodes, rewrite step references/dependencies and preserve supported tool/config/output semantics; reject unsupported conversion with explicit diagnostics.

## DOC-CODE-091 — DAG worker injects orchestration pool as application main_pool

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [worker context](../shared/api/ewa_platform/companion/workflows/dag/dag_node_executor.py), [job pool](../shared/api/ewa_platform/companion/jobs/executor.py), [EWA pool](../shared/api/ewa_platform/workers/ewa_pool.py) and [handler pool resolver](../shared/api/ewa_platform/companion/orchestration/tools/registry_helpers.py).
- Trigger: A durable DAG invokes a handler that uses _resolve_main_pool for application content/user data.
- Impact: The EWA_DATABASE_URL orchestration pool is also assigned main_pool, so its nonnull precedence bypasses lazy application-pool resolution. Separate database layouts can cause missing tables or incorrect contour access; live database layout was not inspected.
- Verification: Actual _build_tool_context with a tagged synthetic EWA pool set both pool fields to it, and actual handler resolver selected it. Source traced the public executor to the EWA worker pool; no pool was opened.
- Separate fix: Supply distinct application/EWA dependencies or leave main_pool unresolved for the lazy application path, with separate-contour tests.

## DOC-CODE-092 — DAG document byte loading omits owner scope

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [document resolver/catalog query](../shared/api/ewa_platform/companion/workflows/dag/workflow_document_services.py).
- Trigger: A document parsing tool is given another catalog UUID through unified_content_id/document_id.
- Impact: This resolver ignores ToolContext and queries id/deleted_at without an owner/principal predicate before retrieving bytes. Knowing a foreign id can bypass the ownership scoping used by other catalog paths. No foreign production document was accessed.
- Verification: Actual resolver over a mocked database returned synthetic bytes; the actual SQL parameters contained only content_id, no principal/owner predicate or authenticated id. Storage/provider operations were not invoked.
- Separate fix: Resolve bytes through the principal-scoped content authorization boundary, including permitted shared/workspace access, and reject foreign ids before any storage fetch; cover two-principal cases.

## DOC-CODE-093 — DAG branch and loop state diverges from SQL steps and blocks continuation

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [node success/branch/loop bookkeeping](../shared/api/ewa_platform/companion/workflows/dag/dag_node_executor.py) and [general prior-step guard](../shared/api/ewa_platform/companion/jobs/executor.py).
- Trigger: A branch is skipped or a for_each body is handled inline, followed by a later ordered node.
- Impact: DAG state removes those pending ids without synchronizing their SQL step rows. Empty-loop bodies are even reported ok/completed without execution. The outer worker can see a prior pending row and skip the queued continuation, leaving the parent running; direct handler tests can miss this.
- Verification: Actual durable handler with in-memory PG showed skipped branch/body rows still pending. The zero-item loop marked body completed/ok with {}; the actual public worker for next step returned prior_step_incomplete/blocked_by_step_index=2 and dispatch_calls=0. Direct continuation separately yielded a completed parent with a pending body row; that direct path is not public-worker acceptance.
- Separate fix: Persist explicit skipped/inline-body outcomes and SQL step statuses consistently with graph state, and make the outer guard DAG-aware; cover empty/nonempty loops, both branch orderings and merges through the public executor.

## DOC-CODE-094 — durable delay wakeup records a different value and output key

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [delay scheduling/wakeup](../shared/api/ewa_platform/companion/workflows/dag/dag_node_executor.py) and [inline delay](../shared/api/ewa_platform/companion/workflows/dag/executors.py).
- Trigger: Resolved inputs.delay_sec differs from config.delay_sec, or a later placeholder uses the inline declared delay_sec output.
- Impact: The countdown uses resolved input but wakeup reads config and emits delayed_sec. Saved results misstate the actual scheduled duration and expected downstream delay_sec can be unresolved.
- Verification: Actual two-phase durable handler with synthetic store/queue scheduled seven seconds but completed with {delayed_sec:1}. No timer wait, broker or live job was used.
- Separate fix: Persist the effective resolved duration for wakeup and unify declared/inline/durable output fields, with downstream placeholder coverage.

## DOC-CODE-095 — visual loop cap is dropped and execution has no item bound

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [frontend max_iterations field](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/registry/fieldSchemas.ts), [backend config](../shared/api/ewa_platform/schemas/pydantic/companion_workflow_v2.py) and [loop helper](../shared/api/ewa_platform/companion/workflows/dag/dag_loop.py).
- Trigger: A graph supplies config.max_iterations=1 with more items, including through the advertised inspector field.
- Impact: The backend model ignores that extra field and the loop processes all items. The ten-node cap does not limit repeated work/side effects or retained iteration outputs, so the presented limit does not control resource usage.
- Verification: Actual model serialization omitted max_iterations; actual pure five-item loop returned count=5/completed despite cap=1. Only local print_log body work was used.
- Separate fix: Define and enforce an authoritative item/iteration/result-size cap, reject unsupported config and align inspector/types/model; cover limits before any body side effect.

## DOC-CODE-096 — boolean expressions split operators inside grouping and quoted text

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [expression evaluator](../shared/api/ewa_platform/companion/workflows/dag/dag_expression.py).
- Trigger: An accepted decision/switch expression uses logical parentheses or quoted strings containing AND/OR.
- Impact: Regex splitting ignores parentheses and quoting, producing incorrect truth values and potentially choosing the wrong workflow branch. Absence of eval does not establish parser correctness.
- Verification: Actual pure evaluator returned true for false AND (false OR true), expected false, and for "x OR y" == "other", expected false. No workflow side effect was executed.
- Separate fix: Use a small tokenizer/parser with explicit precedence, grouping and literals, or reject unsupported grammar at preflight; cover nested groups and quoted operator text.

## DOC-CODE-097 — next DAG enqueue can fail after committed completion with no replay advance

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [advance/enqueue](../shared/api/ewa_platform/companion/workflows/dag/dag_node_executor.py) and [outer completed-step short circuit](../shared/api/ewa_platform/companion/jobs/executor.py).
- Trigger: The next-node enqueue returns None after the current node and parent plan were updated.
- Impact: The handler raises after committing completed current state/running parent/pending next step. Replaying the completed current step is short-circuited by the outer worker and does not itself repeat the missing enqueue. Eventual recovery is not guaranteed by these operations; no production broker outage was simulated.
- Verification: Actual node handler with synthetic PG and enqueue=None raised dag_next_node_enqueue_failed with current step completed, next pending and parent running. Source verified parent update before enqueue and general dispatch idempotency. Caller metrics rethrow exceptions; broker-level behavior remains untested.
- Separate fix: Use a durable outbox or explicit persisted pending-enqueue/reconcile operation, and make retry/replay repair missing dispatch without repeating tool side effects.

## DOC-CODE-098 — email summary preset fails current confirmation validation

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [preset](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/registry/dagWorkflowPresets.ts), [loader](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/presets/loadWorkflowPreset.ts) and [outbound validation](../shared/api/ewa_platform/companion/workflows/dag/dag_outbound_policy.py).
- Trigger: Load doc_summary_email and attempt backend validation even as a verified user.
- Impact: The four-node preset has an email node with no confirm_gate ancestor, so its advertised starter chain is invalid independent of editable recipient/document values. DOC-CODE-080 can additionally prevent verified saves above three nodes.
- Verification: Actual frontend loader remapped all four preset graphs; actual backend validator accepted the other three and rejected doc_summary_email for missing confirm_gate under verified context. No save or email was attempted.
- Separate fix: Include a gate and correct tier support in the preset, expose the gate/branch authoring needed for edits, and validate every shipped preset against the canonical backend contract.

## DOC-CODE-099 — loading an unsaved preset resets the builder to clean

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [preset hook](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/useCompanionDagBuilderPresets.ts), [dirty helper](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/state/dagBuilderDirtyState.ts) and [exit guard](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/CompanionWorkflowDagBuilderMode.tsx).
- Trigger: Load a preset into a new or existing editor and leave before saving or making further changes.
- Impact: The hook sets the preset graph as dirty baseline before any POST/PATCH. The UI can present saved/clean and permit explicit exit without an unsaved warning, losing the loaded replacement.
- Verification: Actual hook body, transformed with installed esbuild and local React callback/setter stubs, loaded two prompt/log nodes and actual dirty helper returned false; the hook has no persistence call. This was not a mounted browser-navigation test.
- Separate fix: Keep the last persisted baseline (empty for creation), mark loaded replacements dirty and clear dirty state only after successful persistence; cover new/edit preset exits.

## DOC-CODE-100 — visual builder creates unlabeled edges without a branch editor

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [connect mapping](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping.ts), [canvas connection](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/CompanionWorkflowDagBuilderMode.tsx), [edge panel](../shared/web/frontend/src/features/ewa/companionWorkflowDagBuilder/panels/DagEdgeMappingPanel.tsx) and [branch/loop validation](../shared/api/ewa_platform/companion/workflows/dag/dag_branch_validation.py).
- Trigger: Create a new decision/switch/for_each graph through palette and canvas connections.
- Impact: connectEdge creates source/target only; the edge inspector displays existing labels but has no control to author them. Required yes/no/case/body labels cannot be supplied by that UI path, so the palette exposes graph types that cannot be completed there. Loading existing labels is a different capability.
- Verification: Actual frontend mapping helper returned an unlabeled connected edge; full builder/context/edge-panel sources show no branch patch/control. Backend sources require labeled branches/body. No claim of a complete mounted interaction test is made.
- Separate fix: Add validated branch-label authoring and edge-label synchronization, including branch-specific defaults and duplicate handling; cover whole new decision/loop graph save through actual UI/backend validation.

## DOC-CODE-101 — workflow vision fetch accepts internal URLs and redirects

- Recorded: 2026-10-11. Status: open; actual fetch boundary reproduced with an in-process HTTP fake.
- Evidence: [vision URL resolver/fetch](../shared/api/ewa_platform/companion/workflows/dag/workflow_ai_services.py) accepts a user-supplied image_url/url, calls httpx GET with follow_redirects=true and checks MIME/4 MiB only after response.content is loaded. The inspected path does not validate destination host/IP before requests or redirects.
- Trigger: an enabled workflow vision tool receives an internal/loopback URL or an external URL redirecting internally.
- Impact: the service can attempt requests to worker-reachable internal destinations; MIME rejection occurs after the request and is not destination authorization. Full-body loading also precedes the size check. This is a source reachability/resource-bound defect, not evidence of a production credential read or successful internal attack.
- Verification: actual _fetch_image_attachment_from_url passed http://127.0.0.1:8080/synthetic.png to a local fake AsyncClient with redirects enabled and accepted synthetic PNG magic. No network socket, DNS request, model call or real internal endpoint was used. Redirect destination behavior is inferred from the configured HTTP client, not reproduced against a server.
- Separate fix: enforce the permitted URL schemes/destinations and resolved IP policy on every request/redirect, handle DNS changes, and stream with an authoritative size cap before retaining the body; cover private/loopback/link-local targets and redirects with no live network.

## DOC-CODE-102 — companion grounding budget does not bound defaults or KBSEW

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [grounding/default loading](../shared/api/ewa_platform/companion/turn/web_search_prefetch.py) and [sync/SSE entry](../shared/api/ewa_platform/companion/turn/chat_turn.py). The source describes parallel grounding under a wall-clock budget, but wait_for bounds only web_search_detailed.
- Trigger: Slow desktop config-default loading or KBSEW prefetch while the Web checkbox is enabled.
- Impact: Search cannot start until defaults return; the gather then waits for KBSEW even after the provider timeout became budget_exceeded. EWA_COMPANION_WEB_SEARCH_BUDGET_SEC is not an overall grounding/turn limit. Other service/client timeouts may exist; this finding does not claim infinite production requests or measured live latency.
- Verification: Actual grounding with mocked defaults held by an Event stayed pending beyond an injected 10-ms budget, with zero search calls. A separate Event-held KBSEW remained pending after Web timeout; releasing it returned error/budget_exceeded. All tasks were released/awaited and probes exited; no external I/O.
- Separate fix: Define distinct provider/grounding deadlines, bound defaults and parallel tasks with cancellation-aware remaining budgets, preserve honest partial results and test slow setup/retrieval paths.

## DOC-CODE-103 — unexpected KBSEW failure aborts Web grounding and SSE

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [KBSEW barrel search](../shared/api/services/kbsew/kbsew_prefetch.py) catches named KBSEW errors, while [companion grounding](../shared/api/ewa_platform/companion/turn/web_search_prefetch.py) awaits gather without a fallback. [Public stream generator](../shared/api/ewa_platform/companion/turn/chat_turn.py) catches ValueError around this phase, not other exceptions.
- Trigger: A retrieval/settings/formatting dependency raises an unexpected ordinary exception during optional KBSEW prefetch.
- Impact: Even completed Web results cannot be merged or delivered; a stream can stop after its search-stage event without an error/final/done event from this generator. This differs from supported typed KBSEW errors, which yield degrade notes. Actual HTTP/server/proxy handling remains untested.
- Verification: Actual KBSEW outcome/barrel functions with a synthetic RuntimeError retrieval, enabled fake settings and a successful mocked Web result raised through actual grounding. Actual public stream with fake profile/message resolution yielded one stage, then RuntimeError; no error/final/done. No model, DB, auth, HTTP, broker or provider call.
- Separate fix: Contain unexpected optional-grounding failures at an appropriate boundary, preserve the successful parallel result and emit an agreed terminal stream error/degrade outcome while retaining cancellation semantics.

## DOC-CODE-104 — IME confirmation Enter submits both companion composers

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [main textarea](../shared/web/frontend/src/features/ewa/companionUx/CompanionComposerTextarea.tsx) and [slim dock](../shared/web/frontend/src/features/ewa/companionUx/CompanionSlimChatDock.tsx) submit Enter without Shift and do not inspect composition state. Existing keyboard coverage asserts only ordinary Enter wiring.
- Trigger: Confirm an in-progress IME composition with Enter while an enabled composer contains text.
- Impact: The handlers prevent default and invoke send instead of allowing composition confirmation, potentially sending unfinished input. This is a callback contract finding; real IME/browser event sequences and devices were not tested.
- Verification: Actual TSX bodies transformed with existing esbuild and minimal React/JSX/translation/chrome scaffolding produced textarea handlers. Each received Enter with isComposing=true and nativeEvent.isComposing=true/keyCode=229; each invoked send once and preventDefault once. Shift+Enter added zero sends. No browser/model/network operation or repository test/source change.
- Separate fix: Respect native composition state in both owners and add meaningful composing/noncomposing Enter and Shift+Enter browser/component coverage.

## DOC-CODE-105 — social constructor does not cap parsed sections to the configured target

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [constructor parser/loop](../shared/api/ewa_platform/companion/orchestration/companion_social_post_constructor.py).
- Trigger: The model returns more sections than the requested target or includes additional headings parsed as sections.
- Impact: The loop expands all accepted sections, exceeding intended call/resource count. Its per-call httpx.Timeout is reused without a total elapsed deadline; a configured target is not a runtime bound. No production latency/cost was measured.
- Verification: Actual constructor with target 5, a fake twenty-section outline and actual expand/merge wiring made twenty expansions and twenty-two completion calls; all received 600-second per-call read timeouts. No sleeps or network calls.
- Separate fix: Cap/validate parsed section count, define total elapsed/resource budgets and preserve a truthful partial outcome on bounded exhaustion.

## DOC-CODE-106 — optional social-post polish failure discards a valid draft

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [single-shot](../shared/api/ewa_platform/companion/orchestration/companion_social_post_compose.py) and [constructor](../shared/api/ewa_platform/companion/orchestration/companion_social_post_constructor.py).
- Trigger: An optional polish completion raises a caught transport/runtime error after a usable first draft/merge.
- Impact: Both broad pipeline try boundaries return None, losing the already generated post. The handler then reports composition failure instead of retaining the usable draft.
- Verification: Actual single-shot got a synthetic valid 600-character draft, then RuntimeError on the second completion and returned None. Actual constructor with synthetic sections/merge and a failing polish also returned None. Fake HTTP context; no external calls.
- Separate fix: Isolate optional polish errors, keep the accepted draft, log a bounded degrade outcome and test both pipeline paths.

## DOC-CODE-107 — requested social-post source can fail silently while composition succeeds

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [source reader and handler](../shared/api/ewa_platform/companion/orchestration/companion_social_post_compose.py).
- Trigger: An explicitly requested named source read raises within the caught reader boundary or produces no accepted excerpt.
- Impact: The handler composes without source_text and can return ok without indicating that requested grounding failed. Pool-resolution failures outside this reader try can instead escape to a registry error.
- Verification: Actual source selection on a recognized file phrase used a synthetic catalog-read RuntimeError. Actual handler called the mocked composer with source_text=None and returned ok/source_file empty with no failure notice. The initial probe used a nonmatching English phrase; the corrected clean run is the accepted evidence.
- Separate fix: Distinguish optional absence from an explicitly requested unavailable source, report/ask before ungrounded composition and preserve source-status metadata through the public result.

## DOC-CODE-108 — social outline hashtag normalization doubles existing hashes

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [parse_post_outline](../shared/api/ewa_platform/companion/orchestration/companion_social_post_constructor.py).
- Trigger: The model emits the requested normal HASHTAGS body with multiple already-prefixed hashtags.
- Impact: lstrip removes only the initial hash, then replacing spaces prefixes the remaining already-prefixed tags again. Merge/fallback can receive malformed tags.
- Verification: Actual pure parser on #synthetic #widgets #audit returned #synthetic ##widgets ##audit. Existing parser test asserts only startswith(#), so it passes this defect.
- Separate fix: Normalize individual hashtag tokens once, preserve valid existing prefixes and assert exact multi-tag results.

## DOC-CODE-109 — internal horizontal rules truncate social-post copy and deictic context

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [frontend copy helper](../shared/web/frontend/src/features/ewa/companionLongreadReplyUi.ts) and [backend deictic helper](../shared/api/ewa_platform/companion/orchestration/companion_deictic_turn_context.py).
- Trigger: A generated post body contains a Markdown horizontal-rule line identical to its wrapper delimiter.
- Impact: Both non-greedy first-block regexes treat that internal rule as the closing wrapper and omit the tail. Copy and follow-up generation can use only the opening portion.
- Verification: Actual backend helper and actual TS helper transformed with existing esbuild extracted 189 of 242 synthetic body characters and lost the unique tail. No browser clipboard or generation call.
- Separate fix: Carry copy/source body as an unambiguous structured field or parse a verified outer envelope; cover internal rules and backend/frontend parity.

## DOC-CODE-110 — brief-only social-post bypass reaches a composer that rejects empty lines

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [handler and compose entry](../shared/api/ewa_platform/companion/orchestration/companion_social_post_compose.py).
- Trigger: Direct registry/internal invocation has bypass=true, a nonempty brief and neither args.user_line nor ctx.user_line.
- Impact: The handler explicitly accepts brief-only bypass but compose_social_post_text immediately returns None for an empty line, yielding error. Ordinary nonempty chat/workflow lines are not universally affected.
- Verification: Actual handler with a synthetic brief-only context called the actual wrapped composition once with line empty/brief present and returned status=error; no completion/DB/provider call occurred.
- Separate fix: Align accepted handler inputs with composition, either support a brief-derived request or reject it consistently at the boundary and test explicit slots.

## DOC-CODE-111 — personal-workflow social source field is retained but ignored

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [personal allowlist/catalog](../shared/api/ewa_platform/companion/workflows/user/user_workflow_allowlist.py), [client fallback](../shared/web/frontend/src/services/ewa/companionUserWorkflowToolCatalogFallback.ts) and [social handler](../shared/api/ewa_platform/companion/orchestration/companion_social_post_compose.py).
- Trigger: A personal tool step supplies the exposed file_query source field while its triggering user line does not name a file.
- Impact: Sanitization preserves the field but source resolution consults only the user line/profile. The selected source file is not read and a post can return ok without it.
- Verification: Actual sanitizer kept file_query=roadmap.md; actual handler with a synthetic trigger/bypass and catalog-read fake made zero reads, passed source_text=None and returned ok through a mocked composer. No real workflow/DB/storage/LLM activity.
- Separate fix: Resolve the structured source slot through the owned/ACL-checked catalog path, reconcile descriptor/router/workflow exposure and cover selected-source/no-source/failure cases.

## DOC-CODE-112 — social channel detection prefers topic mentions over the requested target

- Recorded: 2026-10-11. Status: open; source and bounded synthetic evidence.
- Evidence: [whole-line channel detector and handler](../shared/api/ewa_platform/companion/orchestration/companion_social_post_compose.py).
- Trigger: A request names a target channel and mentions an earlier detector channel in its topic.
- Impact: The first detector matching anywhere in the line wins, so format/pipeline/header can target the wrong channel. Brief stripping also removes channel names from the topic, although the original line is still passed to the model.
- Verification: Actual handler on write a LinkedIn post about Telegram growth chose/passed telegram through a mocked composer and returned that channel. Its derived brief was write a post about growth. No live model or publish operation.
- Separate fix: Parse the requested channel relation separately from topic tokens, preserve subject names and test cross-channel topics and explicit slot precedence.

## DOC-CODE-113 — ordinary acknowledgment replaces the active assistant plan

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [refine_intent.py](../shared/api/ewa_platform/companion/plans/refine_intent.py), [service.py](../shared/api/ewa_platform/companion/plans/service.py), [companion_plans_asyncpg.py](../shared/api/ewa_platform/persistence_pg/companion_plans_asyncpg.py). Owners: companion/plans/refine_intent.py and companion/plans/service.py; companion/orchestration/tools/handlers_ops.py; persistence_pg/companion_plans_asyncpg.py.
- Trigger: An active plan exists and a line such as «Да, хорошо» or «Нет, уже готово» matches the broad refinement regex.
- Impact: The plan handler regenerates content from that line alone and calls full replacement. Persistence deletes prior goals/tasks and inserts pending rows, losing ids, completed steps and meaningful project content. Earlier orchestration may consume some lines; this finding proves the selected plan handler path, not every public turn.
- Verification: Actual handler with an actual service/rule generator and synthetic active bundle called mocked plan_replace_content once for each line, returned ok and supplied three new generic steps with no original Ship widget task. No database writes or model calls.
- Separate fix: Require a plan-specific contextual refinement intent, preserve explicit content/progress where appropriate and test unrelated acknowledgments through the orchestration path.

## DOC-CODE-114 — invalid named calendar dates raise during plan intent parsing

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [schedule.py](../shared/api/ewa_platform/companion/plans/schedule.py), [handlers_ops.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py). Owners: companion/plans/schedule.py; companion/plans/refine_intent.py; companion/orchestration/tools/handlers_ops.py.
- Trigger: A recognized date range includes an impossible civil date such as 31 February, or 29 February in a nonleap reference year.
- Impact: The parser checks only day 1–31 then constructs date without catching ValueError. This can escape a gate before the handler write try; daily-signal paths may instead reach the caught write error. It does not reliably become a clarification or no-match result.
- Verification: Actual parser with reference 2026-10-11 raised ValueError for 31 февраля and 29 February. Actual plan handler on a no-daily-signal invalid range raised before its write catch with a mocked active read.
- Separate fix: Validate actual civil dates and contain parsing errors at intent boundaries; return truthful clarification and cover invalid/nonleap dates.

## DOC-CODE-115 — plan time parser ignores AM/PM and evening suffixes

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [time.py](../shared/api/ewa_platform/companion/plans/time.py). Owners: companion/plans/time.py; companion/plans/schedule.py; companion/plans/service.py.
- Trigger: A user supplies a 12-hour clock or a Russian evening qualifier recognized by the clock regex.
- Impact: Suffixes are accepted syntactically but not captured/converted. A resulting local task time can be twelve hours wrong, and midnight is parsed as noon.
- Verification: Actual parse_clock_time_fragment returned 06:30 for at 6:30 pm and в 6:30 вечера, and 12:00 for 12:00 am. Pure functions only; no calendar/DB/provider writes.
- Separate fix: Either implement explicit qualifier conversion including noon/midnight or reject unsupported qualified input and ask for 24-hour time.

## DOC-CODE-116 — plan JSON extractor counts braces inside quoted strings

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [service.py](../shared/api/ewa_platform/companion/plans/service.py). Owners: companion/plans/service.py.
- Trigger: Valid model JSON has an opening/closing brace in a string such as title «Use } braces».
- Impact: The depth scanner ends early or never reaches zero because it ignores JSON string/escape state. Valid structured output is rejected and the service can replace it with generic rule fallback.
- Verification: json.loads accepted the synthetic title/goals/tasks object; actual _extract_json_object returned None. No model/HTTP request.
- Separate fix: Use a proper JSON decoder for the first object or implement quoted-string/escape-aware extraction; cover braces and escapes in values.

## DOC-CODE-117 — nullable plan PATCH fields cannot clear stored values

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_plans.py](../shared/api/ewa_platform/gateways/routers/companion_plans.py), [companion_plans_asyncpg.py](../shared/api/ewa_platform/persistence_pg/companion_plans_asyncpg.py). Owners: gateways/routers/companion_plans.py; schemas/pydantic/companion_plans.py; persistence_pg/companion_plans_asyncpg.py; client services/ewa/ewaCompanionPlansApi.ts.
- Trigger: A typed PATCH explicitly sends null for due_date, due_time, due_duration_minutes or description.
- Impact: The router loses unset-versus-null distinction with payload.get; persistence emits assignments only for non-None values. The request can succeed with 200 and preserve the stored slot/notes. all_day=true separately clears time/duration but not date, and an empty description string clears notes.
- Verification: Actual async ASGI PATCH with async auth fake, real persistence assignment builder, synthetic SQL and mocked bundle reads returned 200 with zero UPDATE statements for four null fields. Control all_day=true emitted time/duration=NULL SQL. Returned date stayed 2026-10-12; no live DB/auth.
- Separate fix: Preserve field presence with an explicit sentinel/update mapping, define nullable clear semantics and cover omitted/null/value and all_day transitions.

## DOC-CODE-118 — invalid model due dates survive normalization and fail persistence

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [service.py](../shared/api/ewa_platform/companion/plans/service.py), [companion_plans_asyncpg.py](../shared/api/ewa_platform/persistence_pg/companion_plans_asyncpg.py). Owners: companion/plans/service.py; persistence_pg/companion_plans_asyncpg.py.
- Trigger: An accepted titled LLM task contains a nonempty invalid ISO due_date.
- Impact: Normalization catches date parsing failure and retains the string. The later persistence parser raises, outside optional model-structure fallback, so saving fails instead of rejecting or repairing the structure first. This is not evidence of a production model emitting that value.
- Verification: Actual _normalize_task_due_dates retained 2026-02-31 and actual _parse_task_schedule_fields then raised ValueError. Source trace places insertion after structure resolution; no provider/SQL execution.
- Separate fix: Validate model task schedule fields before accepting structure, discard/clarify invalid dates and retain an explicit rule fallback policy.

## DOC-CODE-119 — single open plan task completes despite a different requested title

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [task_complete_intent.py](../shared/api/ewa_platform/companion/plans/task_complete_intent.py), [handlers_ops.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py). Owners: companion/plans/task_complete_intent.py; companion/orchestration/tools/handlers_ops.py.
- Trigger: A completion phrase names a task that does not match the sole remaining open plan task.
- Impact: The matcher unconditionally falls back to that sole task, so an explicit different title does not prevent marking the wrong step completed.
- Verification: Actual completion handler on «Отметь выполненным: completely unrelated task» and synthetic sole open Ship widget returned ok and called mocked completion for synthetic-task. No DB write; the full chat priority is not independently exercised.
- Separate fix: Restrict single-task fallback to genuinely unqualified completion acknowledgments; require a match/clarification for explicit different titles.

## DOC-CODE-120 — daily-sprint regression test depends on an unfixed local date

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [test_ewa_companion_plan_schedule.py](../shared/api/tests/test_ewa_companion_plan_schedule.py). Owners: test_ewa_companion_plan_schedule.py; companion/plans/service.py; companion/plans/schedule.py.
- Trigger: The rule-based daily-sprint test runs on a date other than its implicit 2026-08-19 reference.
- Impact: It hardcodes seven tasks while invoking date.today. At local 2026-10-11 the parser swaps reversed August/today bounds and yields 48 tasks. The regression assertion changes with time rather than isolating the intended schedule preference.
- Verification: Existing nine-file backend run: 53 passed, this one failed. Actual rule structure gave 48; actual daily helper with explicit reference 2026-08-19 gave seven. No repository test/date/config change. One Starlette deprecated-422-name warning also appeared.
- Separate fix: Inject/freeze the clock for the rule-service test and add separately specified past-end/reversed-range expectations.

## DOC-CODE-121 — plan row decoder drops default-codec JSONB metadata

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_plans_asyncpg.py](../shared/api/ewa_platform/persistence_pg/companion_plans_asyncpg.py), [orchestration_asyncpg.py](../shared/api/ewa_platform/persistence_pg/orchestration_asyncpg.py). Owners: persistence_pg/companion_plans_asyncpg.py; persistence_pg/orchestration_asyncpg.py.
- Trigger: A plan row metadata value is JSONB text rather than an already decoded dict.
- Impact: _row_plan replaces it with an empty dict, losing source/provenance. The inspected pool opener calls asyncpg.create_pool without a custom JSON codec. This is the plan-specific decoder; earlier atom/catalog/prompt decoder findings cover distinct owners.
- Verification: Actual _row_plan on a complete synthetic row with metadata={"source":"synthetic_plan"} encoded as a string returned {}. No live PostgreSQL/default-driver query; codec compatibility is conditional on the supplied row type.
- Separate fix: Reuse tolerant JSONB-object decoding at this owner and verify string/dict/malformed/null metadata round trips with database integration separately.

## DOC-CODE-122 — rail plan archive omits cross-surface invalidation

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [useCompanionLeftRailController.ts](../shared/web/frontend/src/features/ewa/companionUx/useCompanionLeftRailController.ts), [useCompanionPlanCalendarOverlay.ts](../shared/web/frontend/src/pages/Desktop/hooks/useCompanionPlanCalendarOverlay.ts). Owners: client features/ewa/companionUx/useCompanionLeftRailController.ts; pages/Desktop/hooks/useCompanionPlanCalendarOverlay.ts; services/ewa/companionActivePlanInvalidation.ts.
- Trigger: Archive succeeds through the companion rail while calendar/widget plan subscribers already hold a bundle.
- Impact: The callback clears only its local bundle and prior-id ref, without dispatching the invalidation used by refresh/completion/calendar writes. Subscribers can keep archived task projections until another query/refetch event; no universal stale duration is asserted.
- Verification: Actual TS controller transformed with existing esbuild and synthetic React/API dependencies executed one successful archive with zero invalidation calls. Its completion control emitted one. Effects were not mounted and no real browser/API request was used.
- Separate fix: Broadcast successful archive invalidation and reconcile mutation/refresh ordering; verify mounted cross-surface removal and failure preservation.

## DOC-CODE-123 — invalid personal-calendar chat date silently becomes today

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [service.py](../shared/api/ewa_platform/companion/calendar/service.py), [handlers_ops.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py).
- Trigger: A recognized create line contains an impossible explicit ISO date and a usable time/title.
- Impact: The parser catches the invalid date and substitutes the operator-local current day. The handler can return successful creation for a different date, without clarification.
- Verification: Actual parser under a synthetic fixed 2026-10-11 wall clock mapped 2026-02-31 to 2026-10-11 18:00. Actual handler with a title override and fake main-pool/create boundary returned ok/created=true and passed that start. The first unrecognized phrase was corrected; no real event write.
- Separate fix: Reject impossible explicit dates and request clarification before any write; cover invalid leap/month dates through the handler.

## DOC-CODE-124 — personal-calendar chat ignores AM/PM qualifiers

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [service.py](../shared/api/ewa_platform/companion/calendar/service.py).
- Trigger: A create request supplies a 12-hour clock, such as tomorrow at 6:30 pm.
- Impact: The first HH:MM fragment is read as a 24-hour value and the qualifier is ignored, placing the event twelve hours early. This owner is separate from the plan-time parser in DOC-CODE-115.
- Verification: Actual parser with fixed synthetic clock and explicit title returned 2026-10-12 06:30 for tomorrow at 6:30 pm. Pure function only; no provider or database.
- Separate fix: Support explicit 12-hour conversion/noon/midnight, or reject qualified input and request 24-hour time.

## DOC-CODE-125 — companion calendar identity omits the desktop REST email fallback

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [service.py](../shared/api/ewa_platform/companion/calendar/service.py), [desktop.py](../shared/api/routers/desktop.py), [handlers_ops.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py).
- Trigger: An OAuth user has an opaque subject and an email matching a stored users row.
- Impact: CalendarApp REST can resolve the owner by email, while companion tools/prompt parse only principal_id as UUID. The same account receives unavailable/unread calendar context despite having usable personal-calendar REST. This is a path divergence, not an authentication bypass.
- Verification: Actual get_desktop_user_id with an opaque synthetic OAuth id/email and a fake DB returned the matching stored UUID; actual principal_to_desktop_user_id returned None for that id. Tool/prompt sources show their unavailable branches. No real OAuth or DB.
- Separate fix: Use a shared authorized owner mapping at both boundaries, retaining foreign-owner protection; test opaque-subject/email and UUID cases.

## DOC-CODE-126 — calendar day membership assumes every local day has 24 hours

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [desktopCalendarEventPolicy.ts](../shared/web/frontend/src/pages/Desktop/utils/desktopCalendarEventPolicy.ts).
- Trigger: The browser timezone has a spring/fall DST transition and an event lies near the following/late local midnight.
- Impact: eventOverlapsLocalDay adds 86400000 milliseconds to local midnight. On a 23-hour day it includes part of the next day; on a 25-hour day it excludes the final hour, affecting grid/agenda/dot membership.
- Verification: Actual TS helper transformed with existing esbuild under TZ=America/New_York included next-day 00:30 on 2026-03-08 and excluded same-day 23:30 on 2026-11-01. The local days measured 23 and 25 hours. No browser or repository timezone/config mutation.
- Separate fix: Construct the next local civil midnight through calendar arithmetic and cover both DST transitions and half-open boundaries.

## DOC-CODE-127 — mounted taskbar today queries do not roll over at midnight

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [useTaskbarClockTodayIndicator.ts](../shared/web/frontend/src/pages/Desktop/hooks/useTaskbarClockTodayIndicator.ts), [TaskbarClock.tsx](../shared/web/frontend/src/pages/Desktop/components/TaskbarClock.tsx).
- Trigger: The taskbar/indicator remains mounted across local midnight.
- Impact: The indicator memoizes today and its query range with empty dependencies; TaskbarClock similarly memoizes its today value. A ticking clock/render does not refresh those memoized days, so the dot/day context can refer to yesterday until remount.
- Verification: Actual indicator hook transformed with minimal React/query fakes and synthetic Date moved from 2026-10-11 23:59 to 2026-10-12 00:01, yet passed the identical Oct-11 query range twice. TaskbarClock source has the same empty-dependency date memo. No mounted clock/browser test.
- Separate fix: Maintain a civil-day key that updates on midnight/focus/clock changes and rebuild range/deep-link state; cover a persistent mount across day rollover.

## DOC-CODE-128 — calendar editor retains the previous event draft when selection changes

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [CalendarEventEditor.tsx](../shared/web/frontend/src/pages/Desktop/apps/calendarApp/CalendarEventEditor.tsx), [CalendarDayAgendaPanel.tsx](../shared/web/frontend/src/pages/Desktop/apps/calendarApp/CalendarDayAgendaPanel.tsx), [CalendarApp.tsx](../shared/web/frontend/src/pages/Desktop/apps/CalendarApp.tsx).
- Trigger: With the inline editor mounted, selecting another grid event changes initial props while reusing the editor instance.
- Impact: The editor seeds useState once and does not reset on identity change; the agenda renders it without an identity key. Fields from event A can be submitted while parent callbacks target event B. The probe proves draft/callback behavior, not an actual server overwrite.
- Verification: Actual TSX editor transformed with existing esbuild/minimal preserved hook state was rendered first with A then B. Its actual submit callback sent A title/notes after B initial props. App/agenda sources provide the reuse/target path; no browser or HTTP mutation.
- Separate fix: Key/reset editor state by stable edit identity with explicit unsaved-change handling, and verify event switches with a mounted form and correct mutation target.

## DOC-CODE-129 — calendar optimistic rollback removes another successful cache mutation

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [useDesktopCalendarEvents.ts](../shared/web/frontend/src/pages/Desktop/hooks/useDesktopCalendarEvents.ts).
- Trigger: Two personal-calendar mutations overlap; B succeeds after A snapshots the caches, then A fails.
- Impact: A onError restores the whole earlier prefix snapshot, removing B successful result from local caches until reconciliation/refetch. This is transient client-cache loss, not deletion of the persisted B event.
- Verification: Actual transformed hook mutation options with minimal React Query/QueryClient fakes ran A onMutate, B onMutate, B onSuccess and A onError. Cached titles changed from Event A/Saved B to an empty original snapshot. No mounted React Query/network/server write.
- Separate fix: Rollback only the failing mutation delta or coordinate pending mutations/versioned snapshots; test overlapping success/failure and range reconciliation.

## DOC-CODE-130 — type-empty PNG or WebP attachment is labeled JPEG by the client

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companionVisionFormats.ts](../shared/web/frontend/src/features/ewa/companionVisionFormats.ts), [companionImageAttachment.ts](../shared/web/frontend/src/features/ewa/companionImageAttachment.ts), [vision_attachment.py](../shared/api/ewa_platform/companion/turn/vision_attachment.py).
- Trigger: A selected PNG/WebP File has an empty browser MIME type and an allowed filename extension.
- Impact: The client format gate accepts the extension, but the reader defaults MIME to image/jpeg. Raw PNG/WebP bytes then fail the server MIME/magic equality check. This is a conditional supported-format failure, not evidence about a particular real browser/device.
- Verification: Actual client format/reader/payload functions, transformed by Node built-in TypeScript stripping with a fake FileReader/object URL, accepted synthetic.png with type empty and returned image/jpeg plus PNG base64. Actual backend resolver on those PNG bytes/JPEG MIME raised companion_vision_magic_mismatch. No file picker, image provider or network.
- Separate fix: Resolve a canonical allowed MIME from validated bytes or an explicit extension fallback and retain server magic checks; cover empty/mismatched browser types for all accepted formats.

## DOC-CODE-131 — OCR failure is represented as successful absence of image text

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_image_ocr_analyze.py](../shared/api/ewa_platform/companion/turn/companion_image_ocr_analyze.py), [turn_entry.py](../shared/api/ewa_platform/companion/turn/phases/turn_entry.py), [main_llm_prepare.py](../shared/api/ewa_platform/companion/turn/phases/main_llm_prepare.py).
- Trigger: The Stack4 OCR call raises a caught availability/transport/ordinary error while an attachment is being analyzed.
- Impact: The adapter returns an empty string; the turn resolver emits the same marker as a successful empty OCR result, asserting text was not found. The main prompt can ground a misleading explanation instead of distinguishing unread service failure. This does not prove what a live model would answer.
- Verification: Actual OCR adapter and turn resolver with validated synthetic PNG and a fake gateway RuntimeError returned has_image=true and the text-not-found marker. No OCR HTTP, LLM, database or browser call.
- Separate fix: Carry separate ok-empty/unavailable/error outcomes and use truthful unread prompt/user feedback for failures; cover supported service and unexpected exceptions.

## DOC-CODE-132 — OCR gateway construction failure escapes the fallback boundary

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_image_ocr_analyze.py](../shared/api/ewa_platform/companion/turn/companion_image_ocr_analyze.py), [document_gateway.py](../shared/api/services/stack4/document_gateway.py), [chat_turn.py](../shared/api/ewa_platform/companion/turn/chat_turn.py).
- Trigger: First gateway construction or its settings resolution raises an ordinary RuntimeError before the OCR call.
- Impact: get_stack4_document_gateway executes before the adapter try. The failure propagates through turn resolution; the inner stream early phase catches only ValueError and is outside its later LLM-error catch. An attachment can therefore abort this inner generator without its own error event. Outer terminal-wrapper/server handling is separate and no connection-drop claim is made.
- Verification: Actual adapter/resolver with a fake factory RuntimeError raised. Actual public inner stream with a fake profile and same factory raised with zero events. No real settings service/DB/OCR/network/model; exception injection proves boundary behavior, not a measured deployed factory failure.
- Separate fix: Contain construction/configuration failures at the optional OCR boundary while preserving cancellation and honest unread status; cover cold initialization and channel-specific terminal handling.

## DOC-CODE-133 — public attached image-edit turn bypasses the supporting image tool

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [turn_entry.py](../shared/api/ewa_platform/companion/turn/phases/turn_entry.py), [turn_bootstrap.py](../shared/api/ewa_platform/companion/turn/phases/turn_bootstrap.py), [handlers_media.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_media.py), [task_orchestrator.py](../shared/api/ewa_platform/companion/orchestration/task_orchestrator.py).
- Trigger: A user submits an edit instruction such as убери фон with a current chat image attachment.
- Impact: The direct image handler supports attachment persistence/edit mode, and its missing-source reply asks the user to attach an image. Public sync/SSE bootstrap instead skips all ordinary tool orchestration when has_image_attachment is true, directing that request into OCR/multimodal analysis. The supported handler branch is unreachable through that public attached-turn path; text-only uc-id editing is separate.
- Verification: Actual bootstrap with fake trust/mode/episode/affective/planner collaborators returned orchestrated=None and made zero orchestrator calls for the attached edit. Actual direct handler with fake source storage/PG/capacity/queue accepted the same edit and returned mode=edit. No public HTTP/LLM/content/broker operation; source traces both public entries passing the attachment flag.
- Separate fix: Route explicit attachment edit versus analysis before blanket orchestration skipping, retaining source validation/ownership and confirmation policy; cover complete sync/SSE submission with safe dependencies.

## DOC-CODE-134 — image reaper unwrapping loses nested image-list results

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [image_run_reconcile.py](../shared/api/ewa_platform/companion/jobs/image_run_reconcile.py), [companion_image_generation.py](../shared/api/ewa_platform/companion/orchestration/companion_image_generation.py).
- Trigger: A correlated completed UGS output contains result.images[0].content_id and no flat id/URL.
- Impact: The reconciler unwraps result, then calls helpers that expect images beneath a result wrapper. They miss the bare images list and return no usable artifact; repair is skipped or forced-stale handling can mark failure despite completed output. The normal job accepts that wrapped image-list result.
- Verification: Actual ordinary result helper extracted synthetic-content from the wrapped image-list shape; actual _image_result_from_ugs_output returned None. A flat result.content_id control returned the repaired payload. Pure synthetic structures only, not a live provider response.
- Separate fix: Normalize UGS output once without dropping required structure, and cover wrapped/bare/direct id, URL and image-list shapes in both normal and repair paths.

## DOC-CODE-135 — completed UGS status can complete a companion image run without an artifact

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_image_generation.py](../shared/api/ewa_platform/companion/orchestration/companion_image_generation.py), [readyArtifacts.ts](../shared/web/frontend/src/features/ewa/companionOperations/progressUi/readyArtifacts.ts).
- Trigger: UGS returns status=completed but neither a recognized content id nor image URL.
- Impact: The normal job creates metadata-only result_payload, terminalizes completed and publishes task_completed. The operations ready-image helper requires an artifact projection, so the run can be complete without a usable result. This is a missing defensive output contract, not evidence that a live provider emitted the malformed response.
- Verification: Actual full job with fake UGS/session/PG/lifecycle/events/child helpers received completed/empty result and requested status=completed plus task_completed with no artifact fields. No generation, content write, DB or broker call.
- Separate fix: Require a validated usable artifact before success, report a specific malformed-output failure/degrade state and align normal/reaper/frontend shapes.

## DOC-CODE-136 — image reaper publishes completion despite a guarded run-update miss

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [image_run_reconcile.py](../shared/api/ewa_platform/companion/jobs/image_run_reconcile.py), [companion_task_asyncpg.py](../shared/api/ewa_platform/persistence_pg/companion_task_asyncpg.py).
- Trigger: A repair snapshot is stale and companion_task_run_update returns None, for example because current status is cancelled/completed under its SQL guard.
- Impact: The repair terminalizer ignores that return, publishes task_completed and returns True. Consumers/reaper counts can report a transition not accepted by PostgreSQL. The underlying SQL guard still protects terminal rows; this finding does not claim cancellation was overwritten.
- Verification: Actual repair terminalizer with fake empty steps and a run-update returning None reported True and emitted task_completed. It supplied no expect_revision. Actual SQL source guards completed/cancelled status. No live concurrent cancellation/DB/Redis experiment.
- Separate fix: Require an accepted update before success/events, reconcile step/run ordering and snapshot revision, and test guarded-miss/cancel-race controls without assuming row overwrite.

## DOC-CODE-137 — in-process stalled image retry uses the truncated plan preview

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_image_generation.py](../shared/api/ewa_platform/companion/orchestration/companion_image_generation.py), [enqueue.py](../shared/api/ewa_platform/companion/jobs/enqueue.py).
- Trigger: A compatible datetime-shaped stalled run reaches the in-process kick with nonempty plan.prompt_preview and a longer durable step.input_payload.prompt.
- Impact: The kick chooses the preview first and consults the full step prompt only if that preview is empty. In-process retry can lose important instructions after 240 characters. DOC-CODE-051 currently blocks ordinary ISO-serialized list rows earlier; this is conditional on reaching the retry branch. Celery stripping/reconstruction differs and does not prove the same truncation there.
- Verification: Actual kick with synthetic datetime rows, async disabled, fake no-enqueue and AsyncMock job spawned one retry using 240 of 529 prompt characters and omitted a unique tail. The task was allowed to finish; no real worker/UGS/DB or process loss.
- Separate fix: Prefer the full durable step prompt for retries and use preview only for legacy absence; fix date compatibility separately and cover in-process versus Celery input reconstruction.

## DOC-CODE-138 — image repair omits workflow and agentic parent resumption

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [image_run_reconcile.py](../shared/api/ewa_platform/companion/jobs/image_run_reconcile.py), [companion_image_generation.py](../shared/api/ewa_platform/companion/orchestration/companion_image_generation.py), [dag_async_resume.py](../shared/api/ewa_platform/companion/workflows/dag/dag_async_resume.py).
- Trigger: The image reaper successfully repairs a failed/running child run from completed UGS output while its parent awaits that child.
- Impact: The repair terminalizer updates/publishes but never invokes the workflow/agentic child-resume helpers called by normal job completion/failure. Its successful repair alone can leave parent progression unresolved until another independent reconciliation mechanism acts. No permanent system-wide stall is asserted.
- Verification: Actual terminalizer on a synthetic run with workflow-parent metadata and an accepted mocked completed update returned True with zero calls to the real-owner workflow/agentic helper spies. Full normal/repair source comparison shows the omitted calls. No live graph/agentic worker/DB/broker.
- Separate fix: Reuse an idempotent terminal reconciliation/outbox path for both normal and repair outcomes, preserving cancellation/ownership guards and retrying parent resume after persistence succeeds.

## DOC-CODE-139 — music generation loses the separately resolved catalog identity

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [handlers_media.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_media.py), [companion_music_xl_base.py](../shared/api/ewa_platform/companion/orchestration/companion_music_xl_base.py), [enqueue.py](../shared/api/ewa_platform/companion/jobs/enqueue.py), [step_handlers.py](../shared/api/ewa_platform/companion/jobs/step_handlers.py), [companion_music_pipeline.py](../shared/api/services/companion_music_pipeline.py).
- Trigger: A direct ordinary or XL Base request has different companion principal and resolved main-catalog user ids.
- Impact: In-process calls omit catalog_user_id. Both Celery payloads include it initially but durable step input omits it; enqueue strips domain fields and the worker falls back to principal_id. The pipeline constructs its billing/content User from that fallback. This can fail generation or associate operations with the wrong main-catalog identity; no cross-user exploitation or universal id divergence was tested.
- Verification: Actual ordinary/Base handlers with fake PG/auth/queue/job collaborators emitted no catalog argument for in-process jobs. Actual enqueue with fake token issuance/broker removed the field, and actual music step adapter with fake token consumption passed synthetic-principal instead of synthetic-catalog. Executor input merge was inspected, not run with a broker. No real billing/content/DB operation.
- Separate fix: Persist the resolved authorized catalog identity in durable input and pass it in-process; bind it to worker principal/auth snapshot and test both modes with distinct ids.

## DOC-CODE-140 — XL Base reintroduces condensed old topics into the shared music brief

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_music_xl_base.py](../shared/api/ewa_platform/companion/orchestration/companion_music_xl_base.py), [companion_music_creative_context.py](../shared/api/ewa_platform/companion/orchestration/companion_music_creative_context.py), [chat_condense.py](../shared/api/ewa_platform/companion/memory/chat_condense.py).
- Trigger: An autonomous Base request has learned_preferences.companion_chat_condensed_v1 paragraphs from unrelated earlier topics.
- Impact: The shared music builder explicitly excludes condensed history, but the additional Base builder appends its first 800 characters and usually prepends that brief to the shared result. Old material reaches Base lyrics/style context contrary to the shared exclusion invariant. This is source/context contamination, not evidence of an actual model choosing the old topic.
- Verification: Actual Base handler with a synthetic old-topic marker, fake PG/queue/auth boundaries and otherwise ordinary request retained that marker in durable ewa_companion_context. Shared builder tests confirm exclusion separately; no LLM or memory mutation.
- Separate fix: Use one scoped creative context policy for Base and ordinary music, preserving explicit current/deictic material and testing unrelated condensed-marker absence through the actual handler.

## DOC-CODE-141 — companion production-line validation uses regex flags as a search position

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_music_lyrics_craft.py](../shared/api/ewa_platform/companion/orchestration/companion_music_lyrics_craft.py), [music_generator_lyrics_routes.py](../shared/api/routers/music_generator_lyrics_routes.py).
- Trigger: Otherwise valid companion lyrics contain Arrangement/Voice production parentheticals on their own lines.
- Impact: Compiled patterns have start anchors without multiline mode, and .search(text, re.M) passes pos=8 rather than enabling that mode. The production-lines diagnostic is missed, so its dedicated retry condition does not fire. Later v2 Comfy preparation strips recognized production lines; no audio regression is asserted from this predicate alone.
- Verification: Actual validator returned an empty error list for synthetic valid eight-line lyrics plus Arrangement/Voice lines. Source confirms compiled-pattern call/flags; pure local strings, no provider.
- Separate fix: Compile with multiline flags or inspect individual lines; cover start/middle/end production lines and preserve later preparation as a separate boundary.

## DOC-CODE-142 — companion missing-yo heuristic rejects grammatically valid plural vse

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [companion_music_lyrics_craft.py](../shared/api/ewa_platform/companion/orchestration/companion_music_lyrics_craft.py), [music_generator_lyrics_routes.py](../shared/api/routers/music_generator_lyrics_routes.py).
- Trigger: A valid Russian lyric uses plural Все, such as Все птицы летят к морю.
- Impact: The heuristic treats every standalone все as the singular всё and reports companion_lyrics_missing_yo. The lyrics route can unnecessarily regenerate valid text and encourage a grammatically wrong correction. Not every use of все should gain ё; no generated model rewrite was measured.
- Verification: Actual validator on an otherwise valid two-section/eight-line lyric returned only companion_lyrics_missing_yo for the plural line. Pure source function/string probe.
- Separate fix: Remove the ambiguous unconditional rule or use a context-aware advisory without forced correction; add plural/singular controls.

## DOC-CODE-143 — music cancellation events report failed and lose the XL Base intent

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [music_run_reconcile.py](../shared/api/ewa_platform/companion/jobs/music_run_reconcile.py), [music_pipeline_progress.py](../shared/api/ewa_platform/companion/jobs/music_pipeline_progress.py).
- Trigger: An eligible Base music run is terminalized cancelled after a correlated UGS cancellation or user cancel.
- Impact: Persistence requests cancelled, but the terminalizer invokes the generic task_failed publisher, which hardcodes status=failed and intent_kind=music_generation_background. Event consumers can see a failed ordinary-music run while PG holds a cancelled Base run, until authoritative refresh reconciles it. PG cancellation is not claimed overwritten.
- Verification: Actual reconciler with an accepted fake terminal write and local event spy emitted task_failed/failed/ordinary intent for synthetic cancelled Base input. No real PG/Redis or client reconciliation experiment.
- Separate fix: Publish the accepted terminal status and actual intent consistently, retaining cancellation reason and covering SSE/poll convergence for both music modes.

## DOC-CODE-144 — music repair omits the normal workflow and agentic resume path

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [music_run_reconcile.py](../shared/api/ewa_platform/companion/jobs/music_run_reconcile.py), [handlers_media.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_media.py), [dag_async_resume.py](../shared/api/ewa_platform/companion/workflows/dag/dag_async_resume.py).
- Trigger: A pending/running parent-linked music child is successfully repaired from correlated completed UGS output.
- Impact: Repair updates steps/run and publishes completion but never invokes the normal DAG/action/agentic child helpers. Its successful repair alone can leave parent progression pending until another independent reconciler acts; no permanent system-wide stall is asserted.
- Verification: Actual music repair accepted a synthetic completed result.audio content id and made zero calls to patched workflow/agentic helper owners. Source comparison with the full normal job shows the omitted calls. Fake PG/events only; no live graph/worker.
- Separate fix: Share an idempotent post-terminal reconciliation/outbox path and retry parent advancement after accepted persistence for normal and repaired outcomes.

## DOC-CODE-145 — forced stale music failure can abandon a still-processing UGS request

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [music_run_reconcile.py](../shared/api/ewa_platform/companion/jobs/music_run_reconcile.py), [handlers_media.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_media.py), [run_lifecycle.py](../shared/api/ewa_platform/companion/orchestration/run_lifecycle.py).
- Trigger: An async music row exceeds its updated_at horizon while its correlated UGS request still reports processing.
- Impact: Forced-stale reconcile marks companion failed without cancelling UGS. Normal stage progress is SSE-only and does not refresh that run timestamp; later normal completion sees failed as non-executable. Provider work can continue while companion reports failure and does not accept its result. Actual deployed durations/billing/refund effects were not measured.
- Verification: Actual force_stale reconciler with synthetic processing UGS and accepted fake lifecycle write returned True, published failed and made zero UGS-cancel calls. Actual lifecycle source excludes failed runs, and job completion uses that guard. No elapsed-time/live worker/provider experiment.
- Separate fix: Define heartbeat/deadline/cancellation reconciliation consistently: retain valid active work or coordinate abort/refund and eventual artifact recovery rather than abandoning one side of the correlated state.

## DOC-CODE-146 — standalone music autoplay request never becomes the client playback command

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [handlers_media.py](../shared/api/ewa_platform/companion/orchestration/tools/handlers_media.py), [companion_music_xl_base.py](../shared/api/ewa_platform/companion/orchestration/companion_music_xl_base.py), [musicPipelineProgress.ts](../shared/web/frontend/src/features/ewa/companionOperations/progressUi/musicPipelineProgress.ts), [useCompanionOperationsRuntime.ts](../shared/web/frontend/src/features/ewa/companionOperations/useCompanionOperationsRuntime.ts).
- Trigger: A standalone ordinary/Base generation requests autoplay and completes outside the specialized music_full_cycle_v1 workflow.
- Impact: The normal result records autoplay_requested but lacks background_play, which the operations client requires to dispatch an automatic music_play_track action. The Base launch reply promises playback; the stored request alone does not fulfill it. Manual Play and the separate specialized workflow command remain possible; browser playback policies are not implicated by this missing field.
- Verification: Actual full music job with fake pipeline/PG/events/parent helpers persisted autoplay_requested=true without background_play. Actual frontend projection loaded through esbuild returned null for that result, while adding background_play=true produced the expected synthetic action. No browser/audio/network operation.
- Separate fix: Define one authorized completion-to-play command contract for standalone and workflow results, with idempotent client dispatch and explicit user playback intent.

## DOC-CODE-147 — music full-cycle queue strips fields absent from its durable step

- Recorded: 2026-10-11. Status: open; source and bounded isolated evidence.
- Evidence: [starter.py](../shared/api/ewa_platform/companion/workflows/action/starter.py), [enqueue.py](../shared/api/ewa_platform/companion/jobs/enqueue.py), [executor.py](../shared/api/ewa_platform/companion/jobs/executor.py), [step_handlers.py](../shared/api/ewa_platform/companion/jobs/step_handlers.py).
- Trigger: The specialized music_full_cycle_v1 starter resolves style/vocal/extended brief and launches Celery.
- Impact: Its domain queue payload contains those fields, but the durable generation step stores only step_key/tool_name/theme_preview. Transport stripping removes the domain payload, and worker reconstruction defaults style/vocal/context. Deictic source material and other resolved settings can disappear before lyrics generation. Direct tool steps store a fuller payload; this finding is specific to the pilot starter.
- Verification: Actual specialized starter with a fake resolver yielding rock/male/KEEP_CONTEXT_SYNTHETIC and fake PG/queue captured those original fields. Actual enqueue with fake token/broker and actual step adapter with fake consume/job yielded pop/female/empty context. The ordinary shared resolver is separately source-reviewed; no provider/broker/DB operation.
- Separate fix: Use one complete safe durable music input constructor across direct/Base/pilot starters; cover enqueue stripping and executor reconstruction rather than inspecting only original queue kwargs.
