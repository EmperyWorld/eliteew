# Database documentation and migration entry points

This hub maps checked-in storage implementations and operator guidance. It does not certify a live database's version, contents or applied migrations. Production placement and service status belong to [topology state](../platform/PRODUCTION-TOPOLOGY-STATE.md).

## PostgreSQL boundaries

- **Application data:** [stack1 compose](../../docker/stack/stack1.yml) defines application PostgreSQL. The shared API's [database manager](../../shared/api/core/database_manager.py) consumes application connection settings. SQL and the two different migration runners are described in [application migrations](../../shared/api/migrations/README.md).
- **EWA platform data:** [separate compose](../../docker/stack/stack-ewa-postgres.yml), `EWA_DATABASE_URL` and the [EWA migration runner](../../shared/api/ewa_platform/migrations/README.md) form a separate connection/schema lifecycle. The runner has no applied-migration ledger; the API also bootstraps/seeds parts of this schema.
- **Identity data:** [stack6 compose](../../docker/stack/stack6.yml) provides Keycloak's PostgreSQL. Keycloak owns its schema. Application migrations must not target it; see [Keycloak operations](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md).
- **KBSEW metadata:** [KBSEW's pool](../../KBSEW/api/core/database.py) accesses its `kbsew` schema and durable ingestion jobs; the schema is provisioned by [application SQL](../../shared/api/migrations/applied/20260703_01_kbsew_schema.sql), not automatically by pool initialization. See [KBSEW](../../KBSEW/README.md).
- **Olenti:** the independent site template uses [Prisma](../../site-templates/olenti/server/prisma/schema.prisma), with its own database configuration and migrations. See [template setup](../../site-templates/olenti/README.md).

Vector/object/search services have different interfaces from PostgreSQL. See [storage/vector topology](../platform/docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md) and the source-backed [architecture map](../platform/ARCHITECTURE-CODE-MAP.md). Chroma is retained as a legacy fallback; new primary vector work follows the existing Qdrant policy.

## Detailed references

- [Critical table registry](DATABASE_TABLES_REGISTRY.md): curated table ownership and usage.
- [Pitfalls and quirks](DB_PITFALLS_AND_QUIRKS.md): PII, RLS, materialized views and identifier types.
- [Trigger keep-list](TRIGGERS_KEEP_VS_REMOVE.md): current intentions and historical DROP waves. Historical statements are not a request to replay destructive SQL.
- [EWA runbook](../platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md), [stack1 tuning](../platform/docker-re_doc/STACK1-POSTGRES-TUNING.md) and [upgrade/recovery kit](../platform/docker-re_doc/PROD-DB-CONTOUR-UPGRADE-2026-06-19.md).

The detailed references remain subject to the [documentation inventory](../reference/DOCUMENTATION-INVENTORY.json)'s per-file semantic review status. Old function dumps and retired application trees do not establish the current schema.

## Verification limits

A `pg_isready` result establishes connection availability, not schema parity. Verify the affected tables/columns/constraints and actual migration ledger or postconditions against an authorized target. Do not treat SQL filenames as evidence of production execution. No database connection, dump, migration, backup or remote smoke was performed during this documentation audit.
