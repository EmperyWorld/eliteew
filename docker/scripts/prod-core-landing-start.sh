#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent start (or recreate) of stack0-eliteew-landing on prod-core :29002.
# Invariants:
# - Safe for autostart and manual ops; does not build images on prod-core.
# Related:
# - prod-core-landing-lib.sh, podman-autostart-prod-core.sh, eliteew-landing-start.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-core-landing-lib.sh
source "${SCRIPT_DIR}/prod-core-landing-lib.sh"

FORCE_RECREATE=0

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Start pod_stack0-landing / stack0-eliteew-landing on prod-core.

Options:
  --recreate   force pod+container recreate from local image
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--recreate)
			FORCE_RECREATE=1
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 2
			;;
	esac
done

prod_core_landing_start "${FORCE_RECREATE}"
