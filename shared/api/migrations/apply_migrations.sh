#!/usr/bin/env bash
#
# Применяет SQL-миграции из папки pending/ к БД.
# При успехе переносит каждый файл в applied/.
# Секреты подключения читаются из .env в этой же папке.
#
# psql с ON_ERROR_STOP=1: при ERROR внутри .sql скрипт прерывается и exit code ≠ 0,
# чтобы файл не переносился в applied/ и не создавалось ложное «успешно».
#
# Использование:
#   cd api/migrations && ./apply_migrations.sh
#   или: bash apply_migrations.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PENDING_DIR="$SCRIPT_DIR/pending"
APPLIED_DIR="$SCRIPT_DIR/applied"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -d "$PENDING_DIR" ]]; then
  echo "Папка pending/ не найдена. Создаю: $PENDING_DIR"
  mkdir -p "$PENDING_DIR"
fi
if [[ ! -d "$APPLIED_DIR" ]]; then
  echo "Папка applied/ не найдена. Создаю: $APPLIED_DIR"
  mkdir -p "$APPLIED_DIR"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Ошибка: файл .env не найден в $SCRIPT_DIR"
  echo "Скопируйте .env.example в .env и заполните параметры подключения к БД."
  echo "  cp .env.example .env"
  exit 1
fi

# Загружаем переменные из .env (без экспорта в окружение по умолчанию)
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a

# Режим: docker (через контейнер) или psql (напрямую по DATABASE_URL)
USE_DOCKER="${USE_DOCKER:-1}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-}"
if [[ -z "$CONTAINER_RUNTIME" ]]; then
  if command -v podman >/dev/null 2>&1; then
    CONTAINER_RUNTIME=podman
  elif command -v docker >/dev/null 2>&1; then
    CONTAINER_RUNTIME=docker
  else
    CONTAINER_RUNTIME=podman
  fi
fi
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-stack1-postgres}"
POSTGRES_USER="${POSTGRES_USER:-ai_user}"
POSTGRES_DB="${POSTGRES_DB:-ai_services}"
# POSTGRES_PASSWORD задаётся в .env (для psql через PGPASSWORD)

shopt -s nullglob
files=("$PENDING_DIR"/*.sql)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "Нет миграций в pending/ (файлы *.sql). Всё применено или добавьте новые скрипты в pending/."
  exit 0
fi

# Сортируем по имени файла для предсказуемого порядка
IFS=$'\n' sorted=($(sort <<<"${files[*]}"))
unset IFS

# INSERT/UPDATE в users требуют encryption.pii_key (триггер encrypt_users_pii).
# Тот же ключ, что ENCRYPTION_MASTER_KEY в env API — см. README.md § PII.
emit_migration_sql() {
  local filepath="$1"
  if [[ -n "${ENCRYPTION_MASTER_KEY:-}" ]]; then
    local esc="${ENCRYPTION_MASTER_KEY//\'/\'\'}"
    # SET (не SET LOCAL): иначе при автокоммите psql ключ не переживает до INSERT в users.
    printf "SET encryption.pii_key = '%s';\n" "$esc"
  fi
  cat "$filepath"
}

echo "Найдено миграций к выполнению: ${#sorted[@]}"
echo "Runtime: USE_DOCKER=${USE_DOCKER} ${CONTAINER_RUNTIME} → ${POSTGRES_CONTAINER}"
for f in "${sorted[@]}"; do
  echo "  - $(basename "$f")"
done
echo ""

for filepath in "${sorted[@]}"; do
  name="$(basename "$filepath")"
  echo "Применяю: $name ..."

  if [[ "$USE_DOCKER" == "1" ]]; then
    if [[ -z "$POSTGRES_CONTAINER" ]]; then
      echo "Ошибка: POSTGRES_CONTAINER не задан в .env"
      exit 1
    fi
    if emit_migration_sql "$filepath" | "${CONTAINER_RUNTIME}" exec -i "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -; then
      mv "$filepath" "$APPLIED_DIR/"
      echo "  OK — файл перенесён в applied/"
    else
      echo "  ОШИБКА — миграция завершилась с ошибкой. Остановка."
      exit 1
    fi
  else
    if [[ -z "$DATABASE_URL" ]]; then
      echo "Ошибка: DATABASE_URL не задан в .env (режим USE_DOCKER=0)"
      exit 1
    fi
    export PGPASSWORD
    PGPASSWORD="${POSTGRES_PASSWORD:-}"
    if emit_migration_sql "$filepath" | psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f -; then
      mv "$filepath" "$APPLIED_DIR/"
      echo "  OK — файл перенесён в applied/"
    else
      echo "  ОШИБКА — миграция завершилась с ошибкой. Остановка."
      exit 1
    fi
  fi
done

echo ""
echo "Готово. Успешно применено миграций: ${#sorted[@]}."
