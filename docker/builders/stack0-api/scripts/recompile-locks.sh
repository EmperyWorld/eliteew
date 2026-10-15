#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regenerate stack0 backend uv lock files after editing requirements/*.in or constraints.txt.
# Invariants:
# - Run from repo root or any cwd; uses docker/builders/stack0-api as context.
# - Celery targets reuse deps-api venv in Dockerfile — no separate celery *.lock files.
# Related:
# - docker/scripts/stack0-backend-lock-integrity.sh
# - documentation/platform/docker-re_doc/STACK0-BACKEND-IMAGES.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CTX="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CTX}/../../.." && pwd)"

if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv not found in PATH" >&2
  exit 1
fi

REQ="${CTX}/requirements"
LOCKS="${REQ}/locks"
CONSTRAINTS="${CTX}/constraints.txt"

compile_one() {
  local in_file="$1"
  local lock_file="$2"
  shift 2
  echo ">>> uv pip compile ${in_file} -> ${lock_file}"
  uv pip compile "${in_file}" -o "${lock_file}" --python-version 3.14 "$@"
}

compile_one "${REQ}/api.in" "${LOCKS}/api.lock" -c "${CONSTRAINTS}"
compile_one "${REQ}/queue-worker.in" "${LOCKS}/queue-worker.lock" \
  -c "${CONSTRAINTS}" -c "${LOCKS}/api.lock"
compile_one "${REQ}/site-studio-worker.in" "${LOCKS}/site-studio-worker.lock" \
  -c "${CONSTRAINTS}"

echo "✅ stack0 locks recompiled (api, queue-worker, site-studio-worker)"
echo "   Verify: bash ${REPO_ROOT}/docker/scripts/verify-stack0-build-integrity-gate.sh --lock-fresh"
