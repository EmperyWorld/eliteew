#!/usr/bin/env bash
# Apply recommended PostgreSQL tuning for stack1 (docker/stack/stack1.yml).
# The live config lives on the data volume: docker/data/stack1/postgresql/postgresql.conf
# (often owned by uid 999 / root — run with sudo if "Permission denied").
#
# Usage (from monorepo root):
#   sudo ./docker/scripts/stack1-postgres-tuning-apply.sh
#   podman restart stack1-postgres
#   podman exec stack1-postgres bash -c 'psql -U "$POSTGRES_USER" -d postgres -c "SHOW shared_buffers; SHOW work_mem; SHOW shared_preload_libraries;"'
#   podman exec stack1-postgres bash -c 'psql -U "$POSTGRES_USER" -d ai_services -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"'
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONF="${STACK1_POSTGRESQL_CONF:-$ROOT/docker/data/stack1/postgresql/postgresql.conf}"

if [[ ! -f "$CONF" ]]; then
  echo "Config not found: $CONF" >&2
  exit 1
fi

TS="$(date +%Y%m%d%H%M%S)"
cp -a "$CONF" "${CONF}.bak.${TS}"
echo "Backup: ${CONF}.bak.${TS}"

sed -i \
  -e 's/^max_connections = 100/max_connections = 300/' \
  -e 's/^max_connections = 200/max_connections = 300/' \
  -e 's/^shared_buffers = 128MB/shared_buffers = 4GB/' \
  "$CONF"

# work_mem: 4MB at max_connections=300 (see STACK1-POSTGRES-TUNING.md).
sed -i \
  -e 's/^work_mem = 8MB/work_mem = 4MB/' \
  -e 's/^#work_mem = 4MB/work_mem = 4MB/' \
  -e 's/^#maintenance_work_mem = 64MB/maintenance_work_mem = 256MB/' \
  -e 's/^maintenance_work_mem = 64MB/maintenance_work_mem = 256MB/' \
  "$CONF"

sed -i \
  -e 's/^#effective_cache_size = 4GB/effective_cache_size = 12GB/' \
  -e 's/^effective_cache_size = 4GB/effective_cache_size = 12GB/' \
  -e 's/^#random_page_cost = 4.0/random_page_cost = 1.1/' \
  -e 's/^random_page_cost = 4.0/random_page_cost = 1.1/' \
  -e 's/^#effective_io_concurrency = 1/effective_io_concurrency = 200/' \
  -e 's/^effective_io_concurrency = 1/effective_io_concurrency = 200/' \
  "$CONF"

sed -i 's/^#log_lock_waits = off/log_lock_waits = on/' "$CONF"
# Align with stack1.yml command -c max_wal_size=8GB (not the old 2GB script default).
sed -i \
  -e 's/^max_wal_size = 1GB/max_wal_size = 8GB/' \
  -e 's/^max_wal_size = 2GB/max_wal_size = 8GB/' \
  "$CONF"

# --- pg_stat_statements (requires restart via shared_preload_libraries) ---
if grep -qE '^[[:space:]]*shared_preload_libraries[[:space:]]*=' "$CONF"; then
  if ! grep -qE "^[[:space:]]*shared_preload_libraries[[:space:]]*=[[:space:]]*'[^']*pg_stat_statements" "$CONF"; then
    # Append pg_stat_statements into existing quoted list (single-library or multi).
    sed -i -E "s/^([[:space:]]*shared_preload_libraries[[:space:]]*=[[:space:]]*')([^']*)('.*)/\1\2,pg_stat_statements\3/" "$CONF"
    # If the line was empty quotes, sed above may produce ',pg_stat_statements' — normalize.
    sed -i -E "s/^([[:space:]]*shared_preload_libraries[[:space:]]*=[[:space:]]*')(,pg_stat_statements)/\1pg_stat_statements/" "$CONF"
  fi
else
  # Prefer replacing a commented default; otherwise append a dedicated block.
  if grep -qE '^#shared_preload_libraries' "$CONF"; then
    sed -i "s/^#shared_preload_libraries.*/shared_preload_libraries = 'pg_stat_statements'/" "$CONF"
  else
    printf '\n# EliteEW stack1 tuning — query observability\nshared_preload_libraries = '\''pg_stat_statements'\''\n' >>"$CONF"
  fi
fi

if ! grep -qE '^[[:space:]]*pg_stat_statements.max[[:space:]]*=' "$CONF"; then
  printf '\npg_stat_statements.max = 10000\npg_stat_statements.track = all\n' >>"$CONF"
else
  sed -i \
    -e 's/^#*pg_stat_statements.max.*/pg_stat_statements.max = 10000/' \
    -e 's/^#*pg_stat_statements.track.*/pg_stat_statements.track = all/' \
    "$CONF"
fi

echo "Updated $CONF — restart Postgres to apply shared_buffers / max_connections / shared_preload_libraries."
grep -nE '^max_connections|^shared_buffers|^work_mem|^maintenance_work_mem|^effective_cache_size|^random_page_cost|^effective_io_concurrency|^log_lock_waits|^max_wal_size|^shared_preload_libraries|^pg_stat_statements' "$CONF" || true
