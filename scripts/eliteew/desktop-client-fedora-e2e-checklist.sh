#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Preflight (command-center) + printed Fedora seat E2E checklist for desktop-client.
# Invariants:
# - Does not invent license keys or print secrets; only checks presence/HTTP.
# - Exit 0 = CC preflight + human stamp; exit 10 = preflight green, human seat pending.
# - Default version tracks tree publish target (override DESKTOP_CLIENT_E2E_VERSION).
#   FoFline uses `/fofline-updates/` — publish the same semver on both channels.
# - Default packaging = Linux RPM-only: AppImage and windows-x86_64 are NOT required
#   unless --require-appimage / --require-windows (or env) for a dual-OS wave.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §Wave 3a / Post-3b.1 #2
# - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md desktop-client-016
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${DESKTOP_CLIENT_E2E_VERSION:-0.4.63}"
PUBLIC_OTA="${DESKTOP_CLIENT_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/desktop-client-updates}"
HANDOFF="${ROOT}/docker/data/portal-private-tunnel/handoff-pilot"
# 1 = require AppImage in handoff + latest.json; 0 = RPM OK without AppImage (0.4.3+ channel).
REQUIRE_APPIMAGE="${DESKTOP_CLIENT_E2E_REQUIRE_APPIMAGE:-0}"
# 1 = require windows-x86_64 in latest.json (approved dual-OS / major NSIS wave only).
REQUIRE_WINDOWS="${DESKTOP_CLIENT_E2E_REQUIRE_WINDOWS:-0}"
MARK_HUMAN=0

while [[ $# -gt 0 ]]; do
	case "$1" in
	--version)
		VERSION="${2:-}"
		shift 2
		;;
	--require-appimage)
		REQUIRE_APPIMAGE=1
		shift
		;;
	--require-windows)
		REQUIRE_WINDOWS=1
		shift
		;;
	--rpm-only)
		REQUIRE_APPIMAGE=0
		REQUIRE_WINDOWS=0
		shift
		;;
	--mark-human-done)
		MARK_HUMAN=1
		shift
		;;
	-h | --help)
		sed -n '2,20p' "$0"
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

fail=0
ok() { echo "OK: $*"; }
bad() { echo "FAIL: $*" >&2; fail=1; }

echo "=== CC preflight (desktop-client ${VERSION}) ==="

st="$(bash "${ROOT}/docker/scripts/eliteew-deploy.sh" hotfix stack0 status 2>/dev/null || true)"
if echo "$st" | grep -q 'local state       : baked'; then
	ok "stack0 local state baked"
else
	bad "stack0 not on baked line"
fi

if curl -sf --max-time 10 https://app.eliteew.ru/api/health >/dev/null; then
	ok "public /api/health"
else
	bad "public /api/health"
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
if curl -sf --max-time 15 "${PUBLIC_OTA%/}/latest.json" -o "$tmp"; then
	eval "$(python3 - "$tmp" "$VERSION" <<'PY'
import json, sys
from pathlib import Path
doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
want = sys.argv[2]
ver = str(doc.get("version") or "")
plats = sorted((doc.get("platforms") or {}).keys())
print(f"ver={ver!r}")
print(f"plats={','.join(plats)!r}")
print(f"want={want!r}")
print(f"has_rpm={1 if 'linux-x86_64-rpm' in plats else 0}")
print(f"has_appimage={1 if 'linux-x86_64' in plats else 0}")
print(f"has_windows={1 if 'windows-x86_64' in plats else 0}")
PY
)"
	# shellcheck disable=SC2154
	if [[ "$ver" == "$VERSION" ]]; then
		ok "OTA latest.json version=$ver platforms=[$plats]"
	else
		bad "OTA version=$ver expected=$VERSION"
	fi
	# Prefer RPM platform key (first-install RPM clients); AppImage optional.
	# shellcheck disable=SC2154
	if [[ "${has_rpm:-0}" -eq 1 ]]; then
		ok "OTA has linux-x86_64-rpm"
	elif [[ "${has_appimage:-0}" -eq 1 ]]; then
		ok "OTA has linux-x86_64 (AppImage; no rpm key)"
	else
		bad "OTA missing linux-x86_64-rpm and linux-x86_64"
	fi
	if [[ "$REQUIRE_APPIMAGE" -eq 1 ]]; then
		if [[ "${has_appimage:-0}" -eq 1 ]]; then
			ok "OTA has linux-x86_64 (required)"
		else
			bad "OTA missing linux-x86_64 (REQUIRE_APPIMAGE=1)"
		fi
	fi
	# shellcheck disable=SC2154
	if [[ "$REQUIRE_WINDOWS" -eq 1 ]]; then
		if [[ "${has_windows:-0}" -eq 1 ]]; then
			ok "OTA has windows-x86_64 (required)"
		else
			bad "OTA missing windows-x86_64 (REQUIRE_WINDOWS=1 / dual-OS wave)"
		fi
	elif [[ "${has_windows:-0}" -eq 1 ]]; then
		ok "OTA has windows-x86_64 (optional)"
	else
		ok "OTA RPM-only (windows-x86_64 not required; packaging policy)"
	fi
else
	bad "fetch ${PUBLIC_OTA%/}/latest.json"
fi

if compgen -G "${HANDOFF}/ota-${VERSION}/*.rpm" >/dev/null; then
	ok "handoff ota-${VERSION} rpm present"
else
	bad "missing rpm under handoff-pilot/ota-${VERSION}/"
fi
if [[ "$REQUIRE_APPIMAGE" -eq 1 ]]; then
	if compgen -G "${HANDOFF}/ota-${VERSION}/*.AppImage" >/dev/null; then
		ok "handoff ota-${VERSION} AppImage present"
	else
		bad "missing AppImage under handoff-pilot/ota-${VERSION}/"
	fi
else
	if compgen -G "${HANDOFF}/ota-${VERSION}/*.AppImage" >/dev/null; then
		ok "handoff ota-${VERSION} AppImage present (optional)"
	else
		ok "handoff ota-${VERSION} RPM-only (AppImage not required)"
	fi
fi

if [[ -d "${HANDOFF}/user-1" ]]; then
	if [[ -f "${HANDOFF}/user-1/desktop-client-user-1.conf" && -f "${HANDOFF}/user-1/desktop-client-user-1.license.txt" ]]; then
		ok "user-1 handoff conf+license files present (do not print)"
	else
		bad "user-1 handoff incomplete"
	fi
else
	bad "missing handoff-pilot/user-1/"
fi

# Prefer seat JSON if present (desktop-client-014); do not fail if only legacy license.txt.
if compgen -G "${HANDOFF}/user-1/eliteew-seat-*.json" >/dev/null \
	|| compgen -G "${HANDOFF}/user-1/*seat*.json" >/dev/null; then
	ok "user-1 seat package JSON present"
else
	ok "user-1 seat JSON optional (legacy license.txt path still valid)"
fi

echo
echo "=== Fedora seat checklist (human) ==="
cat <<EOF
On the pilot Fedora host (contract seat):

1) Install ${VERSION} rpm from handoff-pilot/ota-${VERSION}/ (signed OTA or local rpm).
2) Prefer: Home → «Импортировать пакет места» (eliteew-seat-*.json) if issued;
   else legacy: paste WG conf → Verify → Install (pkexec) → Bring up → Activate license.
   Expect: chip «Режим: …» (not raw client-offline-ai); wg-quick@wg-portal active when cloud.
3) Shell: «Открыть облачный рабочий стол» (only if allow_online).
   Expect Start URL has eliteewDesktopClient=1 + eliteewLicenseId + eliteewDeviceId
   (cold restart after redeem must still carry both — #015 hydration).
4) SPA desktopNative → Keycloak empery-desktop → session/assert (no fail-closed logout on match).
5) Updater: Check updates → up_to_date on ${VERSION}; after install expect «Перезапустить» CTA.
6) Optional: offline catalog; window close / tray Выйти ends Keycloak session then exits; WG bring-down / re-up.

When all green, on command-center:
  bash scripts/eliteew/desktop-client-fedora-e2e-checklist.sh --version ${VERSION} --mark-human-done
EOF

stamp="${HANDOFF}/ota-${VERSION}/FEDORA-E2E-${VERSION}.ok"
if [[ "$MARK_HUMAN" -eq 1 ]]; then
	if [[ "$fail" -ne 0 ]]; then
		echo "FAIL: refuse --mark-human-done while CC preflight red" >&2
		exit 1
	fi
	date -u +"%Y-%m-%dT%H:%M:%SZ operator=human fedora-e2e ${VERSION}" >"$stamp"
	ok "wrote $stamp"
	echo "PASS fedora-e2e (CC preflight + human stamp)"
	exit 0
fi

if [[ -f "$stamp" ]]; then
	ok "human stamp already present: $stamp"
	echo "PASS fedora-e2e (preflight + existing stamp)"
	exit 0
fi

if [[ "$fail" -ne 0 ]]; then
	echo "FAIL: CC preflight" >&2
	exit 1
fi
echo "WAIT: CC preflight green — run Fedora seat steps, then --mark-human-done"
exit 10
