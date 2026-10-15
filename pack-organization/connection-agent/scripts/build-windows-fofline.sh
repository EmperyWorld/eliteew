#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Host-side FoFline Windows NSIS wrapper (bash). Guest uses pnpm build:windows:fofline (no bash).
# Invariants:
# - productName/identifier stay FoFline (world.empery.fofline) — not Desktop Connected.
# - --bundles nsis; WireGuard MSI embed via tauri.windows.conf.json resources.
# - Guest path: ELITEEW_WIN_PNPM_SCRIPT=build:windows:fofline (direct tauri CLI in package.json).
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11.5 / L4
# - scripts/eliteew/desktop-client-build-windows-remote.sh build-fofline
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FOFLINE_CONF="${ROOT}/src-tauri/tauri.conf.fofline.example.json"
WIN_CONF="${ROOT}/src-tauri/tauri.windows.conf.json"
FOFLINE_WIN_CONF="${ROOT}/src-tauri/tauri.conf.fofline.windows.example.json"
if [[ ! -f "${FOFLINE_CONF}" ]]; then
	echo "FAIL: missing ${FOFLINE_CONF}" >&2
	exit 1
fi
if [[ ! -f "${WIN_CONF}" ]]; then
	echo "FAIL: missing ${WIN_CONF}" >&2
	exit 1
fi
if [[ ! -f "${FOFLINE_WIN_CONF}" ]]; then
	echo "FAIL: missing ${FOFLINE_WIN_CONF}" >&2
	exit 1
fi

if [[ -x "${ROOT}/packaging/windows/fetch-wireguard-msi.sh" ]]; then
	bash "${ROOT}/packaging/windows/fetch-wireguard-msi.sh"
fi

# fofline.windows: createUpdaterArtifacts=false (sign .sig on host after pull)
ARGS=(tauri build --bundles nsis --config "${FOFLINE_CONF}" --config "${WIN_CONF}" --config "${FOFLINE_WIN_CONF}")

WITH_SIGNING=0
while [[ $# -gt 0 ]]; do
	case "$1" in
	--with-signing-config)
		WITH_SIGNING=1
		shift
		;;
	-h | --help)
		cat <<EOF
Usage: bash scripts/build-windows-fofline.sh [--with-signing-config]

  Builds FoFline Windows NSIS (EliteEW FoFline / world.empery.fofline).
  Prefer headless guest: ELITEEW_WIN_PNPM_SCRIPT=build:windows:fofline \\
    bash scripts/eliteew/desktop-client-build-windows-remote.sh build
EOF
		exit 0
		;;
	*)
		echo "unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ "${WITH_SIGNING}" -eq 1 ]]; then
	EXAMPLE="${ROOT}/src-tauri/tauri.conf.signing.example.json"
	if grep -qE 'REPLACE_WITH|"pubkey"' "${EXAMPLE}"; then
		echo "FAIL: signing merge must not override pubkey" >&2
		exit 1
	fi
	ARGS+=(--config "${EXAMPLE}")
	if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
		if [[ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -f "${TAURI_SIGNING_PRIVATE_KEY_PATH}" ]]; then
			TAURI_SIGNING_PRIVATE_KEY="$(cat "${TAURI_SIGNING_PRIVATE_KEY_PATH}")"
			export TAURI_SIGNING_PRIVATE_KEY
			unset TAURI_SIGNING_PRIVATE_KEY_PATH
		else
			echo "FAIL: set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH for --with-signing-config" >&2
			exit 1
		fi
	else
		unset TAURI_SIGNING_PRIVATE_KEY_PATH || true
	fi
	if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD+x}" ]]; then
		export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
	fi
fi

echo "[STEP] pnpm exec ${ARGS[*]}"
pnpm exec "${ARGS[@]}"
echo "OK: FoFline Windows NSIS under src-tauri/target/release/bundle/nsis/"
