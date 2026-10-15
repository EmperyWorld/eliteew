#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent start of stack-mobile-release (OTA nginx) on prod-core :29180.
# Invariants:
# - Does not build or publish APK; only ensures compose up + health/manifest smoke.
# - Safe for boot autostart; uses restart: unless-stopped from stack-mobile-release.yml.
# Related:
# - docker/scripts/mobile-release-stack.sh
# - docker/scripts/podman-autostart-prod-core.sh
# - documentation/product/mobile/MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md (W0)
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker/stack/stack-mobile-release.yml"
ENV_FILE="${REPO_ROOT}/docker/env_file/.env.stack-mobile-release"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
HEALTH_URL="${MOBILE_RELEASE_HEALTH_URL:-http://127.0.0.1:29180/health}"
MANIFEST_URL="${MOBILE_RELEASE_MANIFEST_URL:-http://127.0.0.1:29180/v1/manifest.json}"
FORCE_RECREATE=0

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Start stack-mobile-release on prod-core (OTA :29180).

Options:
  --recreate   force compose up --force-recreate
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
	if [[ -f "$ENV_FILE" ]]; then
		"${CONTAINER_RUNTIME}" compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
	else
		"${CONTAINER_RUNTIME}" compose -f "$COMPOSE_FILE" "$@"
	fi
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
	echo "ERROR: missing $COMPOSE_FILE" >&2
	exit 1
fi

if [[ ! -s "${REPO_ROOT}/local/binaries/empery-mobile.manifest.json" ]]; then
	echo "WARN: local/binaries/empery-mobile.manifest.json missing — OTA container may serve empty tree" >&2
fi

if [[ "$FORCE_RECREATE" == 1 ]]; then
	compose up -d --force-recreate
else
	# Idempotent: create/start if absent; recreate only when host health is dead
	# (rootless pasta can leave "running" container without 127.0.0.1 publish).
	if "${CONTAINER_RUNTIME}" inspect stack-mobile-release >/dev/null 2>&1; then
		state="$("${CONTAINER_RUNTIME}" inspect -f '{{.State.Status}}' stack-mobile-release 2>/dev/null || true)"
		if [[ "$state" == "running" ]] && curl -sf --connect-timeout 2 "$HEALTH_URL" | grep -q ok; then
			echo "stack-mobile-release already running (health ok)"
		elif [[ "$state" == "running" ]]; then
			echo "WARN: stack-mobile-release running but $HEALTH_URL dead — force-recreate" >&2
			compose up -d --force-recreate
		else
			compose up -d
		fi
	else
		compose up -d
	fi
fi

# Wait briefly for health
for _ in 1 2 3 4 5 6; do
	if curl -sf --connect-timeout 2 "$HEALTH_URL" | grep -q ok; then
		break
	fi
	sleep 2
done

if ! curl -sf --connect-timeout 3 "$HEALTH_URL" | grep -q ok; then
	echo "ERROR: OTA health failed at $HEALTH_URL" >&2
	exit 1
fi

if ! curl -sf --connect-timeout 3 "$MANIFEST_URL" >/dev/null; then
	echo "ERROR: OTA manifest failed at $MANIFEST_URL" >&2
	exit 1
fi

echo "prod-core mobile OTA OK: $MANIFEST_URL"
curl -sf "$MANIFEST_URL" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("  version=%s (%s) apk_available=%s" % (d.get("version_name"), d.get("version_code"), d.get("apk_available")))
'
