#!/usr/bin/env bash
# Apply EWA platform SQL migrations to EWA_DATABASE_URL (Postgres).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${EWA_DATABASE_URL:-}" ]]; then
  echo "EWA_DATABASE_URL is not set" >&2
  exit 1
fi

run_sql_file() {
  local sql_file="$1"
  if [[ "${USE_DOCKER_PSQL:-0}" == "0" ]]; then
    psql "$EWA_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
    return
  fi
  docker exec -i \
    -e PGPASSWORD="$EWA_PG_PASSWORD" \
    "$EWA_PG_CONTAINER" \
    psql \
      -h "$EWA_PG_HOST" \
      -p "$EWA_PG_PORT" \
      -U "$EWA_PG_USER" \
      -d "$EWA_PG_DB" \
      -v ON_ERROR_STOP=1 \
      -f - < "$sql_file"
}

USE_DOCKER_PSQL=0
if ! command -v psql >/dev/null 2>&1; then
  command -v docker >/dev/null 2>&1 || { echo "psql not found in PATH and docker is unavailable" >&2; exit 1; }
  command -v python3 >/dev/null 2>&1 || { echo "psql not found in PATH and python3 is unavailable for DSN parsing" >&2; exit 1; }
  EWA_PG_CONTAINER="${EWA_MIGRATE_EWA_PG_CONTAINER:-stack-ewa-postgres}"
  if [[ "$(docker inspect -f '{{.State.Running}}' "$EWA_PG_CONTAINER" 2>/dev/null || true)" != "true" ]]; then
    echo "psql not found and EWA postgres container is not running: $EWA_PG_CONTAINER" >&2
    exit 1
  fi
  mapfile -t _ewa_pg_parts < <(python3 - <<'PY'
from urllib.parse import urlparse, unquote
import os
import sys

url = os.environ.get("EWA_DATABASE_URL", "")
parsed = urlparse(url)
if parsed.scheme not in {"postgres", "postgresql"}:
    print("unsupported EWA_DATABASE_URL scheme", file=sys.stderr)
    sys.exit(1)
host = parsed.hostname or "127.0.0.1"
port = str(parsed.port or 5432)
user = unquote(parsed.username or "")
password = unquote(parsed.password or "")
db = (parsed.path or "/").lstrip("/") or "ewa"
if not user:
    print("EWA_DATABASE_URL missing username", file=sys.stderr)
    sys.exit(1)
print(host)
print(port)
print(user)
print(password)
print(db)
PY
)
  EWA_PG_HOST="${_ewa_pg_parts[0]}"
  EWA_PG_PORT="${_ewa_pg_parts[1]}"
  EWA_PG_USER="${_ewa_pg_parts[2]}"
  EWA_PG_PASSWORD="${_ewa_pg_parts[3]}"
  EWA_PG_DB="${_ewa_pg_parts[4]}"
  USE_DOCKER_PSQL=1
  echo "psql not found in PATH, using docker exec into $EWA_PG_CONTAINER"
fi
shopt -s nullglob
rename_sql="$ROOT/applied/002_rename_legacy_amka_orchestration_tables.sql"
mapfile -t sql_files < <(find "$ROOT/applied" -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)
if [[ ${#sql_files[@]} -eq 0 ]]; then
  echo "No *.sql files under $ROOT/applied" >&2
  exit 1
fi
# Legacy rename must run before ``001_orchestration.sql``: otherwise ``CREATE TABLE IF NOT EXISTS ewa_*``
# creates empty shadows while ``amka_*`` still exists, and ``RENAME TO ewa_*`` fails.
ordered=()
if [[ -f "$rename_sql" ]]; then
  ordered+=("$rename_sql")
fi
for SQL in "${sql_files[@]}"; do
  [[ "$SQL" == "$rename_sql" ]] && continue
  ordered+=("$SQL")
done
for SQL in "${ordered[@]}"; do
  run_sql_file "$SQL"
  echo "Applied $SQL"
done
