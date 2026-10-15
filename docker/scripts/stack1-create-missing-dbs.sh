#!/usr/bin/env bash
# Create missing DBs required by live stacks on stack1-postgres: etherpad only.
# Legacy airflow is intentionally NOT created (BI Airflow removed).
# Data in bind mount docker/data/stack1 (../data/stack1/postgresql from compose).
# Run from monorepo root. Requires running container stack1-postgres.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTAINER="${CONTAINER:-stack1-postgres}"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/docker/env_file/.env.stack1}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-ai_user}"
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "Container runtime not found: ${CONTAINER_RUNTIME}" >&2
  exit 1
fi

if ! "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Контейнер $CONTAINER не запущен. Сначала поднимите stack1."
  exit 1
fi

echo "=== Создание недостающих БД в $CONTAINER (владелец: $POSTGRES_USER) ==="

# В образе Postgres из docker создаётся только POSTGRES_USER (ai_user), роли postgres нет — подключаемся от ai_user
"${CONTAINER_RUNTIME}" exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'etherpad') THEN
    CREATE DATABASE etherpad;
    RAISE NOTICE 'Создана БД etherpad';
  ELSE
    RAISE NOTICE 'БД etherpad уже существует';
  END IF;
END
$$;
EOSQL

echo "=== Готово. etherpad kept for stack11 Meet; airflow is legacy and not created. ==="
