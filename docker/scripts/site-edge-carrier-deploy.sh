#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Carrier pipeline: build static Site-Image on Heavy-Node → save/scp/load → run on Edge.
# Invariants:
# - Never podman build on Edge; build only locally (command-center).
# - No secrets in argv logs; SSH uses BatchMode keys.
# Related:
# - documentation/platform/SITE-EDGE-CARRIER.md
# - docker/builders/site-edge-carrier/
# ---
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILDER_DIR="${REPO_ROOT}/docker/builders/site-edge-carrier"
CONTENT_STAGING="${BUILDER_DIR}/content"

ASSUME_YES=0
SKIP_BUILD=0
DRY_RUN=0
SLUG=""
CONTENT_DIR=""
TAG="latest"
HOST_PORT=""

SITE_EDGE_SSH="${SITE_EDGE_SSH:-}"
SITE_EDGE_WORKDIR="${SITE_EDGE_WORKDIR:-/var/lib/eliteew/site-edge}"
SITE_EDGE_PUBLISH="${SITE_EDGE_PUBLISH:-}"
PODMAN_PULL="${PODMAN_PULL:-missing}"

usage() {
	cat <<EOF
Usage: $(basename "$0") --slug <slug> --content-dir <path> [options]

Build → transfer → deploy a static Site-Image to the LAN Edge node.

Required:
  --slug NAME              site id (container name site-edge-<slug>, image local/site-edge/<slug>)
  --content-dir PATH       pre-built HTML/JS/assets directory (rsync into build context)

Options:
  --tag TAG                image tag (default: latest)
  --host-port PORT         host publish port (default: SITE_EDGE_PUBLISH or 8080)
  --yes                    non-interactive
  --skip-build             reuse local image (must already exist)
  --dry-run                print actions only
  -h, --help

Env:
  SITE_EDGE_SSH            user@host (required unless dry-run)
  SITE_EDGE_WORKDIR        remote work dir (default: /var/lib/eliteew/site-edge)
  SITE_EDGE_PUBLISH        default host port when --host-port omitted
EOF
}

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
	case "$1" in
		--slug)
			SLUG="${2:-}"
			shift 2
			;;
		--content-dir)
			CONTENT_DIR="${2:-}"
			shift 2
			;;
		--tag)
			TAG="${2:-}"
			shift 2
			;;
		--host-port)
			HOST_PORT="${2:-}"
			shift 2
			;;
		--yes)
			ASSUME_YES=1
			shift
			;;
		--skip-build)
			SKIP_BUILD=1
			shift
			;;
		--dry-run)
			DRY_RUN=1
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			die "unknown option: $1"
			;;
	esac
done

[[ -n "${SLUG}" ]] || die "--slug is required"
[[ "${SLUG}" =~ ^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$ ]] || die "invalid --slug (use lowercase dns-safe label)"

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
	[[ -n "${CONTENT_DIR}" ]] || die "--content-dir is required unless --skip-build"
	[[ -d "${CONTENT_DIR}" ]] || die "content dir not found: ${CONTENT_DIR}"
fi

HOST_PORT="${HOST_PORT:-${SITE_EDGE_PUBLISH:-8080}}"
[[ "${HOST_PORT}" =~ ^[0-9]+$ ]] || die "invalid host port: ${HOST_PORT}"

IMAGE="local/site-edge/${SLUG}:${TAG}"
CONTAINER="site-edge-${SLUG}"
ARCHIVE_BASENAME="site-edge-${SLUG}-${TAG}-$(date +%Y%m%d%H%M%S).tar"

if [[ "${DRY_RUN}" -eq 0 ]]; then
	[[ -n "${SITE_EDGE_SSH}" ]] || die "set SITE_EDGE_SSH=user@edge-host"
	command -v podman >/dev/null 2>&1 || die "podman not found on Heavy-Node"
	command -v rsync >/dev/null 2>&1 || die "rsync not found"
	command -v scp >/dev/null 2>&1 || die "scp not found"
	command -v ssh >/dev/null 2>&1 || die "ssh not found"
fi

if [[ "${ASSUME_YES}" -eq 0 && "${DRY_RUN}" -eq 0 && -t 0 ]]; then
	log "Deploy Site-Image ${IMAGE} → ${SITE_EDGE_SSH} container ${CONTAINER} (:${HOST_PORT})"
	read -r -p "Continue? [y/N] " ans
	[[ "${ans}" =~ ^[yY]$ ]] || exit 0
elif [[ "${ASSUME_YES}" -eq 0 && "${DRY_RUN}" -eq 0 && ! -t 0 ]]; then
	die "pass --yes for non-interactive deploy"
fi

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
	log "=== 1/4: stage content → ${CONTENT_STAGING} ==="
	if [[ "${DRY_RUN}" -eq 1 ]]; then
		log "[dry-run] rsync -a --delete ${CONTENT_DIR}/ ${CONTENT_STAGING}/"
	else
		mkdir -p "${CONTENT_STAGING}"
		rsync -a --delete \
			--exclude '.git/' \
			--exclude 'node_modules/' \
			"${CONTENT_DIR}/" "${CONTENT_STAGING}/"
		# Keep a minimal index if content tree is empty of html
		if [[ ! -f "${CONTENT_STAGING}/index.html" ]]; then
			die "content-dir must contain index.html (got ${CONTENT_DIR})"
		fi
	fi

	log "=== 2/4: podman build ${IMAGE} ==="
	if [[ "${DRY_RUN}" -eq 1 ]]; then
		log "[dry-run] podman build --pull=${PODMAN_PULL} --format docker -t ${IMAGE} ${BUILDER_DIR}"
	else
		podman build --pull="${PODMAN_PULL}" --format docker -t "${IMAGE}" "${BUILDER_DIR}"
	fi
else
	log "=== skip build (--skip-build) ==="
	if [[ "${DRY_RUN}" -eq 0 ]] && ! podman image exists "${IMAGE}"; then
		die "local image missing: ${IMAGE}"
	fi
fi

log "=== 3/4: save → scp → load on ${SITE_EDGE_SSH:-<edge>} ==="
LOCAL_ARCHIVE="/tmp/${ARCHIVE_BASENAME}"
REMOTE_ARCHIVE="${SITE_EDGE_WORKDIR}/images/${ARCHIVE_BASENAME}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
	log "[dry-run] podman save -o ${LOCAL_ARCHIVE} ${IMAGE}"
	log "[dry-run] scp ${LOCAL_ARCHIVE} ${SITE_EDGE_SSH}:${REMOTE_ARCHIVE}"
	log "[dry-run] ssh … podman load -i ${REMOTE_ARCHIVE}"
else
	ssh -o BatchMode=yes -o ConnectTimeout=10 "${SITE_EDGE_SSH}" \
		"mkdir -p '${SITE_EDGE_WORKDIR}/images'"
	podman save -o "${LOCAL_ARCHIVE}" "${IMAGE}"
	scp -o BatchMode=yes "${LOCAL_ARCHIVE}" "${SITE_EDGE_SSH}:${REMOTE_ARCHIVE}"
	# Client-side expansion of archive path is intentional.
	# shellcheck disable=SC2087
	ssh -o BatchMode=yes "${SITE_EDGE_SSH}" bash -s <<REMOTE
set -euo pipefail
podman load -i '${REMOTE_ARCHIVE}'
rm -f '${REMOTE_ARCHIVE}'
REMOTE
	rm -f "${LOCAL_ARCHIVE}"
fi

log "=== 4/4: recreate container ${CONTAINER} ==="
if [[ "${DRY_RUN}" -eq 1 ]]; then
	log "[dry-run] podman stop/rm ${CONTAINER}; podman run -d --name ${CONTAINER} -p ${HOST_PORT}:8080 --restart=unless-stopped ${IMAGE}"
	log "[dry-run] curl health on edge :${HOST_PORT}"
else
	# Client-side expansion of image/container/port is intentional.
	# shellcheck disable=SC2087
	ssh -o BatchMode=yes "${SITE_EDGE_SSH}" bash -s <<REMOTE
set -euo pipefail
mkdir -p '${SITE_EDGE_WORKDIR}'
if podman container exists '${CONTAINER}' 2>/dev/null; then
  podman stop '${CONTAINER}' || true
  podman rm '${CONTAINER}' || true
fi
podman run -d \
  --name '${CONTAINER}' \
  --replace \
  -p '${HOST_PORT}:8080' \
  --restart=unless-stopped \
  '${IMAGE}'
# Prefer rootless-friendly health via published port
for _ in 1 2 3 4 5 6; do
  if curl -sf "http://127.0.0.1:${HOST_PORT}/health" >/dev/null; then
    echo "OK: health on :${HOST_PORT}"
    exit 0
  fi
  sleep 1
done
echo "ERROR: health check failed on :${HOST_PORT}" >&2
podman logs --tail 40 '${CONTAINER}' >&2 || true
exit 1
REMOTE
fi

log "OK: Carrier deploy complete (${IMAGE} → ${SITE_EDGE_SSH:-dry-run}:${HOST_PORT})"
