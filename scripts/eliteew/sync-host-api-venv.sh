#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install host backend venv (.venv) from the same stack0 api.lock as prod Docker images.
# Invariants:
# - Prod dependency canon: docker/builders/stack0-api/requirements/ (not legacy torch/spacy pins).
# - Canonical venv path: .venv (never shared/api/.venv).
# Related:
# - documentation/platform/TESTING-STRATEGY.md §Host venv
# - scripts/eliteew/backend-venv-env.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=backend-venv-env.sh
source "${ROOT}/scripts/eliteew/backend-venv-env.sh"

eliteew_backend_venv_init "${ROOT}"
eliteew_backend_venv_guard

STACK0_CTX="${ROOT}/docker/builders/stack0-api"
API_REQ="${ROOT}/shared/api/requirements.txt"
VENV_PY="${ELITEEW_HOST_VENV}/bin/python"

if [[ ! -f "${STACK0_CTX}/requirements/locks/api.lock" ]]; then
  echo "ERROR: missing ${STACK0_CTX}/requirements/locks/api.lock" >&2
  exit 1
fi

# Source builds of C extensions need Python.h (Fedora: python3-devel).
_py_ver="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
if [[ ! -f "/usr/include/python${_py_ver}/Python.h" ]]; then
  echo "WARNING: /usr/include/python${_py_ver}/Python.h missing — any package without a binary wheel will fail to compile." >&2
  echo "  Fedora fix: sudo dnf install -y python3-devel" >&2
  echo "  (Prefer locks with cp${_py_ver//./} wheels; httptools must be >=0.8 on Python 3.14.)" >&2
fi

echo ">>> uv sync (pyproject dev extras)"
(
  cd "${ELITEEW_API}"
  UV_PROJECT_ENVIRONMENT="${ELITEEW_HOST_VENV}" uv sync --extra dev
)

echo ">>> uv pip install prod stack (api.in + api.lock + constraints)"
uv pip install --index-strategy unsafe-best-match \
  --python "${VENV_PY}" \
  -c "${STACK0_CTX}/constraints.txt" \
  -c "${STACK0_CTX}/requirements/locks/api.lock" \
  -r "${API_REQ}"

echo "✅ Host API venv aligned with stack0 api.lock"
echo "   Python: ${VENV_PY}"
echo "   Re-lock after .in edits: bash ${STACK0_CTX}/scripts/recompile-locks.sh"
