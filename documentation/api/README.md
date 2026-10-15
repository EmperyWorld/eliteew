# API documentation

Reference hub for the shared [FastAPI application](../../shared/api/) and its consumers. [KBSEW](../../KBSEW/README.md), [Olenti](../../site-templates/olenti/docs/ADMIN_API_CONTRACT.md), sidecars and the [public Next.js site](../../shared/web/site_prod/README.md) have separate HTTP surfaces.

## Source-backed discovery

- [HTTP reference](SOURCE-HTTP-REFERENCE.md): auth/error conventions, probes, examples and separate services.
- [Registered routes](REGISTERED-ROUTES.md): 1,853 main-API and 14 KBSEW static traces, including aliases/overlaps.
- [Registration snapshot](REGISTERED-ROUTES.snapshot.json): source locations and mount chains.
- [Source contract inventory](SOURCE-CONTRACT-INVENTORY.json): decorators, parameter/default expressions, schema declarations and environment names. It does not expand inherited fields/validators or evaluate runtime settings.
- [API entry points/domains](API-ENTRY-POINTS-AND-DOMAINS.md): bootstrap registration order and composition boundaries.
- [EWA settings catalog snapshot](EWA-PLATFORM-SETTINGS.snapshot.json): 282 source definitions/defaults; no environment or database values. [Settings contract](../product/ewa/EWA-PLATFORM-SETTINGS-DB.md) defines validation, local reload and authorization limits.

Source declarations are not runtime OpenAPI. Most routes use Bearer identity; public middleware exemptions can delegate validation to tickets/device/operator credentials. Effective provider/client/audience settings are deployment inputs; read [identity operations](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md) and actual auth dependencies rather than assuming every route accepts every client token.

## Existing contract pipeline

The frontend's [package scripts](../../shared/web/frontend/package.json) expose OpenAPI export/extraction/type-generation and API inventory/gap-matrix commands. [The exporter](../../shared/api/scripts/export_openapi_docker.sh) can import the application in a selected container and use remote access; it was not executed in this audit. A generated JSON/type file is a snapshot, not proof of current deployment coverage.

- [Frontend/backend HTTP](FRONTEND-BACKEND-HTTP.md) and [alignment](FE-BE-ALIGNMENT.md): integration procedure.
- [Automatic gap matrix](FE-BE-GAP-MATRIX.md), [manual triage](FE-BE-GAP-MATRIX.manual.md) and [frontend call snapshot](fe-be-api-inventory.snapshot.md).
- [OpenAPI pilots/CI](OPENAPI-PILOTS-CI.md), [diff policy](OPENAPI-DIFF-POLICY.md) and [legacy paths](API-LEGACY-POLICY.md).
- [Profile API](PROFILE-API.md), [Android contracts](ANDROID-API-CONTRACTS.md) and [RabbitMQ usage](RABBITMQ_USAGE.md).

Detailed domain documents and stored pilots still need their per-file semantic/freshness review; see [audit inventory](../reference/DOCUMENTATION-INVENTORY.json). Closed remediation waves/local plans are historical evidence, not a zero-gap guarantee. Retired DEWA/operator exports are not living API surfaces.

[Documentation index](../INDEX.md) · [developer setup](../platform/DEVELOPER-SETUP.md) · [progress](../../docs/DOCUMENTATION_PROGRESS.md).
