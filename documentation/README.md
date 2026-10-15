# EliteEW documentation

The canonical documentation root for this monorepository is `documentation/{product,platform,api,database,reference}`. Product source lives in `shared/` and the cloud/organization entrance packs. English is the repository standard for authored technical canon; existing localized user material retains its language.

## Start here

- [Developer setup](platform/DEVELOPER-SETUP.md): requirements, dependency/workdir boundaries, local commands and known startup limitations.
- [Architecture from source](platform/ARCHITECTURE-CODE-MAP.md): components, data flows, identity, storage, errors and workers.
- [Source module map](reference/SOURCE-MODULE-MAP.md): significant source roots/domains and their documentation owners.
- [HTTP reference](api/SOURCE-HTTP-REFERENCE.md), [registered route catalog](api/REGISTERED-ROUTES.md) and [API composition](api/API-ENTRY-POINTS-AND-DOMAINS.md): declared contracts, mount prefixes and verification limits.
- [Infrastructure source guide](platform/INFRASTRUCTURE-SOURCE-GUIDE.md): environment layers, containers, builds, CI and operator boundaries.
- [Database hub](database/README.md): separate data lifecycles and migration runners.

[INDEX](INDEX.md) retains the detailed topic navigation; [handbook map](reference/HANDBOOK-MAP.md) maps roles to existing references. [Glossary](reference/PROJECT-GLOSSARY.md) explains project terminology. [Writing guide](reference/DOCUMENTATION-WRITING-GUIDE.md) defines placement, links, audience and maintenance.

## Canonical sections

- [Product](product/README.md): user workflows, desktop/apps, EWA, mobile, marketing and professional domains.
- [Platform](platform/README.md): runtime, identity, build/deploy, monitoring and operator procedures.
- [API](api/README.md): HTTP/OpenAPI, frontend/backend contracts and integration references.
- [Database](database/README.md): schema ownership, integrity, migrations and recovery pointers.
- [Reference](reference/README.md): source/document maps, terminology and author guidance.

[Plans](plans/README.md) are operator-local process material, mostly ignored, rather than living technical canon. [Worklog](worklog/README.md) is a retired stub. Retired trees under `trash/` are not current product source and must not be treated as a second supported platform.

## Operational sources of truth

[Production topology](platform/PRODUCTION-TOPOLOGY-STATE.md) owns host/stack placement; hubs link to it instead of repeating topology tables. [Technical passport](platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md) and [system blueprint](project_master_card.md) provide broader existing context. [Editions](platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) and [pack layout](platform/ELITEEW-PACK-LAYOUT.md) define delivery/app ownership.

Use the [Config Plane](platform/PROD-CORE-CONFIG-PLANE.md), [dual-line deployment](platform/PROD-CORE-DEV-BIND-LINE.md), [operator CLI map](../docker/scripts/README.md), [release checklist](platform/ELITEEW-RELEASE-CHECKLIST.md) and [testing strategy](platform/TESTING-STRATEGY.md) for an authorized operational task. Podman is the default operator runtime; historical `docker/` paths do not require Docker Engine universally.

Frontend details begin at [developer entry](product/FRONTEND-DEVELOPER-ENTRY.md); Android at [its README](../pack-cloud/mobile/README.md); native client at [Connection Agent](../pack-organization/connection-agent/README.md); AI at [EWA hub](product/ewa/README.md); ingestion at [KBSEW](../KBSEW/README.md). The UI product called Assistant is described in [Assistant handbook](product/PRODUCT-ASSISTANT-HANDBOOK.md) and [Spravochnik](product/SPRAVOCHNIK-AI.md), distinct from this documentation directory.

## Audit coverage

The repository-wide documentation audit is **in progress**. [Progress](../docs/DOCUMENTATION_PROGRESS.md), [audit report](reference/DOCUMENTATION-AUDIT-REPORT.md) and [machine-readable inventory](reference/DOCUMENTATION-INVENTORY.json) distinguish source-reviewed entry guides from semantic review still pending. A path check, source declaration index or historical acceptance statement is not proof of live behavior. No deployment or code/configuration change was performed.

New technical references belong in the canonical sections and must be linked from INDEX. The root `docs/DOCUMENTATION_PROGRESS.md` is the operator's explicitly requested audit record, not a replacement documentation root.
