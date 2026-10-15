#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Periodic status writer for Podman egress policy on prod-core (user systemd).
# Related: apply-podman-egress-lock.sh --write-status
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLY="${HOME}/bin/eliteew-podman-egress-lock.sh"
if [[ ! -x "$APPLY" ]]; then
  APPLY="${SCRIPT_DIR}/apply-podman-egress-lock.sh"
fi
exec bash "$APPLY" --write-status
