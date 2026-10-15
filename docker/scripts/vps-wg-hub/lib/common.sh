#!/usr/bin/env bash
# shellcheck shell=bash
# Source из скриптов: source "${SCRIPT_DIR}/lib/common.sh" (SCRIPT_DIR задаётся в каждом скрипте)

set -euo pipefail

: "${SCRIPT_DIR:?Set SCRIPT_DIR before sourcing lib/common.sh}"

REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ ! -f "${SCRIPT_DIR}/config.env" ]]; then
  echo "Нет ${SCRIPT_DIR}/config.env — скопируй: cp config.env.example config.env" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${SCRIPT_DIR}/config.env"
set +a

resolve_ssh_key() {
  if [[ -n "${VPS_SSH_KEY_FILE:-}" && -f "${VPS_SSH_KEY_FILE}" ]]; then
    echo "${VPS_SSH_KEY_FILE}"
    return 0
  fi
  local active="${REPO_ROOT}/docker/scripts/vps-alma-ssh/keys/.active_key"
  if [[ -f "$active" ]]; then
    local p
    p="$(tr -d '\n' <"$active")"
    if [[ -f "$p" ]]; then
      echo "$p"
      return 0
    fi
  fi
  for cand in \
    "${REPO_ROOT}/docker/scripts/vps-alma-ssh/keys/id_ed25519" \
    "${REPO_ROOT}/docker/scripts/vps-alma-ssh/keys/id_rsa" \
    "${REPO_ROOT}/docker/scripts/vps-alma-ssh/keys/ssh-key-1775002720648"; do
    if [[ -f "$cand" ]]; then
      echo "$cand"
      return 0
    fi
  done
  echo "Не найден приватный ключ. Задай VPS_SSH_KEY_FILE в config.env" >&2
  return 1
}

SSH_KEY_FILE="$(resolve_ssh_key)" || exit 1

ssh_vps() {
  ssh -i "${SSH_KEY_FILE}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 \
    -l "${VPS_SSH_USER}" "${VPS_SSH_HOST}" "$@"
}

scp_to_vps() {
  local src="$1" dest="$2"
  scp -o ConnectTimeout=20 -i "${SSH_KEY_FILE}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 \
    "$src" "${VPS_SSH_USER}@${VPS_SSH_HOST}:${dest}"
}

read_key_one_line() {
  tr -d '\n' <"$1"
}
