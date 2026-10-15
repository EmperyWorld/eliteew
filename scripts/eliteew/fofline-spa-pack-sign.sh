#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Sign a FoFline SPA pack with Tauri updater signer (ops helper).
# Invariants:
# - Never invents .sig; requires TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH.
# - Does not commit keys; runs pnpm exec tauri signer from pack-organization/connection-agent.
# Related:
# - pack-organization/connection-agent/packaging/signing/README.md
# - scripts/eliteew/fofline-spa-pack-publish.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DC="${ROOT}/pack-organization/connection-agent"
PACK=""

while [[ $# -gt 0 ]]; do
	case "$1" in
	--pack)
		PACK="${2:-}"
		shift 2
		;;
	-h | --help)
		sed -n '2,14p' "$0"
		cat <<EOF

Usage:
  export TAURI_SIGNING_PRIVATE_KEY_PATH=/path/to/updater.key   # or TAURI_SIGNING_PRIVATE_KEY=…
  bash scripts/eliteew/fofline-spa-pack-sign.sh --pack path/to/*.tar.zst

Produces sibling .sig via: pnpm exec tauri signer sign <pack>
Then: bash scripts/eliteew/fofline-spa-pack-publish.sh --pack … --sig ….sig
EOF
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ -z "${PACK}" ]]; then
	echo "FAIL: --pack is required" >&2
	exit 2
fi
if [[ ! -f "${PACK}" ]]; then
	echo "FAIL: pack not found: ${PACK}" >&2
	exit 1
fi

KEY_OK=0
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
	KEY_OK=1
fi
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -f "${TAURI_SIGNING_PRIVATE_KEY_PATH}" ]]; then
	KEY_OK=1
fi
if [[ "${KEY_OK}" -ne 1 ]]; then
	echo "FAIL: set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH (file must exist)" >&2
	echo "HINT: same updater keypair as FoFline shell OTA; never invent .sig for publish." >&2
	exit 1
fi
if [[ ! -d "${DC}" ]]; then
	echo "FAIL: desktop-client missing: ${DC}" >&2
	exit 1
fi

# Pilot/unencrypted keys still prompt unless password env is present (even empty).
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD+x}" ]]; then
	export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
fi

ABS_PACK="$(cd "$(dirname "${PACK}")" && pwd)/$(basename "${PACK}")"
(
	cd "${DC}"
	pnpm exec tauri signer sign "${ABS_PACK}"
)

SIG="${ABS_PACK}.sig"
if [[ ! -f "${SIG}" ]]; then
	echo "FAIL: expected signature missing after signer: ${SIG}" >&2
	exit 1
fi
echo "OK: signed ${SIG}"
echo "Next: bash scripts/eliteew/fofline-spa-pack-publish.sh --pack ${ABS_PACK} --sig ${SIG}"
