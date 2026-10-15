#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# DEWA dispatch: start landing pod on prod-core (.111) via SSH.
# Invariants:
# - Does not build images; use eliteew-landing-deploy.sh for image refresh.
# Related:
# - prod-core-landing-start.sh, eliteew-landing-deploy.sh
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"

ASSUME_YES=0
FORCE_RECREATE=0

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Start stack0-eliteew-landing on prod-core (pod start or recreate if pod missing).

Options:
  --yes        skip confirmation (DEWA dispatch)
  --recreate   force container recreate from image already on prod-core
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--yes)
			ASSUME_YES=1
			shift
			;;
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

if [[ "${ASSUME_YES}" -eq 0 && ! -t 0 ]]; then
	echo "ERROR: pass --yes for non-interactive DEWA dispatch" >&2
	exit 1
fi

if [[ "${ASSUME_YES}" -eq 0 && -t 0 ]]; then
	read -r -p "Start landing on ${DEWA_OPS_PROD_CORE_SSH}? [y/N] " ans
	[[ "${ans}" =~ ^[yY] ]] || exit 0
fi

_remote_flags=()
if [[ "${FORCE_RECREATE}" -eq 1 ]]; then
	_remote_flags+=(--recreate)
fi

if dewa_ops_is_dry_run; then
	dewa_ops_log_dry_run "ssh ${DEWA_OPS_PROD_CORE_SSH} prod-core-landing-start.sh ${_remote_flags[*]:-}"
	exit 0
fi

ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s <<REMOTE
set -euo pipefail
REPO="\${REPO_ROOT:-${DEWA_OPS_REMOTE_REPO}}"
cd "\${REPO}"
bash docker/scripts/prod-core-landing-start.sh ${_remote_flags[@]+"${_remote_flags[@]}"}
REMOTE

echo "✅ landing start complete on ${DEWA_OPS_PROD_CORE_SSH}"
