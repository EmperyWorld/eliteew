#!/usr/bin/env bash
# Validate shared/apps/*/app.manifest.yaml + legacy KNOWN union.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$ROOT/shared/api"
PY="${UV_PROJECT_ENVIRONMENT:-$ROOT/.venv}/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="${PYTHON:-python3}"
fi
cd "$API"
export PYTHONPATH="${PYTHONPATH:-}:.."
exec "$PY" -m api.services.desktop_app_manifests.validate
