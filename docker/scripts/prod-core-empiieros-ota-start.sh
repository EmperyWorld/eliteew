#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent start of stack-empiieros-ota (RO + tmpfs) on prod-core :29181.
# Invariants:
# - Does not ingest capsules; empty tmpfs is a valid healthy state.
# - Refuses to treat host /srv capsule binds as SoT (compose has none).
# Related:
# - docker/stack/stack-empiieros-ota.yml
# - EmpiierOS docs/plans/TZ-EMPIERO-OS-OTA-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker/stack/stack-empiieros-ota.yml"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
HEALTH_URL="${EMPIERO_OS_OTA_HEALTH_URL:-http://127.0.0.1:29181/health}"
FORCE_RECREATE=0

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Start stack-empiieros-ota on prod-core (RO+tmpfs OTA :29181).

Options:
  --recreate   force compose up --force-recreate --build
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

cd "${REPO_ROOT}"

compose() {
	"${CONTAINER_RUNTIME}" compose -f "$COMPOSE_FILE" "$@"
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
	echo "ERROR: missing $COMPOSE_FILE" >&2
	exit 1
fi

# Adversarial honesty: host bind looks like hostpath:/srv/...empiieros-ota
# tmpfs lines are "/srv/empiieros-ota:size=..." (no "host:" prefix before /srv).
if grep -E ':/srv/(eliteew/)?empiieros-ota' "$COMPOSE_FILE" >/dev/null 2>&1; then
	echo "ERROR: host capsule bind detected in $COMPOSE_FILE — refuse start" >&2
	exit 2
fi

if [[ "$FORCE_RECREATE" == 1 ]]; then
	compose up -d --build --force-recreate
else
	if "${CONTAINER_RUNTIME}" inspect stack-empiieros-ota >/dev/null 2>&1; then
		state="$("${CONTAINER_RUNTIME}" inspect -f '{{.State.Status}}' stack-empiieros-ota 2>/dev/null || true)"
		if [[ "$state" == "running" ]] && curl -sf --connect-timeout 2 "$HEALTH_URL" | grep -q ok; then
			echo "stack-empiieros-ota already running (health ok)"
		elif [[ "$state" == "running" ]]; then
			echo "WARN: stack-empiieros-ota running but $HEALTH_URL dead — force-recreate" >&2
			compose up -d --build --force-recreate
		else
			compose up -d --build
		fi
	else
		compose up -d --build
	fi
fi

for _ in 1 2 3 4 5 6 7 8; do
	if curl -sf --connect-timeout 2 "$HEALTH_URL" | grep -q ok; then
		break
	fi
	sleep 2
done

if ! curl -sf --connect-timeout 3 "$HEALTH_URL" | grep -q ok; then
	echo "ERROR: EmpiierOS OTA health failed at $HEALTH_URL" >&2
	exit 1
fi

# Empty edge must fail-closed for current capsule.
code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 \
	http://127.0.0.1:29181/v1/current.json || true)"
if [[ "$code" != "404" ]]; then
	echo "WARN: expected empty-edge /v1/current.json → 404, got HTTP $code" >&2
fi

echo "prod-core EmpiierOS OTA OK: $HEALTH_URL (tmpfs edge; CP ingest later)"
