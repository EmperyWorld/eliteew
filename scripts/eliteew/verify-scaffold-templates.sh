#!/usr/bin/env bash
# Gate T lite — scaffold template freeze (Wave F3).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$ROOT/shared/api"
PY="${UV_PROJECT_ENVIRONMENT:-$ROOT/.venv}/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="${PYTHON:-python3}"
fi
cd "$API"
export PYTHONPATH="${PYTHONPATH:-}:.."
exec "$PY" -m api.services.desktop_app_manifests.scaffold_template_freeze
