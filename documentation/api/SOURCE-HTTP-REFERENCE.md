# HTTP contracts traced to source

Reference · inspected source dated 2026-10-11. This guide distinguishes route declarations, registration, checked-in OpenAPI pilots and live API behavior. Requests below are examples for a separately prepared development instance; the audit did not send them to production.

## Finding an endpoint

1. Look up method/path in [the registered-route catalog](REGISTERED-ROUTES.md). It traces main API and KBSEW composition without importing the applications.
2. Open the linked handler and inspect its dependencies, request annotation, response model and explicit status handling. [SOURCE-CONTRACT-INVENTORY.json](SOURCE-CONTRACT-INVENTORY.json) indexes those declarations, parameter/default expressions, directly raised HTTP statuses, Pydantic class fields and environment names.
3. Inspect the corresponding schema, including inheritance, `Field` constraints and validators. The static class inventory does not expand them or generate JSON Schema.
4. Check the consumer's typed contract and current OpenAPI. [Pilots](../../shared/web/frontend/openapi/pilot/) are selected snapshots; their existence does not prove freshness or complete API coverage.

The [registration snapshot](REGISTERED-ROUTES.snapshot.json) includes canonical/legacy aliases and duplicate declarations. It is not a runtime OpenAPI export and does not evaluate authorization, feature flags, deployment revision, middleware rewrites or response serialization. Host-based Site Studio and worker sidecars are separate surfaces described below.

## Main application: discovery and health

The [bootstrap](../../shared/api/main.py) sets Swagger UI at `/api/docs`, ReDoc at `/api/redoc`, and leaves the FastAPI default OpenAPI path `/openapi.json`. Whether those URLs are exposed by ingress is deployment-dependent. Export tooling is [export_openapi_docker.sh](../../shared/api/scripts/export_openapi_docker.sh); it imports code in a selected container, writes an export and can use SSH, so it was not run during the documentation-only audit.

Public middleware exemptions and health detail policy are implemented in [OAuth2 middleware](../../shared/api/middleware/oauth2_protection.py) and [api_health_public](../../shared/api/monitoring/api_health_public.py).

| Method / path | Request and response contract | Source |
|---|---|---|
| `GET /api/v1/ping` | No request body; returns `status: "ok"`, `timestamp` | [main.py](../../shared/api/main.py) |
| `GET /api/health` | Public view: `{"ok": boolean}`; authorized admin gets detailed infrastructure/EWA/beat state | [main.py](../../shared/api/main.py), [health policy](../../shared/api/monitoring/api_health_public.py) |
| `GET /api/v1/health` | Same health payload policy | [main.py](../../shared/api/main.py) |
| `GET /api/v1/system-info` | Same health payload policy | [main.py](../../shared/api/main.py) |
| `GET /api/version` | `version`, `buildHash`, `appBuildId`; registration selects the version router before the bootstrap duplicate | [version.py](../../shared/api/routers/version.py) |
| `GET /metrics` | Prometheus text exposition | [main.py](../../shared/api/main.py) |
| `GET /api/v1/desktop/install-profile` | Authenticated profile snapshot; schema version 3, edition/profile/access fields, component list and optional AI-provider state | [desktop_install_profile.py](../../shared/api/routers/desktop_install_profile.py) |

Example read-only development probes:

```bash
curl -fsS http://127.0.0.1:8000/api/v1/ping
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  http://127.0.0.1:8000/api/v1/desktop/install-profile
```

Supply `ACCESS_TOKEN` privately through the normal development OIDC flow. Profile responses are user/client/config dependent: FoFline OAuth clients can get `fofline-connected` on a cloud-full instance. An edition/profile mismatch yields 503. A profile response filters available components; it does not grant resource access.

## Authentication and error formats

The shared API uses [auth_provider_service](../../shared/api/services/auth_provider_service.py), whose implemented adapter is Keycloak. Names `oidc_generic` or an arbitrary provider do not make an implementation available. Keycloak client/audience details are owned by [the identity runbook](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md).

Most protected HTTP paths use a Bearer token and router dependencies. Some routes instead validate tickets, native device proofs, operator tokens or iframe cookies. A middleware public-path exception means route-level validation is responsible; it does not mean anonymous access is permitted.

[auth_errors.py](../../shared/api/core/auth_errors.py) constructs bodies such as:

```json
{"error":"unauthorized","reason":"token_missing","action":"login"}
```

Reasons include `token_expired`, `invalid_token`, `forbidden`, `authentication_failed`, `session_replaced`, `session_replace_confirmation_required` and `sso_registry_unavailable`. Actions include `login`, `refresh` and `retry`. Do not map every 403 to reauthentication: selected resource/business-rule errors remain `{"error":"forbidden","detail":...}`. Session-registry unavailability can fail closed with 503.

The shared [global handlers](../../shared/api/main.py) return 422 validation bodies with `error`, `detail`, `details`, `timestamp`; 503 for classified infrastructure/schema failures; and a general 500 handler. Domain handlers/middleware can construct more specific responses. Read the actual handler before assuming a universal envelope. KBSEW and the public Next.js site do not use this global handler.

## EWA desktop orchestration

The source-checked [desktop orchestration reference](../../shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md) documents the POST envelope, minimum observation fields, response/journal, persistence modes, authorization limits and SSE query/stream behavior. Its `follow=true` stream emits keep-alives after an initial snapshot; it does not poll new events. The real HTTP driver supports shell/config patches only.

Isolated in-memory ASGI verification found missing session principal isolation and unsupported-version acceptance. These are recorded in the [append-only issue log](../../docs/CODE_ISSUES.md); application code remains unchanged.

Bounded companion references cover [profile and anchor operations](../product/ewa/EWA-COMPANION-PROFILE-ADR.md), [story/forget and memory](../product/ewa/EWA-COMPANION-HCM-MEMORY.md), [admin settings](../product/ewa/EWA-PLATFORM-SETTINGS-DB.md), [admin workflow catalog/editor](../product/ewa/EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md), [45 prompt blocks and their three admin routes](../product/ewa/EWA-COMPANION-PROMPT-BLOCKS.md), [message/stream contracts](../product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md), [task-run list/detail/confirm/cancel and lifecycle SSE](../product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md), [observer tick](../product/ewa/EWA-COMPANION-PROACTIVE-OBSERVER.md) and [proactive output protocol](../product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md). The [282-key snapshot](EWA-PLATFORM-SETTINGS.snapshot.json) records source metadata only. Remaining tool, personal/DAG workflow and agentic HTTP/business contracts still require detailed review; the chat references do not accept those subsystems by association.

## KBSEW service contract

[KBSEW main](../../KBSEW/api/main.py) mounts its routers directly. Management/search paths begin `/api/v1/kbsew`; process probes are `/health`, `/ready` and `/metrics` on the service itself. The shared API exposes [a gateway](../../shared/api/routers/kbsew_gateway.py); its auth and transport errors must be inspected separately from direct service calls.

[SearchRequest](../../KBSEW/api/schemas/search.py) requires `query` (1–4000 characters) and `barrel_id` (UUID). Optional `limit` is 1–20; optional `retrieval_mode` is `dense` or `hybrid`. [SearchResponse](../../KBSEW/api/schemas/search.py) returns `barrel_id` and `chunks: string[]`. Hybrid settings/fallbacks live in the search service; the request option alone does not guarantee a sparse index exists.

Example request body; the UUID is illustrative and must be replaced with an existing enabled barrel id:

```json
{"query":"How does the desktop boot?","barrel_id":"11111111-1111-4111-8111-111111111111","limit":5,"retrieval_mode":"dense"}
```

[Authentication](../../KBSEW/api/core/auth.py) accepts admin JWTs and, for selected read/search operations, `X-KBSEW-Service-Token`. Service identity is `kbsew_service`, not admin. `KBSEW_SERVICE_CAN_MUTATE=true` allows the service token on mutation routes using `require_admin_or_service_mutate`, including barrel deletion and reindex where that dependency is bound. The default requires admin JWT. Inspect each route's dependency; the flag does not change the service principal into an admin role.

Ingestion creation/upload responses use [IngestResponse](../../KBSEW/api/schemas/barrels.py): `job_id`, `asset_id`, `status`, optional `message`. HTTP handlers queue durable work; completion must be checked through barrel status/job records. Reindex routes report queued/skipped/failed results. Search maps missing barrel to 404, disabled/stale index to 409, invalid input to 400, embedding failure to 503 and other vector-search failure to 502; body validation can return 422.

## Other HTTP surfaces

- **Site Studio host gateway:** [site_studio_public.py](../../shared/api/routers/site_studio_public.py) exposes `/` for GET/HEAD/OPTIONS and `/{path:path}` for GET/HEAD/OPTIONS/POST/PUT/PATCH/DELETE on a [Host route](../../shared/api/domains/site_studio_public.py). It is not a path-prefixed router mounted under `/api/v1`; URL/host resolution and blocked paths determine forwarding.
- **Rendering sidecar:** [render_sidecar_app.py](../../shared/api/services/rendering/render_sidecar_app.py) has `GET /health` and `POST /v1/render/html-slides`; its request/response types are in [browser_render_contracts.py](../../shared/api/services/rendering/browser_render_contracts.py). Paths are restricted to the generated-files root. Errors include 400/404/503/500.
- **Science sidecar:** [science_sidecar_app.py](../../shared/api/services/science_stack/science_sidecar_app.py) has `GET /health`, `POST /v1/science/semantic-analyze`, and `POST /v1/science/merge-wav-chunks`; types live in [science_contracts.py](../../shared/api/services/science_stack/science_contracts.py). Startup is conditional in [queue-worker startup](../../docker/builders/stack0-api/scripts/start_queue_worker.sh).
- **Public landing:** [Next.js lead route](../../shared/web/site_prod/src/app/api/lead/route.ts) is `POST /api/lead`, with its own Zod schema/error envelope and local JSONL/webhook persistence. See [site README](../../shared/web/site_prod/README.md).
- **Olenti:** [Express entry](../../site-templates/olenti/server/src/index.ts) mounts separate `/api/*` routes with JWT/cookie auth and Prisma data. See [template README](../../site-templates/olenti/README.md); its API is not part of the FastAPI catalog.

Socket.IO uses `/socket.io` with its handshake/event authorization. Native WebSocket and SSE endpoints have independent contracts. The [registered catalog](REGISTERED-ROUTES.md) includes Python WebSocket decorators; it does not enumerate Socket.IO event semantics. See [realtime canon](../platform/REALTIME-SOCKETIO-AND-WS.md).

## Compatibility and remaining verification

[register_router_v1_and_legacy](../../shared/api/utils/router_registration.py) adds `/api/v1` and `/api` mounts to selected routers. Other routers already carry full prefixes. Do not mechanically prepend `/api/v1` to every decorator. `/api/profile/me` and `/api/version` each have overlapping declarations; registration order and middleware matter. The static catalog retains both rather than hiding the conflict.

All examples above were checked against handler/schema source. Live OIDC/ACL checks, request/response execution, OpenAPI export freshness and infrastructure error simulations remain unverified. Current work status is recorded in [progress](../../docs/DOCUMENTATION_PROGRESS.md).
