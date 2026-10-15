#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Host-aware bundle for EliteEW desktop-client (Wave 5 + O2).
# Invariants:
# - Linux default: rpm only. Signed OTA (O2): rpm via --with-signing-config.
#   AppImage build is paused (2026-08-08) — pass --bundles appimage only if ops explicitly need it.
# - Windows: nsis (tauri.windows.conf.json merge).
# - Does not invent signing keys; --with-signing-config requires real pubkey.
# Related:
# - packaging/signing/README.md
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WITH_SIGNING=0
BUNDLE=""
while [[ $# -gt 0 ]]; do
	case "$1" in
	--with-signing-config)
		WITH_SIGNING=1
		shift
		;;
	--bundles)
		BUNDLE="${2:-}"
		shift 2
		;;
	-h | --help)
		cat <<EOF
Usage: bash scripts/bundle.sh [--bundles rpm|nsis|appimage|rpm,appimage] [--with-signing-config]

  (no --bundles)  auto: rpm on Linux, nsis on Windows/MSYS
  --with-signing-config  merge src-tauri/tauri.conf.signing.example.json
                         (replace pubkey first — fail closed if placeholder)
                         On Linux without --bundles: builds rpm only (AppImage paused)
EOF
		exit 0
		;;
	*)
		echo "unknown arg: $1" >&2
		exit 2
		;;
	esac
done

uname_s="$(uname -s 2>/dev/null || echo unknown)"
case "${BUNDLE}" in
"")
	case "${uname_s}" in
	Linux*)
		# AppImage paused — signed and unsigned Linux builds are RPM-only unless --bundles overrides.
		BUNDLE="rpm"
		;;
	MINGW* | MSYS* | CYGWIN* | Windows_NT) BUNDLE="nsis" ;;
	*)
		echo "FAIL: unsupported host ${uname_s}; pass --bundles rpm|nsis" >&2
		exit 1
		;;
	esac
	;;
rpm | nsis | appimage | rpm,appimage | appimage,rpm) ;;
*)
	echo "FAIL: --bundles must be rpm|nsis|appimage|rpm,appimage" >&2
	exit 1
	;;
esac

if [[ "${uname_s}" == Linux* && "${BUNDLE}" == *rpm* ]]; then
	bash "${ROOT}/scripts/ensure-linux-build-deps.sh"
fi

if [[ "${BUNDLE}" == *appimage* ]]; then
	echo "WARN: AppImage is paused for product OTA (2026-08-08); building only because --bundles requested it." >&2
fi
if [[ "${BUNDLE}" == "nsis" && "${uname_s}" == Linux* ]]; then
	echo "WARN: NSIS on Linux usually needs a Windows build host or a maintained cross toolchain." >&2
	echo "WARN: Prefer building nsis on Windows; continuing only if your toolchain supports it." >&2
fi

ARGS=(tauri build --bundles "${BUNDLE}")
if [[ "${WITH_SIGNING}" -eq 1 ]]; then
	EXAMPLE="${ROOT}/src-tauri/tauri.conf.signing.example.json"
	# Merge must NOT override plugins.updater.pubkey (0.4.7 incident: REPLACE_WITH baked → signing_required, OTA dead).
	if grep -qE 'REPLACE_WITH|"pubkey"' "${EXAMPLE}"; then
		echo "FAIL: tauri.conf.signing.example.json must only toggle createUpdaterArtifacts/targets — never pubkey (keep pubkey in tauri.conf.json)" >&2
		exit 1
	fi
	if ! grep -q '"createUpdaterArtifacts"[[:space:]]*:[[:space:]]*true' "${EXAMPLE}"; then
		echo "FAIL: signing merge conf must set createUpdaterArtifacts=true" >&2
		exit 1
	fi
	# Tauri CLI reads TAURI_SIGNING_PRIVATE_KEY (content), not *_PATH — mirror FoFline/Windows loaders.
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
	ARGS+=(--config "${EXAMPLE}")
fi

if [[ "${BUNDLE}" == *appimage* ]]; then
	# Fedora/EL: linuxdeploy bundled strip fails on ELF .relr.dyn — skip strip.
	export APPIMAGE_EXTRACT_AND_RUN="${APPIMAGE_EXTRACT_AND_RUN:-1}"
	export NO_STRIP="${NO_STRIP:-1}"
	echo "OK: AppImage env APPIMAGE_EXTRACT_AND_RUN=${APPIMAGE_EXTRACT_AND_RUN} NO_STRIP=${NO_STRIP}"
fi

echo "OK: bundling target=${BUNDLE} signing=${WITH_SIGNING}"
pnpm exec "${ARGS[@]}"
