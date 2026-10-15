#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Hard gate: requirements .in files must not be newer than compiled .lock files.
# Invariants:
# - Called before any stack0 backend/base/prod-baked build; never skipped by SKIP_BASE_IMAGES.
# Related:
# - docker/scripts/build-stack0-backend-images.sh
# - docker/scripts/build-stack0-prod-baked-images.sh
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file; do not execute directly." >&2
  exit 2
fi

stack0_backend_lock_integrity_ctx() {
  if [[ -n "${STACK0_BACKEND_LOCK_CTX:-}" ]]; then
    printf '%s' "${STACK0_BACKEND_LOCK_CTX}"
    return 0
  fi
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
  printf '%s' "$(cd "${script_dir}/../builders/stack0-api" && pwd)"
}

# Compare mtime: fail when lock is older than .in (or missing).
stack0_backend_assert_lock_pair_fresh() {
  local in_file="$1"
  local lock_file="$2"
  if [[ ! -f "${in_file}" ]]; then
    echo "ERROR: missing requirements input: ${in_file}" >&2
    return 1
  fi
  if [[ ! -f "${lock_file}" ]]; then
    echo "[ERROR] Dependency Mismatch: ${lock_file} is stale. Run 'uv pip compile' first." >&2
    return 1
  fi
  if [[ "${in_file}" -nt "${lock_file}" ]]; then
    echo "[ERROR] Dependency Mismatch: ${lock_file} is stale. Run 'uv pip compile' first." >&2
    echo "       Input newer than lock: ${in_file}" >&2
    return 1
  fi
  return 0
}

# All stack0 backend lock pairs (base.in rolls into api.lock via api.in -r base.in).
stack0_backend_assert_all_locks_fresh() {
  local ctx req locks
  ctx="$(stack0_backend_lock_integrity_ctx)"
  req="${ctx}/requirements"
  locks="${req}/locks"
  local failed=0

  stack0_backend_assert_lock_pair_fresh "${req}/base.in" "${locks}/api.lock" || failed=$((failed + 1))
  stack0_backend_assert_lock_pair_fresh "${req}/api.in" "${locks}/api.lock" || failed=$((failed + 1))
  stack0_backend_assert_lock_pair_fresh "${req}/queue-worker.in" "${locks}/queue-worker.lock" || failed=$((failed + 1))
  stack0_backend_assert_lock_pair_fresh "${req}/site-studio-worker.in" "${locks}/site-studio-worker.lock" || failed=$((failed + 1))

  if [[ "${failed}" -gt 0 ]]; then
    echo "ERROR: ${failed} stale lock file(s); recompile with bash docker/builders/stack0-api/scripts/recompile-locks.sh" >&2
    return 1
  fi
  echo "✅ stack0 lock freshness OK (base.in, api.in, queue-worker.in, site-studio-worker.in)"
  return 0
}

stack0_backend_lock_file_sha256() {
  local lock_path="$1"
  sha256sum "${lock_path}" | awk '{print $1}'
}

stack0_backend_collect_build_metadata() {
  local ctx req repo_root
  ctx="$(stack0_backend_lock_integrity_ctx)"
  req="${ctx}/requirements"
  repo_root="$(cd "${ctx}/../../.." && pwd)"
  if git -C "${repo_root}" rev-parse HEAD >/dev/null 2>&1; then
    BUILD_GIT_SHA="$(git -C "${repo_root}" rev-parse HEAD)"
  else
    BUILD_GIT_SHA="${BUILD_GIT_SHA:-unknown}"
  fi
  BUILD_LOCK_HASH="$(stack0_backend_lock_file_sha256 "${req}/locks/api.lock")"
  BUILD_QUEUE_WORKER_LOCK_HASH="$(stack0_backend_lock_file_sha256 "${req}/locks/queue-worker.lock")"
  export BUILD_GIT_SHA BUILD_LOCK_HASH BUILD_QUEUE_WORKER_LOCK_HASH
}
