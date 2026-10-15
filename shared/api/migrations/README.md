# Application database migrations

This directory contains application SQL and a pending-file runner. It is separate from [EWA platform migrations](../ewa_platform/migrations/README.md) and Keycloak's own schema. SQL files on disk do not establish which changes a particular database has applied.

## Two application runners

[The operator runner](../../../docker/scripts/apply-eliteew-migrations.sh) reads an explicit `MIGRATIONS` list, checks `schema_migrations(version, name)` and records successful applications. It does not discover every SQL file automatically. It reads `ENV_FILE` (default `docker/env_file/.env.stack1`), with `ELITEEW_MIGRATIONS_DIR` and `ELITEEW_CONTAINER_RUNTIME` overrides. The actual `USE_DOCKER` default is `auto`: host `psql` when available, otherwise the selected container runtime (default Podman). Set the mode explicitly for a predictable target.

[The pending runner](apply_migrations.sh) reads this directory's local `.env`, sorts `pending/*.sql`, executes each with `psql -v ON_ERROR_STOP=1` and **moves each successful file to `applied/`**. It does not maintain the operator runner's migration ledger. Its default `USE_DOCKER=1` selects Podman when available, otherwise Docker; `USE_DOCKER=0` uses `DATABASE_URL`. The runner creates missing `pending/` and `applied/` directories. [The template](.env.example) lists connection fields without live credentials.

Neither runner wraps the whole migration set in a single transaction. `ON_ERROR_STOP` stops subsequent work, but rollback of statements already committed depends on the SQL file itself. The operator runner executes the SQL and then writes the ledger separately. Inspect the selected files and database state before retrying a partial failure.

## Operator workflow

1. Identify the target database and approved change; review backup and recovery instructions in the [database hub](../../../documentation/database/README.md).
2. Choose the runner deliberately. Do not equate `applied/` with the live ledger or move a file merely to simulate success.
3. Load credentials through the documented local/config-plane mechanism, without printing passwords or dumping container environment.
4. Execute only during an authorized database change. These commands mutate data; the pending runner also changes the checkout.
5. Verify the specific schema/data postconditions and, for the operator runner, the ledger row. A successful connection probe proves reachability only.

Invocation paths from the monorepository root:

```bash
# Explicitly select the container path for the operator runner.
USE_DOCKER=1 ELITEEW_CONTAINER_RUNTIME=podman \
  bash docker/scripts/apply-eliteew-migrations.sh

# Alternative pending-file workflow; changes pending/applied paths on success.
bash shared/api/migrations/apply_migrations.sh
```

These commands were inspected, not executed during the documentation audit. There is no documented dry-run flag in either implementation.

## PII trigger context

The pending runner prepends `SET encryption.pii_key` when `ENCRYPTION_MASTER_KEY` is configured. Use the same secret managed for the API's PII contract; never put its value in SQL examples or logs. The operator runner must be assessed separately for the SQL being applied; this README does not promise equivalent key injection.

See [database pitfalls](../../../documentation/database/DB_PITFALLS_AND_QUIRKS.md), [trigger keep-list](../../../documentation/database/TRIGGERS_KEEP_VS_REMOVE.md) and [infrastructure source guide](../../../documentation/platform/INFRASTRUCTURE-SOURCE-GUIDE.md).
