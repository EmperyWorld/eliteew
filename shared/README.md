# Shared product implementation

The shared tree contains the implementation used by cloud and organization entrances:

- [api/](api/) — FastAPI application, domain routers, persistence adapters and worker processes; [architecture](../documentation/platform/ARCHITECTURE-CODE-MAP.md), [HTTP reference](../documentation/api/SOURCE-HTTP-REFERENCE.md).
- [web/frontend/](web/frontend/) — React desktop/application SPA; [developer entry](../documentation/product/FRONTEND-DEVELOPER-ENTRY.md).
- [web/site_prod/](web/site_prod/README.md) — independently built Next.js public site.
- [apps/](apps/README.md) — application manifests, schemas and installation profiles.
- [packages/](packages/) — private workspace packages, including [offline mount policy](packages/kernel-offline-policy/README.md).
- [tools/](tools/README.md) — shared application tools; distinct from host/CI [tools/](../tools/README.md).

[Developer setup](../documentation/platform/DEVELOPER-SETUP.md) describes dependencies and local commands. The host API environment, when configured, is the monorepository-root `.venv`; images use their own environment. `EliteEW/` is a retired alias, not the current product root.

[Pack layout](../documentation/platform/ELITEEW-PACK-LAYOUT.md) defines boundaries with [cloud](../pack-cloud/README.md), [organization](../pack-organization/README.md), [host assets](../host/README.md) and [container infrastructure](../docker/README.md). See [the module map](../documentation/reference/SOURCE-MODULE-MAP.md) for domain ownership and source links.
