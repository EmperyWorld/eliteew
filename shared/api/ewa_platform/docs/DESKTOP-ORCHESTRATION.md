# EWA desktop orchestration HTTP contract

Reference · source review dated 2026-10-11. This is the observation-to-intent boundary under `/api/v1/ewa/desktop-orchestration`, separate from companion chat tools and marketing AMKA. It describes the implemented route/runtime/store behavior, not production acceptance.

## Entry points and authorization

[The shared EWA facade](../gateways/companion_http.py) mounts [desktop.py](../gateways/routers/desktop.py). Both routes depend on `require_oauth2_user`:

- `POST /api/v1/ewa/desktop-orchestration/turn`: raw JSON object body; response [EwaDesktopOrchestrationTurnResponse](../schemas/pydantic/desktop.py).
- `GET /api/v1/ewa/desktop-orchestration/sessions/{session_id}/events`: required path string `session_id`, optional query boolean `follow` (default false); response `text/event-stream`.

Authentication is present, but **session ownership is not enforced** by this implementation. Turn/store keys and SSE lookups use caller-supplied session ids without principal isolation. Cross-principal read/append was reproduced in isolated shared-memory ASGI (DOC-CODE-009 in [the issue log](../../../../docs/CODE_ISSUES.md)); PG ownership absence was inspected statically. Do not describe these journals as private per-user storage or treat knowledge of an id as authorization.

## Turn request

[The mapper](../io/envelope.py) builds `EwaRequestV1`. Clients should send version `1` and message type `signal`, as [the request helper](../gateways/desktop_http.py) does:

```json
{
  "api_version":"1",
  "message_type":"signal",
  "correlation_id":"example-correlation",
  "auth_context_ref":null,
  "payload":{
    "kind":"ewa_desktop_orchestration_v1",
    "session_id":"example-session",
    "observation":{"observation_kind":"user_cancelled","reason":"user stopped"}
  }
}
```

These are synthetic identifiers, not reusable authorization credentials. `auth_context_ref` does not replace the authenticated user. `schema_ref` is optional. The mapper requires nonempty string `api_version`, a string message type and object payload; it stringifies `correlation_id` rather than validating a UUID or nonempty string. Unknown message types remain strings. It does not reject unsupported major versions (DOC-CODE-010).

[The runtime](../desktop/runtime.py) checks payload kind, nonblank string session id, observation object and [minimum observation shape](OBSERVATION-CATALOG.md). It strips surrounding session-id whitespace. Invalid mapper/payload/observation inputs raise HTTP 400. Malformed JSON/body shape can be rejected by FastAPI before this handler; authentication failures come from the shared dependency. A companion profile is optional for this route, so its absence is reported in persistence metadata rather than a profile-not-found error.

Optional `payload.metadata.companion` hints are normalized by [desktop_orchestration_payload.py](../io/desktop_orchestration_payload.py), with [their schema](../schemas/json/desktop_orchestration_companion_metadata_v1.json). Supported hints include seed persona and expected companion revision. Bad hint shapes do not fail the turn: they produce `hints_warnings`. Client hints do not grant permission or select an arbitrary user's profile.

## Turn response and journal

A successful handler returns version `1`, `message_type: result`, the mapped correlation id, `run_id: null`, `schema_ref: null` and payload:

- `kind: ewa_desktop_orchestration_result_v1`;
- `session_id`: normalized id;
- `events`: the complete stored journal for that id, not just this turn's new events;
- `session`: saved snapshot with `turns`, `last_observation_kind`, `last_branch`, and when an intent was attempted, `last_intent_kind`;
- `persistence`: store classification and companion metadata.

[The turn flow](POLICY-LLM-MATRIX.md) appends observation, optional companion/hint events, then policy-denied or intent-result events as applicable. `last_branch` is `no_intent`, `policy_denied` or `intent_executed`. The last value means the driver returned; inspect `intent_result.result.ok` for success. Old `last_intent_kind` can remain in a later no-intent/denied snapshot because the implementation does not clear it.

The response model treats `payload` as an arbitrary object; it does not independently validate every event/result variant. The complete turn is not a single transaction: earlier event appends may survive a model/driver exception.

## Persistence and companion context

[Runtime composition](../desktop/runtime.py) selects:

- `asyncpg`: `app.state.ewa_orchestration_pool` exists. [PG stores](../persistence_pg/orchestration_asyncpg.py) persist session snapshots and journal rows across requests. Each event append locks a session row to allocate a sequence; session read/turn/save as a whole is not locked atomically.
- `shared_memory`: one `app.state.ewa_orchestration_memory_stores` instance is supplied. POST and later SSE share it within this process; restart/another process loses or separates it.
- `ephemeral_memory`: neither store exists. Each request constructs a new memory store; later SSE does not see the POST journal.

`persisted_across_requests` is true for the first two, false for ephemeral memory. It is not a guarantee of process durability for memory. [desktop/pool.py](../desktop/pool.py) opens the optional `EWA_DATABASE_URL` pool and invokes [data-plane initialization](../bootstrap/data_plane.py). Schema/deployment recovery remains owned by [the migration guide](../migrations/README.md) and [EWA PostgreSQL runbook](../../../../documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md); no database was accessed in this review.

`persistence.companion` includes `loaded`, or reason `no_database_pool`/`not_initialized`; loaded profiles add `companion_revision` and `seed_persona_id`. It includes normalized `client` hints, optional warnings and expected-revision comparison. The row is fetched for the authenticated principal. [companion_profile_llm_wire](../persistence_pg/companion_asyncpg.py) supplies truncated profile context to the model. The `companion_context` journal event excludes free profile text, but the journal's other observations/hints can contain client-provided metadata.

## SSE behavior

[iter_desktop_orchestration_session_sse](../desktop/runtime.py) reads the journal **once**, sends each event as `data: <JSON>` followed by a blank line, then emits `: keep-alive`. It does not emit an `EwaEventV1` wrapper around each journal mapping and does not provide SSE `id`/`event` fields.

With `follow=false` it completes after that snapshot. With `follow=true` it emits periodic keep-alive comments only; it does not poll or push newly appended events. `EWA_ORCH_SSE_KEEPALIVE_SEC` defaults to 2, invalid numeric text falls back to 2 and values below 0.5 are clamped. A nonexistent id yields an empty snapshot/keep-alive rather than a session 404. Reconnecting reads the full snapshot; no route-level cursor/Last-Event-ID filtering is implemented.

## Drivers and configuration

The default driver is a fake. `EWA_ORCH_USE_ELITEEW_HTTP` plus an incoming bearer selects [the real HTTP adapter](../adapters/eliteew_desktop_http.py), which supports shell/config patches only. `open_app`, focus, close and deep-link kinds return an unsupported result from this adapter; companion chat's window actions have a separate [SPA channel](EWA-APP-DRIVER-CATALOG.md).

`EWA_DESKTOP_ORCH_APP_ALLOWLIST` is the CSV gate for `open_app`. [Policy](../policy/engine.py) also permits structural focus/close/shell/config patches and gates navigation by `orchestration_deep_link`. Runtime maps role names from the user's single role field. A persona cannot override policy.

`EWA_ORCH_USE_HTTP_LLM` selects [HTTP intent proposals](../llm/http_orch_llm.py); `EWA_ORCH_LLM_MODEL` overrides the model. Default LLM is a stub. It is called even for cancellation, and a valid model intent can override the no-intent heuristic. `EWA_ORCH_LLM_CONTEXT_LOG` logs context sizes; `EWA_ORCH_LLM_SLIM_OBSERVATION_WINDOWS`/`EWA_ORCH_LLM_SLIM_DOMAIN_HINTS_UTF8` enable bounded slimming. Tool sketches in the prompt do not invoke tools automatically. The serialized sketch is sliced by character positions; byte telemetry is separate.

Hint ports are enabled by `EWA_ORCH_ATTACH_UGS_HTTP`, `EWA_ORCH_ATTACH_DOCUMENTS_SHELL_HINT`, `EWA_ORCH_ATTACH_CONTENT_SHELL_HINT` with bearer. `EWA_ORCH_UGS_PROFILE` chooses the UGS summary. Self-HTTP uses `eliteew_self_http_base_url` (override `ELITEEW_SELF_HTTP_BASE_URL`), ordinarily loopback/API_PORT. Optional hints degrade on errors and are collected concurrently; documents/content share one per-turn GET cache.

Logs include `ewa_desktop_orch_timing`, `desktop_orchestration_turn_done` and `companion_profile_loaded` (revision only). They are source telemetry definitions, not observed production logs.

## Persisted shell hints and client integration

[ewa_shell_hints_wire.py](../contracts/ewa_shell_hints_wire.py) recognizes `shell_state.ewa_hints` with optional `documents_workspace`/`content_manager` objects. Wrong subtree/nested types skip explicit hints and use shell-window/content-shortcut fallback. [Domain normalizers/schema](../contracts/domain_hints_wire.py) bound the driver-facing values. These hints are read-only metadata, not document mutation authorization.

[The SPA persistence hook](../../../web/frontend/src/pages/Desktop/hooks/useDesktopShellWindowPersistence.ts) adds hints alongside windows only after the shell-state cache is hydrated. [ewaShellHintsDerive.ts](../../../web/frontend/src/features/ewa/ewaShellHintsDerive.ts) always regenerates document tabs from `DocEditor` windows, auto-syncs ContentManager project roots, preserves non-auto content hints and removes a stale auto content subtree when projects disappear.

```json
{"ewa_hints":{"documents_workspace":{"open_document_count":1,"items":[{"doc_id":"example-document"}]},"content_manager":{"roots":["example-project"]}}}
```

The legacy `amka_platform_hints` key is not automatically read as `ewa_hints`. If historical persisted values exist, inspect the actual schema/rows and use the database operator's backed-up migration process; the audit does not provide or execute an unconditional mass UPDATE.

The typed [SPA orchestration client](../../../web/frontend/src/services/ewa/ewaDesktopOrchApi.ts), [shell observations](../../../web/frontend/src/features/ewa/amkaShellObservations.ts) and [useAmka hook module](../../../web/frontend/src/hooks/api/useAmka.ts) retain some historical names. The routes remain EWA.

## Related boundaries and verification

Companion profile/quick actions/chat, runtime context/command/turn, workflows and agentic sessions are separate routers in [the gateway facade](../gateways/companion_http.py). Their detailed fields/auth/errors belong to their own references, including [profile](../../../../documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md), [file catalog](../../../../documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md), [tool router](../../../../documentation/product/ewa/EWA-COMPANION-TOOL-ROUTER.md) and [chat phases](../../../../documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md). Those links are navigation, not acceptance of every linked claim in this iteration.

There is no full desktop-turn dry-run route/flag here. [state_machine.simulate](../core/state_machine.py) validates a limited companion action list without persistence; it is a different boundary. The bounded fake/wiring suite passed 26 tests; synchronous HTTP TestClient tests stalled and were interrupted. Isolated no-network ASGI checks reproduced session/version defects; production, PG and browser behavior were not tested.

Related: [intent catalog](INTENT-CATALOG.md), [observations](OBSERVATION-CATALOG.md), [model/policy flow](POLICY-LLM-MATRIX.md), [driver boundaries](DRIVERS-ROADMAP.md), [module entry](../README.md).
