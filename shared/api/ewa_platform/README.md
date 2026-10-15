# EWA platform implementation

Explanation · source inspection dated 2026-10-11. EWA is the companion, orchestration and agentic platform inside the shared API. Its HTTP/SSE surface is mounted under `/api/v1/ewa` by [the gateway facade](gateways/companion_http.py). Marketing AMKA is a separate domain; see [taxonomy](../../../documentation/product/ewa/EWA-VS-AMKA-TAXONOMY.md).

## Entry points and data boundary

[API domain registration](../domains/bi_ugs.py) calls `include_ewa_routers`; individual EWA routers live under [gateways/routers](gateways/routers/). [desktop/pool.py](desktop/pool.py) owns the optional `EWA_DATABASE_URL` pool and calls [bootstrap/data_plane.py](bootstrap/data_plane.py). The code includes PostgreSQL persistence; this is no longer merely a persistence scaffold. An unset DSN disables that pool and does not guarantee durable behavior for all companion operations.

[Workers](workers/README.md) contain the EWA Celery tasks; the shared [Celery application](../tasks/celery_app.py) owns scheduling and worker lifecycle. Web startup and Celery startup have different resource lifetimes.

## Layers

- [contracts](contracts/), [schemas](schemas/), [io](io/): envelope/domain contracts, Pydantic API types and external JSON schemas. JSON schemas are under `schemas/json`, not the schemas root.
- [core](core/), [drivers](drivers/), [policy](policy/), [runtime](runtime/): orchestration, domain-driver interfaces, intent policy and execution/session primitives.
- [companion](companion/), [agentic](agentic/): companion turn/context/persona/memory/actions/plans and agentic runtime modules. Consult the actual subpackages before adding functionality; older lists of companion folders are not exhaustive.
- [desktop](desktop/), [gateways](gateways/), [bootstrap](bootstrap/): composition, HTTP/SSE/runtime boundaries and data-plane initialization.
- [persistence](persistence/), [persistence_pg](persistence_pg/), [persistence_vector](persistence_vector/): persistence ports and concrete PostgreSQL/vector implementations. [TABLES.md](persistence_pg/TABLES.md) maps database objects.
- [adapters](adapters/README.md), [llm](llm/), [media](media/): external service bridges, model/tool boundaries and media contracts.
- [atoms](atoms/), [factory](factory/), [capacity](capacity/), [settings](settings/): atom processing, factory/capacity helpers and platform settings.
- [testing](testing/), [migrations](migrations/README.md), [docs](docs/): fakes/contract helpers, the EWA SQL track and module-level references.

Layer dependency rules and envelope versioning remain owned by [GOALS-AND-NORMS.md](GOALS-AND-NORMS.md). EWA must not import `api.services.amka_core` as its runtime implementation. Contract field compatibility must be assessed against consumers, rather than inferred from a folder name.

## Development and verification

Use the repository-root Python environment and `PYTHONPATH=shared`; see [developer setup](../../../documentation/platform/DEVELOPER-SETUP.md). EWA tests are part of the shared API test tree. SQL application changes a real database and is an operator operation, not a documentation check. [EWA PostgreSQL operations](../../../documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md) own prerequisites and recovery.

## Related references

- [EWA product/technical hub](../../../documentation/product/ewa/README.md)
- [Desktop orchestration](docs/DESKTOP-ORCHESTRATION.md), [intent catalog](docs/INTENT-CATALOG.md), [observation catalog](docs/OBSERVATION-CATALOG.md)
- [Driver/action catalog](docs/EWA-APP-DRIVER-CATALOG.md), [driver implementation boundaries](docs/DRIVERS-ROADMAP.md), [extension/test order](docs/FILL-ORDER.md)
- [Append-only code findings](../../../docs/CODE_ISSUES.md) — current desktop session-isolation, envelope-version and serializer/schema gaps; no application fixes in this documentation task
- [Persona vision](../../../documentation/product/ewa/EWA-COMPANION-PERSONA-VISION.md) — product direction, not proof of implementation
