#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build site_prod Next landing on command-center, export image to prod-core, recreate :29002.
# Invariants:
# - pnpm/podman build only on command-center; prod-core loads image and runs container.
# - Source: shared/web/site_prod (legacy shared/web/landing tree not edited).
# Related:
# - shared/web/site_prod/run-podman-secure.sh, prod-core-landing-lib.sh
# - documentation/product/SITE-PROD-LANDING.md
# - documentation/platform/docker-re_doc/STACK-CONTAINER-CONTROL.md
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"

ASSUME_YES=0
SKIP_BUILD=0

LANDING_DIR="${DEWA_OPS_REPO_ROOT}/shared/web/site_prod"
LANDING_IMAGE="${LANDING_IMAGE:-local/eliteew-site-prod:secure}"
PODMAN_PULL="${PODMAN_PULL:-missing}"

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Build site_prod landing image on command-center → save/load on prod-core → recreate :29002.

Options:
  --yes               skip confirmation (non-interactive)
  --skip-build        skip podman build (image must exist locally)
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--yes)
		ASSUME_YES=1
		shift
		;;
	--skip-build)
		SKIP_BUILD=1
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
	echo "ERROR: pass --yes for non-interactive deploy" >&2
	exit 1
fi

if [[ "${ASSUME_YES}" -eq 0 && -t 0 ]]; then
	echo "Deploy site_prod landing to ${DEWA_OPS_PROD_CORE_SSH} (build on command-center)."
	read -r -p "Continue? [y/N] " ans
	[[ "${ans}" =~ ^[yY] ]] || exit 0
fi

dewa_ops_require_podman
[[ -d "${LANDING_DIR}" ]] || {
	echo "ERROR: missing ${LANDING_DIR}" >&2
	exit 1
}
[[ -f "${LANDING_DIR}/Dockerfile" ]] || {
	echo "ERROR: missing ${LANDING_DIR}/Dockerfile" >&2
	exit 1
}

run_cmd() {
	if dewa_ops_is_dry_run; then
		dewa_ops_log_dry_run "$*"
	else
		"$@"
	fi
}

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
	echo "=== Step 1/3: podman build ${LANDING_IMAGE} (pnpm inside Dockerfile) ==="
	run_cmd bash -c "cd '${LANDING_DIR}' && podman build --pull='${PODMAN_PULL}' --format docker --tag '${LANDING_IMAGE}' ."
else
	echo ">>> SKIP local build (--skip-build)"
	if ! dewa_ops_is_dry_run && ! dewa_ops_podman_image_exists "${LANDING_IMAGE}"; then
		echo "ERROR: image not found locally: ${LANDING_IMAGE}" >&2
		exit 1
	fi
fi

echo "=== Step 2/3: export image → ${DEWA_OPS_PROD_CORE_SSH} ==="
if dewa_ops_is_dry_run; then
	dewa_ops_log_dry_run "podman save ${LANDING_IMAGE} | ssh load + recreate"
else
	archive="/tmp/eliteew-site-prod-secure-$(date +%Y%m%d%H%M).tar"
	podman save -o "${archive}" "${LANDING_IMAGE}"
	remote_archive="/tmp/$(basename "${archive}")"
	scp "${archive}" "${DEWA_OPS_PROD_CORE_SSH}:${remote_archive}"
	ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s <<REMOTE
set -euo pipefail
RT="\${ELITEEW_CONTAINER_RUNTIME:-podman}"
"\${RT}" load -i "${remote_archive}"
rm -f "${remote_archive}"
REMOTE
	rm -f "${archive}"
fi

echo "=== Step 3/3: recreate landing pod on prod-core ==="
if dewa_ops_is_dry_run; then
	dewa_ops_log_dry_run "ssh prod-core prod-core-landing-start.sh --recreate"
else
	ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s <<REMOTE
set -euo pipefail
REPO="\${REPO_ROOT:-${DEWA_OPS_REMOTE_REPO}}"
cd "\${REPO}"
# Force image from command-center deploy (prod-core git tree may lag).
export LANDING_IMAGE="${LANDING_IMAGE}"
bash docker/scripts/prod-core-landing-start.sh --recreate
REMOTE
fi

echo "✅ site_prod landing deploy complete (${LANDING_IMAGE} → ${DEWA_OPS_PROD_CORE_SSH}:29002)"
