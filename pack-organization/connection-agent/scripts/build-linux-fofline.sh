#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Clean FoFline Linux RPM bake (no ALSA/PKG_CONFIG shims, no post-build RPM rename).
# Invariants:
# - Runs ensure-linux-build-deps.sh first (system alsa-lib-devel required).
# - productName "EliteEW FoFline" → Tauri RPM name EliteEW_FoFline-*.rpm (spaces→underscores; do not mv).
# - --with-signing-config: load TAURI_SIGNING_PRIVATE_KEY from PATH if unset; then signer sign RPM
#   (Tauri createUpdaterArtifacts does not treat rpm as updater target — .sig is via tauri signer).
# - Windows FoFline NSIS is residual — this script is Linux-only.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11
# - scripts/eliteew/fofline-publish-update.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash "${ROOT}/scripts/ensure-linux-build-deps.sh"

FOFLINE_CONF="${ROOT}/src-tauri/tauri.conf.fofline.example.json"
if [[ ! -f "${FOFLINE_CONF}" ]]; then
	echo "FAIL: missing ${FOFLINE_CONF}" >&2
	exit 1
fi

ARGS=(tauri build --bundles rpm --config "${FOFLINE_CONF}")

WITH_SIGNING=0
while [[ $# -gt 0 ]]; do
	case "$1" in
	--with-signing-config)
		WITH_SIGNING=1
		shift
		;;
	-h | --help)
		cat <<EOF
Usage: bash scripts/build-linux-fofline.sh [--with-signing-config]

  Builds FoFline Linux RPM via tauri.conf.fofline.example.json.
  Requires system alsa-lib-devel (see ensure-linux-build-deps.sh).
  Artifact name is EliteEW_FoFline-<ver>-1.x86_64.rpm from productName (no rename).
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
	# Bundler wants KEY in env; PATH alone fails createUpdaterArtifacts. Signer accepts either.
	if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
		if [[ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -f "${TAURI_SIGNING_PRIVATE_KEY_PATH}" ]]; then
			TAURI_SIGNING_PRIVATE_KEY="$(cat "${TAURI_SIGNING_PRIVATE_KEY_PATH}")"
			export TAURI_SIGNING_PRIVATE_KEY
			# CLI rejects KEY + PATH together.
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

echo "OK: FoFline Linux RPM build signing=${WITH_SIGNING}"
# createUpdaterArtifacts=true still warns for rpm-only targets; bake may exit non-zero after RPM exists.
set +e
pnpm exec "${ARGS[@]}"
BUILD_RC=$?
set -e

VER="$(jq -r .version "${ROOT}/package.json")"
if [[ -z "${VER}" || "${VER}" == "null" ]]; then
	echo "FAIL: cannot read package.json version" >&2
	exit 1
fi
RPM_DIR="${ROOT}/src-tauri/target/release/bundle/rpm"
# Exact version only — never pick leftover EliteEW_FoFline-0.4.22 when baking 0.4.24.
CANDIDATES=(
	"${RPM_DIR}/EliteEW FoFline-${VER}-1.x86_64.rpm"
	"${RPM_DIR}/EliteEW_FoFline-${VER}-1.x86_64.rpm"
)
RPM=""
for cand in "${CANDIDATES[@]}"; do
	if [[ -f "${cand}" ]]; then
		RPM="${cand}"
		break
	fi
done
if [[ -z "${RPM}" || ! -f "${RPM}" ]]; then
	echo "FAIL: FoFline RPM ${VER} not found after build (rc=${BUILD_RC})" >&2
	ls -la "${RPM_DIR}" | rg -i "FoFline|${VER}" >&2 || true
	exit "${BUILD_RC:-1}"
fi
echo "OK: FoFline RPM artifact ${RPM}"

if [[ "${WITH_SIGNING}" -eq 1 ]]; then
	SIG="${RPM}.sig"
	# Bundler may already write .sig when KEY is in env; re-sign only if missing.
	if [[ ! -f "${SIG}" ]]; then
		pnpm exec tauri signer sign "${RPM}"
	fi
	if [[ ! -f "${SIG}" ]]; then
		echo "FAIL: expected signature missing: ${SIG}" >&2
		exit 1
	fi
	echo "OK: signed ${SIG}"
	echo "Next: bash scripts/eliteew/fofline-publish-update.sh --version ${VER} --rpm \"${RPM}\" --sig \"${SIG}\""
elif [[ "${BUILD_RC}" -ne 0 ]]; then
	exit "${BUILD_RC}"
fi
