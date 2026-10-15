#!/usr/bin/env bash
# Поднимает stack-yandex-tunnel с корректным YANDEX_TUNNEL_KEY_PATH (из env или ~/.ssh).
# Запуск из корня репозитория:
#   bash docker/scripts/yandex-tunnel/compose-up.sh [аргументы runtime compose …]
# По умолчанию выполняется: up -d
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
# shellcheck source=_ssh_defaults.sh
source "$SCRIPT_DIR/_ssh_defaults.sh"

if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "Runtime binary not found in PATH: ${CONTAINER_RUNTIME}" >&2
  exit 1
fi

eliteew_yandex_source_env "$REPO_ROOT"

if ! _key="$(eliteew_resolve_tunnel_private "$REPO_ROOT")"; then
  echo "Не найден приватный ключ туннеля. Задай YANDEX_TUNNEL_KEY_PATH в docker/env_file/.env.yandex-tunnel" >&2
  echo "или положь keys/yandex_tunnel_key, либо ~/.ssh/id_ed25519 (или id_rsa)." >&2
  exit 1
fi

export YANDEX_TUNNEL_KEY_PATH="${_key}"
echo "YANDEX_TUNNEL_KEY_PATH=${YANDEX_TUNNEL_KEY_PATH}" >&2

KNOWN_HOSTS_DEFAULT="$REPO_ROOT/docker/data/stack-yandex-tunnel/known_hosts"
mkdir -p "$(dirname "$KNOWN_HOSTS_DEFAULT")"
touch "$KNOWN_HOSTS_DEFAULT"
export YANDEX_TUNNEL_KNOWN_HOSTS_PATH="${YANDEX_TUNNEL_KNOWN_HOSTS_PATH:-$KNOWN_HOSTS_DEFAULT}"
if [[ ! -s "$YANDEX_TUNNEL_KNOWN_HOSTS_PATH" ]]; then
  echo "WARN: $YANDEX_TUNNEL_KNOWN_HOSTS_PATH пуст — добавьте host key VM: ssh-keyscan -H \"\$YANDEX_VM_IP\" >> \"$YANDEX_TUNNEL_KNOWN_HOSTS_PATH\"" >&2
fi

cd "$REPO_ROOT"
if [[ -z "${ENV_FILE:-}" ]]; then
  _env_lib="${SCRIPT_DIR}/../prod-core-env-lib.sh"
  if [[ -f "${_env_lib}" ]]; then
    # shellcheck source=/dev/null
    source "${_env_lib}"
    ENV_FILE="$(prod_core_env_file_path "${REPO_ROOT}" .env.yandex-tunnel)"
  else
    ENV_FILE="${REPO_ROOT}/docker/env_file/.env.yandex-tunnel"
  fi
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE — Config Plane push или скопируй .env.yandex-tunnel.example" >&2
  exit 1
fi

if [[ "$#" -eq 0 ]]; then
  exec "${CONTAINER_RUNTIME}" compose -f docker/stack/stack-yandex-tunnel.yml --env-file "$ENV_FILE" up -d
fi
exec "${CONTAINER_RUNTIME}" compose -f docker/stack/stack-yandex-tunnel.yml --env-file "$ENV_FILE" "$@"
