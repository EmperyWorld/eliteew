#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Preflight for desktop-client Version SoT + signed OTA publish readiness.
# Invariants:
# - Never prints secret values; only set/missing and semver drift.
# - Does not build, publish, or rsync — operator runs follow-up commands printed at end.
# Modes:
# - --tree-only: TREE mirrors + CHANNEL_MATRIX header (no network, no signing secrets)
# - --integrity-only: tree + live latest.json/latest.v2 + matrix (no signing secrets)
# - default: integrity + release signing/capsule env for publish
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-VERSION-SOT.md
# - pack-organization/connection-agent/docs/release-state.v1.json
# - scripts/eliteew/desktop-client-bump-version.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DC="${ROOT}/pack-organization/connection-agent"
PKG="${DC}/package.json"
CARGO="${DC}/src-tauri/Cargo.toml"
TAURI="${DC}/src-tauri/tauri.conf.json"
APP_VER="${DC}/src/lib/launcher/appVersion.ts"
STATE="${DC}/docs/release-state.v1.json"
CONNECTED_OTA="${DESKTOP_CLIENT_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/desktop-client-updates}"
FOFLINE_OTA="${FOFLINE_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/fofline-updates}"
CHANNEL="${OTA_PREFLIGHT_CHANNEL:-both}"
MODE="full"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--connected-only)
		CHANNEL="connected"
		shift
		;;
	--fofline-only)
		CHANNEL="fofline"
		shift
		;;
	--tree-only)
		MODE="tree"
		shift
		;;
	--integrity-only)
		MODE="integrity"
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
warn() { echo "WARN: $*" >&2; }

echo "=== TREE_SEMVER parity ==="
tree_ver="$(
	python3 - "$PKG" "$CARGO" "$TAURI" "$APP_VER" "$STATE" <<'PY'
import json
import re
import sys
from pathlib import Path

pkg_p, cargo_p, tauri_p, app_p, state_p = sys.argv[1:6]
pkg = json.loads(Path(pkg_p).read_text(encoding="utf-8"))
tree = str(pkg.get("version") or "").strip()
if not re.fullmatch(r"\d+\.\d+\.\d+", tree):
    print(f"BAD\tinvalid package.json version {tree!r}", file=sys.stderr)
    sys.exit(2)

cargo = Path(cargo_p).read_text(encoding="utf-8")
m_cargo = re.search(r'(?m)^version\s*=\s*"([^"]+)"', cargo)
cargo_v = m_cargo.group(1) if m_cargo else ""
tauri = json.loads(Path(tauri_p).read_text(encoding="utf-8"))
tauri_v = str(tauri.get("version") or "").strip()
app = Path(app_p).read_text(encoding="utf-8")
m_app = re.search(r"export const APP_VERSION = '([^']+)'", app)
app_v = m_app.group(1) if m_app else ""
state = json.loads(Path(state_p).read_text(encoding="utf-8"))
state_v = str(state.get("tree_semver") or "").strip()
schema = str(state.get("schema") or "").strip()

mirrors = {
    "Cargo.toml": cargo_v,
    "tauri.conf.json": tauri_v,
    "APP_VERSION": app_v,
    "release-state.tree_semver": state_v,
}
bad = {k: v for k, v in mirrors.items() if v != tree}
if schema != "eliteew.desktop-client.release-state.v1":
    print(f"BAD\trelease-state schema {schema!r}", file=sys.stderr)
    sys.exit(2)
if bad:
    detail = ", ".join(f"{k}={v!r}" for k, v in sorted(bad.items()))
    print(f"BAD\tmirror mismatch vs package.json={tree!r}: {detail}", file=sys.stderr)
    sys.exit(2)

# Matrix structural rules
allowed = {"live", "lag", "hold", "omitted"}
channels = state.get("channels")
if not isinstance(channels, dict) or not channels:
    print("BAD\trelease-state channels missing", file=sys.stderr)
    sys.exit(2)
for ch_name, plats in channels.items():
    if not isinstance(plats, dict):
        print(f"BAD\tchannels.{ch_name} not object", file=sys.stderr)
        sys.exit(2)
    for plat, row in plats.items():
        if not isinstance(row, dict):
            print(f"BAD\t{ch_name}.{plat} not object", file=sys.stderr)
            sys.exit(2)
        status = str(row.get("status") or "").strip()
        semver = str(row.get("semver") or "").strip()
        reason = str(row.get("reason") or "").strip()
        if status not in allowed:
            print(f"BAD\t{ch_name}.{plat} status={status!r}", file=sys.stderr)
            sys.exit(2)
        if status == "live":
            if semver != tree:
                print(
                    f"BAD\t{ch_name}.{plat} status=live but semver={semver!r} != TREE {tree!r}",
                    file=sys.stderr,
                )
                sys.exit(2)
        elif status in {"lag", "hold", "omitted"}:
            if not reason:
                print(f"BAD\t{ch_name}.{plat} status={status} requires reason", file=sys.stderr)
                sys.exit(2)
            if status in {"lag", "hold"} and not re.fullmatch(r"\d+\.\d+\.\d+", semver):
                print(f"BAD\t{ch_name}.{plat} status={status} needs semver", file=sys.stderr)
                sys.exit(2)

print(tree)
PY
)" || {
	bad "TREE_SEMVER / CHANNEL_MATRIX parity (see stderr)"
	tree_ver=""
}

if [[ -n "${tree_ver}" ]]; then
	ok "TREE_SEMVER ${tree_ver} mirrors + matrix header"
fi

check_channel_integrity() {
	local name="$1"
	local base="$2"
	local tmp_legacy tmp_v2
	tmp_legacy="$(mktemp)"
	tmp_v2="$(mktemp)"
	# shellcheck disable=SC2064
	trap "rm -f '${tmp_legacy}' '${tmp_v2}'" RETURN

	if ! curl -sf --max-time 15 "${base%/}/latest.json" -o "$tmp_legacy"; then
		bad "${name}: fetch ${base%/}/latest.json"
		return 1
	fi
	if ! curl -sf --max-time 15 "${base%/}/latest.v2.json" -o "$tmp_v2"; then
		bad "${name}: fetch ${base%/}/latest.v2.json"
		return 1
	fi

	python3 - "$name" "$tree_ver" "$STATE" "$tmp_legacy" "$tmp_v2" <<'PY'
import json
import sys
from pathlib import Path

name, tree, state_p, legacy_p, v2_p = sys.argv[1:6]
state = json.loads(Path(state_p).read_text(encoding="utf-8"))
legacy = json.loads(Path(legacy_p).read_text(encoding="utf-8"))
v2 = json.loads(Path(v2_p).read_text(encoding="utf-8"))

leg_ver = str(legacy.get("version") or "").strip()
v2_ver = str(v2.get("version") or "").strip()
if not leg_ver or not v2_ver:
    print(f"FAIL: {name}: missing version in latest.json and/or latest.v2.json", file=sys.stderr)
    sys.exit(1)
if leg_ver != v2_ver:
    print(
        f"FAIL: {name}: collapse latest.json={leg_ver!r} != latest.v2={v2_ver!r}",
        file=sys.stderr,
    )
    sys.exit(1)

plats_legacy = legacy.get("platforms") or {}
plats_v2 = v2.get("platforms") or {}
rpm_key = "linux-x86_64-rpm"
alias = "linux-x86_64"
has_rpm = rpm_key in plats_legacy or rpm_key in plats_v2 or alias in plats_legacy or alias in plats_v2
seq = v2.get("sequence")
print(f"OK: {name} live {leg_ver} (latest==v2) sequence={seq} platforms_legacy={sorted(plats_legacy)} platforms_v2={sorted(plats_v2)}")

ch = ((state.get("channels") or {}).get(name) or {})
row = ch.get(rpm_key)
if not isinstance(row, dict):
    print(f"FAIL: {name}: CHANNEL_MATRIX missing {rpm_key}", file=sys.stderr)
    sys.exit(1)
status = str(row.get("status") or "").strip()
matrix_semver = str(row.get("semver") or "").strip()
reason = str(row.get("reason") or "").strip()

if not has_rpm and status != "omitted":
    print(
        f"FAIL: {name}: public metadata has no linux RPM keys but matrix status={status!r}",
        file=sys.stderr,
    )
    sys.exit(1)

if has_rpm and matrix_semver != leg_ver:
    print(
        f"FAIL: {name}: matrix {rpm_key} semver={matrix_semver!r} != live {leg_ver!r}",
        file=sys.stderr,
    )
    sys.exit(1)

if status == "live":
    if leg_ver != tree:
        print(
            f"FAIL: {name}: matrix live but public {leg_ver!r} != TREE {tree!r}",
            file=sys.stderr,
        )
        sys.exit(1)
elif status in {"lag", "hold"}:
    if leg_ver == tree:
        print(
            f"WARN: {name}: matrix status={status} but live already equals TREE {tree}",
            file=sys.stderr,
        )
    print(f"OK: {name} intentional {status} live={leg_ver} TREE={tree} reason={reason}")
elif status == "omitted":
    print(f"OK: {name} linux RPM omitted ({reason})")
else:
    print(f"FAIL: {name}: unknown matrix status {status!r}", file=sys.stderr)
    sys.exit(1)

# Windows lag surface (informational / fail if matrix claims live wrongly)
win = ch.get("windows-x86_64")
if isinstance(win, dict):
    w_status = str(win.get("status") or "")
    w_semver = str(win.get("semver") or "")
    w_reason = str(win.get("reason") or "")
    print(f"OK: {name} windows-x86_64 matrix status={w_status} semver={w_semver} reason={w_reason}")
    if "windows_x86_64" in plats_legacy or "windows-x86_64" in plats_legacy:
        # rare dual-OS metadata; do not invent strict compare without shared key
        pass
    elif w_status == "live" and tree != w_semver:
        print(
            f"FAIL: {name}: windows matrix live={w_semver!r} != TREE {tree!r}",
            file=sys.stderr,
        )
        sys.exit(1)
PY
}

if [[ "${MODE}" != "tree" ]]; then
	echo "=== Live OTA integrity (latest.json vs latest.v2 + CHANNEL_MATRIX) ==="
	if [[ -z "${tree_ver}" ]]; then
		bad "skip live integrity — TREE_SEMVER unresolved"
	else
		if [[ "${CHANNEL}" == "connected" || "${CHANNEL}" == "both" ]]; then
			check_channel_integrity "connected" "${CONNECTED_OTA}" || fail=1
		fi
		if [[ "${CHANNEL}" == "fofline" || "${CHANNEL}" == "both" ]]; then
			check_channel_integrity "fofline" "${FOFLINE_OTA}" || fail=1
		fi
	fi
fi

if [[ "${MODE}" == "full" ]]; then
	echo "=== Release build env (presence only) ==="
	if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" || ( -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -f "${TAURI_SIGNING_PRIVATE_KEY_PATH}" ) ]]; then
		ok "TAURI signing key configured"
	else
		bad "TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH required for signed OTA"
	fi

	hex32_ok() {
		local name="$1"
		local value="${!name:-}"
		[[ "${#value}" -eq 64 ]] && [[ "${value}" =~ ^[0-9a-fA-F]+$ ]] && [[ "${value}" != *REPLACE_WITH* ]]
	}

	if hex32_ok DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY; then
		ok "Connected metadata signing seed set (64 hex)"
	else
		bad "DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY required for latest.v2"
	fi
	if hex32_ok FOFLINE_UPDATE_METADATA_SIGNING_KEY; then
		ok "FoFline metadata signing seed set (64 hex)"
	else
		bad "FOFLINE_UPDATE_METADATA_SIGNING_KEY required — do not sign FoFline latest.v2 with Connected seed"
	fi

	if hex32_ok ELITEEW_DESKTOP_CAPSULE_SIGNING_PK; then
		ok "ELITEEW_DESKTOP_CAPSULE_SIGNING_PK set (64 hex)"
	elif bash "${ROOT}/scripts/eliteew/desktop-client-capsule-bake-env.sh" >/dev/null 2>&1; then
		ok "capsule bake env derivable (signing PK from stack0 env and/or capsule JSON)"
	else
		bad "ELITEEW_DESKTOP_CAPSULE_SIGNING_PK missing — derive via desktop-client-capsule-bake-env.sh"
	fi
	if hex32_ok ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK; then
		warn "ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK is set but unused in Wave 4 retail (prefer unset)"
	fi
	if bash "${ROOT}/scripts/eliteew/desktop-client-capsule-bake-env.sh" >/dev/null 2>&1; then
		ok "capsule bake env OK (signing only)"
	else
		bad "desktop-client-capsule-bake-env.sh failed (signing key)"
	fi
	if [[ "${ELITEEW_CAPSULE_DEV_KEYS:-}" =~ ^(1|true|yes|on)$ ]]; then
		bad "ELITEEW_CAPSULE_DEV_KEYS must be off for release builds"
	fi

	echo "=== stack0 line (optional) ==="
	st="$(bash "${ROOT}/docker/scripts/eliteew-deploy.sh" hotfix stack0 status 2>/dev/null || true)"
	if echo "$st" | grep -q 'local state       : baked'; then
		ok "stack0 baked line active"
	else
		warn "stack0 not on baked line (publish can proceed; SPA coupling may differ on dev-bind)"
	fi
fi

echo ""
if [[ "${MODE}" == "tree" ]]; then
	echo "=== Next ==="
	echo "bash scripts/eliteew/desktop-client-ota-release-preflight.sh --integrity-only"
elif [[ "${MODE}" == "integrity" ]]; then
	echo "=== Next (publish env) ==="
	echo "bash scripts/eliteew/desktop-client-ota-release-preflight.sh"
else
	echo "=== Next (after preflight green) ==="
	cat <<EOF
# RPM-only one-shot (no AppImage / no Windows EXE):
bash scripts/eliteew/desktop-client-ota-release.sh --rpm-only
# Or manual:
cd pack-organization/connection-agent && bash scripts/bundle.sh --bundles rpm --with-signing-config
cd pack-organization/connection-agent && bash scripts/build-linux-fofline.sh --with-signing-config
bash scripts/eliteew/desktop-client-publish-update.sh --version ${tree_ver:-X.Y.Z} --rpm …/rpm --sig …/rpm.sig
bash scripts/eliteew/fofline-publish-update.sh --version ${tree_ver:-X.Y.Z} --rpm …/FoFline.rpm --sig …/rpm.sig
# NOTE: new version + RPM-only stage omits windows/AppImage from latest.json / latest.v2.
# Windows lag seats stay on matrix windows-x86_64 until the next NSIS wave.
# Seat preflight + human stamp:
bash scripts/eliteew/desktop-client-fedora-e2e-checklist.sh --version ${tree_ver:-X.Y.Z}
# Then rsync docker/data/*-updates/ → prod-core /srv/eliteew/ (do not prune dest).
EOF
fi

if [[ "${fail}" -ne 0 ]]; then
	echo ""
	echo "BLOCKED: fix FAIL items (see DESKTOP-CLIENT-VERSION-SOT.md)." >&2
	exit 1
fi

case "${MODE}" in
tree)
	echo "READY: TREE_SEMVER ${tree_ver} parity OK."
	;;
integrity)
	echo "READY: TREE + CHANNEL_MATRIX + live integrity OK for ${tree_ver}."
	;;
*)
	echo "READY: env OK for signed release build of ${tree_ver}."
	;;
esac
