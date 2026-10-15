# Prod DB Contour Upgrade (2026-06-19)

**Status:** living **rollback-kit + upgrade-pattern canon** (dated execution report for the 2026-06-19 prod-core cutover). Keep while ops still cite baseline paths/checksums; do **not** soft-retire into a nameless “history dump”. Newer DB work appends to this pattern (baseline dir + dumps + volume snapshots + `SHA256SUMS`) — see `project-and-deploy.mdc` §Database Upgrade Safety.

Цель документа: полный операторский отчет по апгрейду DB-контура на prod-core
`.111`, включая доказуемый rollback-набор (dumps + volume snapshots + checksums),
фактические шаги выполнения и инструкции отката.

## 1) Контур и версии

Upgrade scope (prod-core `.111`):

| Service | Before | After | Notes |
|---|---:|---:|---|
| `stack1-postgres` | `15.6` | `18.4` | major cutover через dump/restore |
| `stack6-keycloak-postgres` | `15.6-alpine` | `18.4-alpine` | major cutover; `PGDATA` enforced |
| `stack-ewa-postgres` | `15.6` | `18.4` | major cutover через dump/restore |
| `stack1-chroma` | `0.5.15` | `1.5.9` | startup contract changed (`chroma run`) |
| `stack1-chroma-code` | `0.5.15` | `1.5.9` | startup contract changed (`chroma run`) |
| `stack1-qdrant` | `1.17.1` | `1.18.2` | patch/major track refresh |
| `stack1-seaweedfs` | `3.64` | `4.34` | S3/filer continuity preserved |
| `stack1-rabbitmq` | `3.13.2-management` | `4.3.2-management` | deprecation policy fixed |
| `stack1-elasticsearch` | `8.11.0` | `9.4.2` | mandatory bridge `8.19.0` |

Post-window stabilization:

| Service | Before | After | Notes |
|---|---:|---:|---|
| `stack1-redis` | `7.2.4-alpine` | `7.2.14-alpine` | `8.x` intentionally excluded |

## 2) Ключевые решения выполнения

- Build policy preserved: runtime actions on `.111`, without rebake on prod-core.
- Elasticsearch upgraded with hard gate compliance:
  - `8.11.0 -> 8.19.0 -> 9.4.2` (direct `8.11 -> 9.x` unsupported).
- PostgreSQL 18 image behavior handled explicitly:
  - for stack6: `PGDATA=/var/lib/postgresql/data/pgdata`.
- Redis remained on `7.2.x` (module compatibility policy), then patched to latest
  stable `7.2.14-alpine`.

## 3) Полный rollback-набор (главное)

Canonical baseline directory on `.111`:

- `/home/owned/db-upgrade-backups/20260619-122131-db-upgrade-baseline`

### 3.1 Baseline evidence

- `podman-ps.txt`
- `podman-stats.txt`
- `inspect-*.json` per service container
- `logs-24h-*.log` per service container

### 3.2 Logical dumps

Path:

- `/home/owned/db-upgrade-backups/20260619-122131-db-upgrade-baseline/dumps`

Contains:

- `stack1-*.dump` (all non-template DBs)
- `stack1-globals.sql`
- `stack6-keycloak.dump`
- `stack6-keycloak-globals.sql`
- `stack-ewa.dump`
- `stack-ewa-globals.sql`
- `stack1-databases.txt` (inventory)

### 3.3 Volume snapshots

Path:

- `/home/owned/db-upgrade-backups/20260619-122131-db-upgrade-baseline/volume-snapshots`

Contains:

- `stack1-postgres-pgdata.tar`
- `stack1-chroma-data.tar`
- `stack1-chroma-code-data.tar`
- `stack1-qdrant-storage.tar`
- `stack1-seaweedfs-data.tar`
- `stack1-elasticsearch-data.tar`
- `stack1-rabbitmq-data.tar`
- `stack6-keycloak-postgres-data.tar`
- `stack-ewa-postgres-pgdata.tar`

### 3.4 Checksums

- `SHA256SUMS.txt` in baseline root, includes dumps + snapshots.

### 3.5 Rotated pre-upgrade PG15 data dirs

Preserved on `.111` (do not remove until burn-in complete):

- `<repo>/docker/data/stack1/postgresql/pgdata_pg15_20260619-125504`
- `<repo>/docker/data/stack6/keycloak-postgres_pg15_20260619-125504`
- `<repo>/docker/data/ewa/postgresql/pgdata_pg15_20260619-125504`

### 3.6 Post-upgrade observability

Path:

- `/home/owned/db-upgrade-backups/20260619-122131-db-upgrade-baseline/post-upgrade-observability`

Important files:

- `20260619-144031-snapshot.txt` (post-window health + noise counters)
- `20260619-150215-pg-tuning-pre.txt`
- `20260619-150311-vacuumdb-analyze.log`
- `20260619-150340-pg-tuning-post.txt`

Redis patch checkpoint:

- `/home/owned/db-upgrade-backups/20260619-122131-db-upgrade-baseline/redis-patch-upgrade/20260619-145112`
  (`version-before.txt`, `info-before.txt`, `redis-data.tar`, `SHA256SUMS.txt`)

## 4) Быстрые rollback-сценарии

### 4.1 PostgreSQL (stack1/stack6/ewa)

1. Stop dependent writers (`stack0-backend`, workers, services using target DB).
2. Stop target DB container.
3. Choose rollback source:
   - fastest: restore rotated `pgdata_pg15_*` directory;
   - deterministic: restore from dump into fresh cluster.
4. Restore ownership via `podman unshare chown` to expected UID/GID.
5. Start DB container, verify `pg_isready`, then dependent services.

PG dump restore pattern:

```bash
podman exec -i <pg-container> pg_restore ... < /path/to/dump
```

### 4.2 Non-PG data services

1. Stop target container.
2. Replace volume content from corresponding `*.tar`.
3. Restore ownership/SELinux label as required.
4. Start container and run health probe.

### 4.3 Verification after rollback

Minimum:

- `curl -sf http://127.0.0.1:29000/api/health`
- container health state for restored service
- targeted functional probe (Keycloak realm, EWA DB connect, queue ping, etc.)

## 5) What was stabilized after upgrade

- Redis durability/latency tuned:
  - `save 900 1`, `save 300 10000`
  - `latency-monitor-threshold 100`
  - host guard `vm.overcommit_memory=1`
- stack12 DNS bind drift fixed:
  - `INTERNAL_DNS_BIND_ADDRESS=192.168.1.111`
- stack1-postgres stability pass:
  - `checkpoint_timeout=10min`
  - `checkpoint_completion_target=0.9`
  - `max_wal_size=8GB`
  - `vacuumdb --all --analyze-in-stages`

## 6) Load-test follow-up (operator run)

During/after load window, collect:

- API health snapshots (`/api/health`)
- `podman stats` for stack1/stack6/stack-ewa
- Postgres:
  - `pg_stat_checkpointer` (`num_timed`, `num_requested`)
  - `pg_stat_activity` count
- Redis:
  - `aof_delayed_fsync`, `evicted_keys`, `rejected_connections`
- RabbitMQ:
  - queue depth and unacked messages
- Elasticsearch:
  - cluster health + index store growth

Compare with `post-upgrade-observability` snapshots for regression gating.

## 7) Related runbooks

- [STACK-CONTAINER-CONTROL.md](STACK-CONTAINER-CONTROL.md)
- [STACK1-POSTGRES-TUNING.md](STACK1-POSTGRES-TUNING.md)
- [EWA-POSTGRES-RUNBOOK.md](EWA-POSTGRES-RUNBOOK.md)
- [SEAWEEDFS-OPERATOR-RUNBOOK.md](SEAWEEDFS-OPERATOR-RUNBOOK.md)
