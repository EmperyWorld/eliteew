#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Read-only Redis diagnostics for stack1 that use auth env indirection instead of
# passing secrets on the redis-cli command line.
# Invariants:
# - Never print REDIS_PASSWORD or pass it as a redis-cli argument.
# Related:
# - documentation/platform/REDIS_ARCHITECTURE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
REDIS_CONTAINER="${REDIS_CONTAINER:-stack1-redis}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-${REDIS_EXTERNAL_PORT:-${REDIS_HOST_PORT:-6379}}}"
REDIS_AUTH_SOURCE="${REDIS_AUTH_SOURCE:-}"

usage() {
  cat <<'EOF'
Usage: bash docker/scripts/redis-diagnostics.sh [summary|ping|memory|dbsize|metadata]

Read-only stack1 Redis diagnostics. The script loads REDIS_PASSWORD from:
  1. current process env;
  2. prod-core runtime tmpfs: $ELITEEW_ENV_RUNTIME_DIR/.env.stack1 or $XDG_RUNTIME_DIR/eliteew/env-runtime/.env.stack1;
  3. command-center / legacy env files: docker/env_file/.env.stack1, then docker/env_file/.env.

It passes auth through REDISCLI_AUTH and never prints the secret.
EOF
}

xtrace_disable() {
  case "$-" in
    *x*)
      set +x
      printf '1'
      ;;
    *)
      printf '0'
      ;;
  esac
}

xtrace_restore() {
  local was_on="$1"
  if [[ "${was_on}" == "1" ]]; then
    set -x
  fi
}

errexit_disable() {
  case "$-" in
    *e*)
      set +e
      printf '1'
      ;;
    *)
      printf '0'
      ;;
  esac
}

errexit_restore() {
  local was_on="$1"
  if [[ "${was_on}" == "1" ]]; then
    set -e
  fi
}

runtime_env_dir() {
  if [[ -n "${ELITEEW_ENV_RUNTIME_DIR:-}" ]]; then
    printf '%s' "${ELITEEW_ENV_RUNTIME_DIR}"
    return 0
  fi
  printf '%s/eliteew/env-runtime' "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
}

try_source_env_file() {
  local env_file="$1"
  local source_label="$2"
  local xtrace_was_on allexport_was_on

  [[ -f "${env_file}" ]] || return 1
  xtrace_was_on="$(xtrace_disable)"
  case "$-" in
    *a*) allexport_was_on="1" ;;
    *) allexport_was_on="0" ;;
  esac
  set -a
  # shellcheck source=/dev/null
  source "${env_file}"
  if [[ "${allexport_was_on}" != "1" ]]; then
    set +a
  fi
  xtrace_restore "${xtrace_was_on}"

  if [[ -n "${REDIS_PASSWORD:-}" ]]; then
    REDIS_AUTH_SOURCE="${source_label}"
    return 0
  fi
  return 1
}

env_file_has_redis_password() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 1
  awk -F= '
    $1 == "REDIS_PASSWORD" {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if (length(value) > 0) {
        found = 1
      }
    }
    END { exit(found ? 0 : 1) }
  ' "${env_file}"
}

auth_candidates() {
  local runtime_dir
  runtime_dir="$(runtime_env_dir)"
  printf '%s\t%s\n' "${runtime_dir}/.env.stack1" "runtime_tmpfs:.env.stack1"
  printf '%s\t%s\n' "${REPO_ROOT}/docker/env_file/.env.stack1" "repo_env:.env.stack1"
  printf '%s\t%s\n' "${REPO_ROOT}/docker/env_file/.env" "repo_env:.env"
}

load_redis_auth() {
  local env_file source_label
  if [[ -n "${REDIS_PASSWORD:-}" ]]; then
    REDIS_AUTH_SOURCE="process_env:REDIS_PASSWORD"
    return 0
  fi

  while IFS=$'\t' read -r env_file source_label; do
    if try_source_env_file "${env_file}" "${source_label}"; then
      return 0
    fi
  done < <(auth_candidates)

  return 1
}

auth_source_status() {
  local env_file source_label
  if [[ -n "${REDIS_PASSWORD:-}" ]]; then
    printf '%s\n' "available:process_env:REDIS_PASSWORD"
    return 0
  fi
  while IFS=$'\t' read -r env_file source_label; do
    if env_file_has_redis_password "${env_file}"; then
      printf '%s\n' "available:${source_label}"
      return 0
    fi
  done < <(auth_candidates)
  printf '%s\n' "missing"
  return 1
}

container_is_running() {
  local name
  command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1 || return 1
  while IFS= read -r name; do
    [[ "${name}" == "${REDIS_CONTAINER}" ]] && return 0
  done < <("${CONTAINER_RUNTIME}" ps --format '{{.Names}}' 2>/dev/null)
  return 1
}

run_with_auth_env() {
  local xtrace_was_on errexit_was_on status
  xtrace_was_on="$(xtrace_disable)"
  errexit_was_on="$(errexit_disable)"
  REDISCLI_AUTH="${REDIS_PASSWORD}" "$@"
  status=$?
  errexit_restore "${errexit_was_on}"
  xtrace_restore "${xtrace_was_on}"
  return "${status}"
}

redis_cli() {
  if container_is_running; then
    run_with_auth_env \
      "${CONTAINER_RUNTIME}" exec --env REDISCLI_AUTH "${REDIS_CONTAINER}" \
      redis-cli --no-auth-warning "$@"
    return $?
  fi

  if command -v redis-cli >/dev/null 2>&1; then
    run_with_auth_env redis-cli --no-auth-warning -h "${REDIS_HOST}" -p "${REDIS_PORT}" "$@"
    return $?
  fi

  echo "ERROR: neither running ${REDIS_CONTAINER} nor host redis-cli is available." >&2
  return 127
}

require_redis_auth() {
  if load_redis_auth; then
    return 0
  fi
  echo "ERROR: REDIS_PASSWORD is not available from process env, runtime tmpfs, or repo env files." >&2
  echo "Do not read it from the ${REDIS_CONTAINER} container environment; stack1 Redis does not export it there." >&2
  return 2
}

redis_ping() {
  require_redis_auth
  redis_cli PING | tr -d '\r'
}

redis_memory() {
  require_redis_auth
  redis_cli INFO memory | awk -F: '
    /^(used_memory_human|maxmemory_human|mem_fragmentation_ratio):/ {
      gsub(/\r/, "", $2)
      print $1 "=" $2
    }
  '
}

redis_dbsize() {
  local db size
  require_redis_auth
  for db in {0..15}; do
    size="$(redis_cli -n "${db}" DBSIZE | tr -d '[:space:]')"
    printf 'db%s=%s\n' "${db}" "${size:-?}"
  done
}

redis_metadata() {
  local health_status="unknown"
  local requirepass_configured="unknown"
  if container_is_running; then
    health_status="$("${CONTAINER_RUNTIME}" inspect "${REDIS_CONTAINER}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || printf 'unknown')"
    requirepass_configured="$(
      "${CONTAINER_RUNTIME}" inspect "${REDIS_CONTAINER}" --format '{{json .Args}}' 2>/dev/null \
        | python3 -c 'import json, sys; args=json.load(sys.stdin); print("yes" if "--requirepass" in args else "no")' 2>/dev/null \
        || printf 'unknown'
    )"
    printf 'container=%s\n' "${REDIS_CONTAINER}"
    printf 'container_running=yes\n'
    printf 'container_health=%s\n' "${health_status}"
    printf 'requirepass_configured=%s\n' "${requirepass_configured}"
  else
    printf 'container=%s\n' "${REDIS_CONTAINER}"
    printf 'container_running=no\n'
  fi
  printf 'auth_source=%s\n' "$(auth_source_status || true)"
}

redis_summary() {
  local pong
  redis_metadata
  require_redis_auth
  printf 'auth_used=%s\n' "${REDIS_AUTH_SOURCE}"
  pong="$(redis_cli PING | tr -d '\r')"
  printf 'ping=%s\n' "${pong}"
  redis_memory
  redis_dbsize
}

main() {
  local mode="${1:-summary}"
  case "${mode}" in
    -h | --help | help) usage ;;
    summary) redis_summary ;;
    ping) redis_ping ;;
    memory) redis_memory ;;
    dbsize) redis_dbsize ;;
    metadata) redis_metadata ;;
    *)
      echo "ERROR: unknown mode: ${mode}" >&2
      usage >&2
      return 2
      ;;
  esac
}

main "$@"
