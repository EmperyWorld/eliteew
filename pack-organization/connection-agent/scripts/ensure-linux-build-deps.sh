#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Fail-closed Linux host preflight for Tauri RPM builds (vanilla + FoFline).
# Invariants:
# - Requires system pkg-config `alsa` (Fedora: alsa-lib-devel) — no ~/.local ALSA/PKG_CONFIG shims.
# - Does not install packages (ops install with dnf); does not mutate PKG_CONFIG_PATH to hide missing devel.
# - End users never see this script — ops/build host only.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# - scripts/bundle.sh / pnpm run build:linux:fofline
# ---
set -euo pipefail

if [[ "$(uname -s 2>/dev/null || echo unknown)" != Linux* ]]; then
	echo "OK: ensure-linux-build-deps skipped (not Linux)"
	exit 0
fi

# Refuse known user-local ALSA devel shims (prior build crutches).
# Even if PKG_CONFIG_PATH points there, system alsa.pc must win via default search paths.
_shim_roots=(
	"${HOME}/.local/alsa-devel-3008206"
	"${HOME}/.local/deps"
)
for root in "${_shim_roots[@]}"; do
	if [[ -d "${root}" ]]; then
		case ":${PKG_CONFIG_PATH:-}:" in
		*":${root}/lib64/pkgconfig:"* | *":${root}/usr/lib64/pkgconfig:"* | *":${root}/lib/pkgconfig:"*)
			echo "FAIL: PKG_CONFIG_PATH includes ALSA shim under ${root}" >&2
			echo "FAIL: unset that path and install OS package instead:" >&2
			echo "FAIL:   sudo dnf install -y alsa-lib-devel" >&2
			exit 1
			;;
		esac
	fi
done

if ! command -v pkg-config >/dev/null 2>&1; then
	echo "FAIL: pkg-config missing — install pkgconf-pkg-config (Fedora) before Tauri RPM build" >&2
	exit 1
fi

# Probe with a clean PKG_CONFIG_PATH so only system/vendor paths count.
_clean_pc="$(
	PKG_CONFIG_PATH= pkg-config --exists alsa 2>/dev/null && echo ok || echo missing
)"
if [[ "${_clean_pc}" != ok ]]; then
	echo "FAIL: system pkg-config module 'alsa' not found (alsa-lib-devel missing)." >&2
	echo "FAIL: command-center ops install (not an end-user step):" >&2
	echo "FAIL:   sudo dnf install -y alsa-lib-devel" >&2
	echo "FAIL: then re-run: pkg-config --exists alsa && pkg-config --modversion alsa" >&2
	exit 1
fi

_ver="$(PKG_CONFIG_PATH= pkg-config --modversion alsa 2>/dev/null || echo unknown)"
echo "OK: system alsa pkg-config ${_ver} (no user-local shim)"
