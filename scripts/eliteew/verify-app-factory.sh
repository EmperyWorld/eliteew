#!/usr/bin/env bash
# EliteEW app factory DoD (Wave F2) — D1 mount quality, D2 registry, D3 manifest.
# Usage:
#   bash scripts/eliteew/verify-app-factory.sh project_about notifications
#   bash scripts/eliteew/verify-app-factory.sh --all-manifests
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$ROOT/shared/api"
PY="${UV_PROJECT_ENVIRONMENT:-$ROOT/.venv}/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="${PYTHON:-python3}"
fi
cd "$API"
export PYTHONPATH="${PYTHONPATH:-}:.."
exec "$PY" -m api.services.desktop_app_manifests.factory_verify_cli "$@"
