#!/usr/bin/env bash
# Финальная установка прав в docker/ (env_file, data, logs, stack, scripts).
# Запуск: bash docker/scripts/fix-docker-permissions-final.sh
# Коротко: ./scripts/fix-docker-perms.sh
#
# Elevation (chown на root-owned / service UID):
#   1) уже root
#   2) sudo -n (без пароля)
#   3) docker run --privileged -u root  ← без sudo, если пользователь в группе docker
#
# Документация documentation/platform/docker-re_doc/ — опционально (FIX_DOCS=1).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"
[ -d docker ] || { echo "Ожидается корень репо с каталогом docker/"; exit 1; }
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

DEPLOY_USER="${DEPLOY_USER:-$USER}"
DEPLOY_UID="${DEPLOY_UID:-$(id -u)}"
DEPLOY_GID="${DEPLOY_GID:-$(id -g)}"
ELEVATE_MODE=""
SKIPS=0
FAILS=0

_elevate_probe() {
  if [[ "$(id -u)" -eq 0 ]]; then
    ELEVATE_MODE="root"
    return 0
  fi
  if sudo -n true 2>/dev/null; then
    ELEVATE_MODE="sudo"
    return 0
  fi
  if command -v "$CONTAINER_RUNTIME" >/dev/null 2>&1 && "$CONTAINER_RUNTIME" info >/dev/null 2>&1; then
    ELEVATE_MODE="runtime"
    return 0
  fi
  ELEVATE_MODE="none"
  return 1
}

_elevate() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
    return $?
  fi
  if [[ "$ELEVATE_MODE" == "sudo" ]]; then
    sudo "$@"
    return $?
  fi
  if [[ "$ELEVATE_MODE" == "runtime" ]]; then
    local inner qcmd
    inner=$(printf '%q ' "$@")
    qcmd="cd /repo && ${inner}"
    "${CONTAINER_RUNTIME}" run --rm --privileged \
      --security-opt label=disable \
      -v "$REPO_ROOT:/repo" \
      docker.io/library/alpine:3.21 \
      sh -c "$qcmd"
    return $?
  fi
  echo "[skip] нужен root/sudo/container runtime: $*" >&2
  SKIPS=$((SKIPS + 1))
  return 1
}

_chown_deploy() {
  local path="$1"
  [ -e "$path" ] || return 0
  if _elevate chown -R "$DEPLOY_UID:$DEPLOY_GID" "$path"; then
    echo "  chown $DEPLOY_USER: $path"
  else
    FAILS=$((FAILS + 1))
  fi
}

_chown_uid() {
  local path="$1" uid="$2" gid="$3"
  [ -e "$path" ] || return 0
  if _elevate chown -R "$uid:$gid" "$path"; then
    echo "  chown $uid:$gid $path"
  else
    FAILS=$((FAILS + 1))
  fi
}

_chmod_tree() {
  local path="$1" dmode="$2" fmode="$3"
  [ -d "$path" ] || return 0
  _elevate find "$path" -type d -exec chmod "$dmode" {} + 2>/dev/null || true
  _elevate find "$path" -type f -exec chmod "$fmode" {} + 2>/dev/null || true
}

echo "=== EliteEW docker permissions (deploy=$DEPLOY_USER uid=$DEPLOY_UID) ==="
if _elevate_probe; then
  echo "Elevation: $ELEVATE_MODE"
else
  echo "[warn] Нет root/sudo/container runtime — только то, что уже принадлежит $DEPLOY_USER"
fi
echo

echo "=== 1. Секреты (env_file) — критично для eectl/compose ==="
if [ -d docker/env_file ]; then
  _elevate chmod 700 docker/env_file || true
  _elevate find docker/env_file -maxdepth 1 -type f -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
  _chown_deploy docker/env_file
else
  echo "  (нет docker/env_file)"
fi

echo "=== 2. Корень docker/ ==="
_chown_deploy docker
_elevate chmod 755 docker 2>/dev/null || true

echo "=== 3. Compose, конфиги, сборка (без documentation — см. FIX_DOCS=1) ==="
for d in docker/stack docker/conf.d docker/host_conf docker/builders; do
  [ -d "$d" ] || continue
  _chmod_tree "$d" 755 644
  _chown_deploy "$d"
done
_elevate find docker/builders -type f \( -name '*.sh' -o -name 'start_all.sh' \) -exec chmod 755 {} + 2>/dev/null || true

if [[ "${FIX_DOCS:-0}" == "1" ]]; then
  echo "=== 3b. documentation/platform/docker-re_doc (FIX_DOCS=1) ==="
  d=documentation/platform/docker-re_doc
  if [ -d "$d" ]; then
    _chmod_tree "$d" 755 644
    _chown_deploy "$d"
  fi
else
  echo "=== 3b. documentation/platform/docker-re_doc — пропуск (не нужно для compose; FIX_DOCS=1 чтобы чинить) ==="
fi

echo "=== 4. Скрипты docker/scripts/ ==="
_elevate chmod 755 docker/scripts 2>/dev/null || true
_elevate find docker/scripts -type f -name '*.sh' -exec chmod 755 {} + 2>/dev/null || true
_chown_deploy docker/scripts

echo "=== 5. Корень docker/data/ и docker/logs/ ==="
_chown_deploy docker/data
_chown_deploy docker/logs
_elevate chmod 755 docker/data docker/logs 2>/dev/null || true

echo "=== 6. docker/data — UID сервисов ==="
for dir in postgresql redis rabbitmq rabbitmq-conf; do
  _chown_uid "docker/data/stack1/$dir" 999 999
done
for dir in chroma chroma-code qdrant seaweedfs elasticsearch elasticsearch_config; do
  _chown_uid "docker/data/stack1/$dir" "$DEPLOY_UID" "$DEPLOY_GID"
done
_chown_uid docker/data/stack2/airflow 50000 0
_chown_uid docker/data/stack2/llama "$DEPLOY_UID" "$DEPLOY_GID"
_chown_uid docker/data/stack4/paperless "$DEPLOY_UID" "$DEPLOY_GID"
_chown_uid docker/data/stack5/searxng 977 977
_chown_uid docker/data/stack6/keycloak-postgres 70 70
for dir in whisper-fast silero; do
  _chown_uid "docker/data/stack9/$dir" "$DEPLOY_UID" "$DEPLOY_GID"
done
if [ -d docker/data/stack11/prosody ]; then
  _chown_uid docker/data/stack11/prosody 101 102
  _elevate find docker/data/stack11/prosody -type f -name '*.dat' -exec chmod 640 {} + 2>/dev/null || true
fi
for dir in etherpad web jicofo jvb jibri recordings transcripts; do
  _chown_uid "docker/data/stack11/$dir" "$DEPLOY_UID" "$DEPLOY_GID"
done
_chown_uid docker/data/stack3 "$DEPLOY_UID" "$DEPLOY_GID"

# Redis AOF: каталог 700, файлы 660 — иначе MISCONF на некоторых хостах
if [ -d docker/data/stack1/redis/appendonlydir ]; then
  _elevate chmod 700 docker/data/stack1/redis/appendonlydir 2>/dev/null || true
  _elevate find docker/data/stack1/redis/appendonlydir -type f -exec chmod 660 {} + 2>/dev/null || true
fi

echo "=== 7. docker/logs — UID сервисов ==="
for dir in postgres redis rabbitmq; do
  _chown_uid "docker/logs/stack1/$dir" 999 999
done
for dir in chroma chroma-code qdrant seaweedfs elasticsearch; do
  _chown_uid "docker/logs/stack1/$dir" "$DEPLOY_UID" "$DEPLOY_GID"
done
for dir in airflow-dag-processor airflow-init airflow-scheduler airflow-triggerer airflow-webserver airflow-worker; do
  _chown_uid "docker/logs/stack2/$dir" 50000 0
done
_chown_uid docker/logs/stack2/llama "$DEPLOY_UID" "$DEPLOY_GID"
_chown_uid docker/logs/stack4 "$DEPLOY_UID" "$DEPLOY_GID"
for dir in tika ocrmypdf-api gotenberg tesseract paperless; do
  mkdir -p "docker/logs/stack4/$dir"
  _chown_uid "docker/logs/stack4/$dir" "$DEPLOY_UID" "$DEPLOY_GID"
done
_chown_uid docker/logs/stack5/searxng 977 977
_chown_uid docker/logs/stack5/crawl4ai "$DEPLOY_UID" "$DEPLOY_GID"
_chown_uid docker/logs/stack6/keycloak-postgres 70 70
_chown_uid docker/logs/stack6/keycloak 1000 0
_chown_uid docker/logs/stack9 "$DEPLOY_UID" "$DEPLOY_GID"
_chown_uid docker/logs/stack0 "$DEPLOY_UID" "$DEPLOY_GID"
mkdir -p docker/logs/stack0/eliteew-api-worker-prod 2>/dev/null || true
_chown_uid docker/logs/stack0/eliteew-api-worker-prod "$DEPLOY_UID" "$DEPLOY_GID"
_chown_uid docker/logs/stack11 "$DEPLOY_UID" "$DEPLOY_GID"
_chown_uid docker/logs/stack3 "$DEPLOY_UID" "$DEPLOY_GID"

echo "=== 7b. host/generated_files (stack0-runtime в контейнере) ==="
if [ -d host/generated_files ]; then
  _elevate chmod 755 host/generated_files 2>/dev/null || true
  if command -v "$CONTAINER_RUNTIME" >/dev/null 2>&1 \
    && { "$CONTAINER_RUNTIME" ps --format '{{.Names}}' 2>/dev/null | grep -qx stack0-eliteew-api-prod-baked \
      || "$CONTAINER_RUNTIME" ps --format '{{.Names}}' 2>/dev/null | grep -qx stack0-eliteew-api-prod; }; then
    bash docker/scripts/fix-generated-files-permissions.sh \
      && echo "  fix-generated-files-permissions.sh: ok" \
      || FAILS=$((FAILS + 1))
  else
    echo "  stack0 API (baked/dev) не запущен — пропуск in-container chown"
    echo "  После up stack0: bash docker/scripts/fix-generated-files-permissions.sh"
  fi
else
  echo "  (нет host/generated_files)"
fi

echo "=== 7c. stack0 prod-baked /logs (ELITEEW_LOG_FILE) ==="
if command -v "$CONTAINER_RUNTIME" >/dev/null 2>&1 \
  && "$CONTAINER_RUNTIME" ps --format '{{.Names}}' 2>/dev/null | grep -qx stack0-eliteew-api-prod-baked; then
  bash docker/scripts/fix-stack0-baked-logs-permissions.sh \
    && echo "  fix-stack0-baked-logs-permissions.sh: ok" \
    || FAILS=$((FAILS + 1))
else
  echo "  stack0-eliteew-api-prod-baked не запущен — пропуск in-container /logs chown"
fi

echo "=== 8. SELinux restorecon (Fedora, если доступен) ==="
if command -v restorecon >/dev/null 2>&1; then
  for rel in docker/data/stack1/redis docker/env_file docker/logs/stack0; do
    [ -e "$rel" ] || continue
    restorecon -Rv "$rel" 2>/dev/null | tail -1 || echo "  restorecon $rel: частично (нужен root на 999-томах — ok)"
  done
else
  echo "  restorecon не найден — пропуск"
fi

echo "=== 9. Права на чтение docker/logs для мониторинга ==="
_elevate chmod -R o+rX docker/logs 2>/dev/null && echo "  chmod o+rX docker/logs" || true

echo
echo "=== Готово ==="
if [ -r docker/env_file/.env.stack1 ] 2>/dev/null; then
  echo "[ok] docker/env_file читается как $DEPLOY_USER"
else
  echo "[fail] docker/env_file/.env.stack1 недоступен — нужен docker/sudo elevation"
  FAILS=$((FAILS + 1))
fi
echo "Пропусков (no elevation): $SKIPS; ошибок: $FAILS"
echo "Проверка: ls -la docker/env_file; test -r docker/env_file/.env.stack2 && echo env_ok"
echo "Без sudo: elevation через container runtime (группа runtime). Доки: FIX_DOCS=1 $0"

exit $((FAILS > 0 ? 1 : 0))
