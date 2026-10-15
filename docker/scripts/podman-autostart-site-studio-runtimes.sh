#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Boot-time (or manual) autostart for Site Studio user runtime pods under
# host/runtime/user_site_studio/*/compose/docker-compose.yml.
# Invariants:
# - Only persisted instance/tenant bindings and matching resource labels may start.
# - Legacy/unbound runtimes are reported and skipped; no slug-based adoption.
# Related:
# - docker/scripts/podman-autostart-all.sh
# - shared/api/services/site_studio_runtime_service.py
# ---

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
RUNTIME_ROOT="$REPO_ROOT/host/runtime/user_site_studio"
if [[ ! -d "$RUNTIME_ROOT" ]]; then
  echo "[site-studio-runtimes] no runtime root: $RUNTIME_ROOT"
  exit 0
fi

exec python3 "$SCRIPT_DIR/site-studio-runtime-ownership.py" autostart --root "$RUNTIME_ROOT" --apply
