#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression helper for stack0 build integrity gates: lock freshness, import probes, metadata.
# Invariants:
# - Unit modes do not mutate repo requirements; live modes need local podman images.
# Related:
# - docker/scripts/stack0-backend-lock-integrity.sh
# - docker/scripts/stack0-backend-import-probe.sh
# - docker/scripts/build-stack0-backend-images.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

# shellcheck source=stack0-backend-lock-integrity.sh
source "${SCRIPT_DIR}/stack0-backend-lock-integrity.sh"
# shellcheck source=stack0-backend-import-probe.sh
source "${SCRIPT_DIR}/stack0-backend-import-probe.sh"

usage() {
  cat <<EOF
Usage:
  bash docker/scripts/$(basename "$0") --lock-fresh
  bash docker/scripts/$(basename "$0") --stale-lock-negative
  bash docker/scripts/$(basename "$0") --import-negative
  bash docker/scripts/$(basename "$0") --import-live [API_IMAGE] [QUEUE_WORKER_IMAGE]
  bash docker/scripts/$(basename "$0") --metadata IMAGE_REF

  --lock-fresh           Assert all stack0 .lock files are fresh vs .in (repo state).
  --stale-lock-negative  Prove stale-lock gate fails (temp files; no repo mutation).
  --import-negative      Prove import probe rejects image without /opt/venv bcrypt stack.
  --import-live          Run api + queue-worker import probes on local images.
  --metadata             podman|docker inspect BUILD_GIT_SHA / BUILD_LOCK_HASH on IMAGE_REF.
EOF
}

run_lock_fresh() {
  echo ">>> lock freshness (repo)"
  stack0_backend_assert_all_locks_fresh
  echo "PASS: all stack0 locks fresh"
}

run_stale_lock_negative() {
  echo ">>> stale lock negative (synthetic pair)"
  local tmp in_file lock_file
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/stack0-lock-gate.XXXXXX")"
  in_file="${tmp}/sample.in"
  lock_file="${tmp}/sample.lock"
  printf 'package-a\n' >"${in_file}"
  printf 'package-a==1.0.0\n' >"${lock_file}"
  sleep 1
  touch "${in_file}"
  if stack0_backend_assert_lock_pair_fresh "${in_file}" "${lock_file}"; then
    echo "FAIL: stale lock gate should reject newer .in" >&2
    exit 1
  fi
  echo "PASS: stale lock gate rejected outdated lock"
}

run_import_negative() {
  echo ">>> import probe negative (stdlib-only image)"
  local probe_image="${STACK0_BUILD_INTEGRITY_NEGATIVE_IMAGE:-docker.io/library/python:3.12-slim-bookworm}"
  if stack0_backend_probe_api_venv_image "${probe_image}"; then
    echo "FAIL: import probe should reject image without bcrypt/jwt venv" >&2
    exit 1
  fi
  echo "PASS: import probe rejected ${probe_image}"
}

run_import_live() {
  local api_image queue_image
  api_image="${1:-$(_load_env_image STACK0_API_IMAGE eliteew-api:v3)}"
  queue_image="${2:-$(_load_env_image STACK0_QUEUE_WORKER_IMAGE "${api_image}")}"
  echo ">>> import probe live: api=${api_image} queue=${queue_image}"
  stack0_backend_probe_backend_base_images "${api_image}" "${queue_image}"
  echo "PASS: live import probes OK"
}

_load_env_image() {
  local key="$1"
  local default="$2"
  local env_file="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
  local val=""
  if [[ -f "${env_file}" ]]; then
    val="$(
      grep -E "^${key}=" "${env_file}" 2>/dev/null \
        | tail -n 1 \
        | cut -d= -f2- \
        | sed 's/^"\(.*\)"$/\1/' \
        | sed "s/^'\(.*\)'$/\1/"
    )"
  fi
  printf '%s' "${val:-${default}}"
}

_env_value_from_inspect() {
  local image_ref="$1"
  local key="$2"
  "${CONTAINER_RUNTIME}" inspect -f "{{range .Config.Env}}{{println .}}{{end}}" "${image_ref}" \
    | sed -n "s/^${key}=//p" \
    | head -n 1
}

_label_from_inspect() {
  local image_ref="$1"
  local label_key="$2"
  "${CONTAINER_RUNTIME}" inspect -f "{{index .Config.Labels \"${label_key}\"}}" "${image_ref}" 2>/dev/null || true
}

run_metadata() {
  local image_ref="${1:-}"
  if [[ -z "${image_ref}" ]]; then
    echo "ERROR: --metadata requires IMAGE_REF" >&2
    exit 2
  fi
  if ! "${CONTAINER_RUNTIME}" image exists "${image_ref}" 2>/dev/null; then
    echo "ERROR: image not found locally: ${image_ref}" >&2
    exit 1
  fi
  echo ">>> metadata inspect: ${image_ref}"
  stack0_backend_collect_build_metadata
  local env_git env_lock label_git label_lock
  env_git="$(_env_value_from_inspect "${image_ref}" "BUILD_GIT_SHA")"
  env_lock="$(_env_value_from_inspect "${image_ref}" "BUILD_LOCK_HASH")"
  label_git="$(_label_from_inspect "${image_ref}" "org.eliteew.build.git_sha")"
  label_lock="$(_label_from_inspect "${image_ref}" "org.eliteew.build.lock_hash")"

  if [[ -z "${env_git}" || "${env_git}" == "unknown" ]]; then
    echo "FAIL: BUILD_GIT_SHA missing or unknown in image ENV" >&2
    exit 1
  fi
  if [[ -z "${env_lock}" || "${env_lock}" == "unknown" ]]; then
    echo "FAIL: BUILD_LOCK_HASH missing or unknown in image ENV" >&2
    exit 1
  fi
  if [[ "${env_git}" != "${label_git}" ]]; then
    echo "FAIL: BUILD_GIT_SHA ENV/label mismatch (${env_git} vs ${label_git})" >&2
    exit 1
  fi
  if [[ "${env_lock}" != "${label_lock}" ]]; then
    echo "FAIL: BUILD_LOCK_HASH ENV/label mismatch" >&2
    exit 1
  fi
  if [[ "${env_lock}" != "${BUILD_LOCK_HASH}" ]]; then
    echo "WARN: image BUILD_LOCK_HASH != current api.lock sha256 (image may be from older build)" >&2
    echo "      image=${env_lock} current=${BUILD_LOCK_HASH}" >&2
  fi
  echo "PASS: metadata OK BUILD_GIT_SHA=${env_git} BUILD_LOCK_HASH=${env_lock}"
}

case "${1:-}" in
  --lock-fresh)
    run_lock_fresh
    ;;
  --stale-lock-negative)
    run_stale_lock_negative
    ;;
  --import-negative)
    run_import_negative
    ;;
  --import-live)
    shift
    run_import_live "${1:-}" "${2:-}"
    ;;
  --metadata)
    shift
    run_metadata "${1:-}"
    ;;
  -h | --help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
