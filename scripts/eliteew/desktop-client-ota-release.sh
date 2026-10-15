#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Build + stage signed RPM-only OTA for Connected + FoFline at tree semver.
# Invariants:
# - RPM only — no AppImage, no Windows NSIS/EXE in this wave.
# - Fail-closed without capsule bake env + TAURI signing key + product metadata seeds.
# - Stages under docker/data/*-updates; does not rsync to prod-core (operator step).
# - Prod sync must not use a destructive dest prune: FoFline volume also holds spa-latest
#   and SPA packs; Connected volume holds denylist.json. Windows NSIS blobs may remain.
# Related:
# - scripts/eliteew/desktop-client-ota-release-preflight.sh
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DC="${ROOT}/pack-organization/connection-agent"
HANDOFF="${ROOT}/docker/data/portal-private-tunnel/handoff-pilot"
UPDATER="${HANDOFF}/updater"
CONNECTED_META_PUBKEY="23c0e20fd622b0882f343b73e87ec77bd780ef33025cdc15d71be05e990cbdae"
FOFLINE_META_PUBKEY="d757086ddf665032e4b14711d268d3744d76cd0cd30c23bf459dd5a0caef889a"

# Pack-layout door guard (Wave 3): org agent ≠ cloud mobile
if [[ "${ELITEEW_PACK_RELEASE:-}" == "cloud" && "${ELITEEW_PACK_ALLOW_CROSS_DOOR:-0}" != "1" ]]; then
	echo "ERROR: ELITEEW_PACK_RELEASE=cloud forbids pack-organization Connection Agent OTA." >&2
	echo "  Use eemobile / mobile-apk-release-cycle.sh for Mobile," >&2
	echo "  or set ELITEEW_PACK_ALLOW_CROSS_DOOR=1 for an explicit ops exception." >&2
	exit 1
fi
echo "[pack-organization] Connection Agent OTA — not part of cloud/mobile release (eemobile)."
if [[ ! -d "${DC}" ]]; then
	echo "ERROR: connection-agent tree missing: ${DC}" >&2
	exit 1
fi

load_hex_key() {
	local var="$1"
	local file="$2"
	if [[ -z "${!var:-}" && -f "${file}" ]]; then
		export "${var}=$(tr -d '\n' < "${file}")"
	fi
}

assert_metadata_seed_pubkey() {
	local env_name="$1"
	local expected="$2"
	python3 - "${env_name}" "${expected}" <<'PY'
import os
import sys
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

name, expected = sys.argv[1], sys.argv[2].lower()
seed = os.environ.get(name, "").strip()
if len(seed) != 64:
    print(f"FAIL: {name} must be a 32-byte hex seed", file=sys.stderr)
    raise SystemExit(2)
pk = (
    Ed25519PrivateKey.from_private_bytes(bytes.fromhex(seed))
    .public_key()
    .public_bytes_raw()
    .hex()
)
if pk != expected:
    print(f"FAIL: {name} does not match baked metadata pubkey", file=sys.stderr)
    raise SystemExit(2)
print(f"OK: {name} matches baked metadata pubkey")
PY
}

seed_local_v2_from_live() {
	local live_url="$1"
	local dest="$2"
	python3 - "${live_url}" "${dest}" <<'PY'
import json
import sys
import urllib.request
from pathlib import Path

url, dest_s = sys.argv[1], sys.argv[2]
dest = Path(dest_s)
try:
    with urllib.request.urlopen(url, timeout=20) as response:
        live = json.loads(response.read())
except Exception as exc:
    print(f"FAIL: cannot fetch live signed metadata from {url}: {exc}", file=sys.stderr)
    raise SystemExit(2)
live_seq = int(live.get("sequence") or 0)
if live_seq < 1:
    print(f"FAIL: live signed metadata at {url} has no sequence", file=sys.stderr)
    raise SystemExit(2)
local_seq = 0
if dest.is_file():
    try:
        local_seq = int(json.loads(dest.read_text(encoding="utf-8")).get("sequence") or 0)
    except Exception:
        local_seq = 0
if local_seq < live_seq:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(live, indent=2) + "\n", encoding="utf-8")
    print(f"OK: seeded local signed metadata sequence={live_seq} from public channel")
else:
    print(f"OK: local signed metadata sequence={local_seq} >= live {live_seq}")
PY
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--linux-only | --rpm-only)
		# Default behavior; accepted for CLI compatibility.
		shift
		;;
	-h | --help)
		sed -n '2,16p' "$0"
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

find_rpm_artifact() {
	local dir="$1"
	local ver="$2"
	local kind="$3" # connected | fofline
	python3 - "$dir" "$ver" "$kind" <<'PY'
from pathlib import Path
import sys
directory, ver, kind = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
if not directory.is_dir():
    raise SystemExit(0)
needles = {
    "connected": (
        f"EliteEW Desktop Client-{ver}-1.x86_64.rpm",
        f"EliteEW_Desktop_Client-{ver}-1.x86_64.rpm",
    ),
    "fofline": (
        f"EliteEW FoFline-{ver}-1.x86_64.rpm",
        f"EliteEW_FoFline-{ver}-1.x86_64.rpm",
    ),
}[kind]
for name in needles:
    path = directory / name
    if path.is_file():
        print(path)
        raise SystemExit(0)
# fallback: newest matching version rpm for kind tokens
tokens = ("Desktop Client", "Desktop_Client") if kind == "connected" else ("FoFline",)
cands = []
for path in directory.glob(f"*{ver}-1.x86_64.rpm"):
    if path.name.endswith(".sig"):
        continue
    if any(t in path.name for t in tokens):
        cands.append(path)
if cands:
    print(max(cands, key=lambda p: p.stat().st_mtime))
PY
}

VER="$(jq -r .version "${DC}/package.json")"
echo "=== OTA release wave ${VER} (RPM only — no AppImage / no EXE) ==="

load_hex_key DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY \
	"${UPDATER}/DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY.hex"
load_hex_key FOFLINE_UPDATE_METADATA_SIGNING_KEY \
	"${UPDATER}/FOFLINE_UPDATE_METADATA_SIGNING_KEY.hex"
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -f "${UPDATER}/desktop-client-updater.key" ]]; then
	TAURI_SIGNING_PRIVATE_KEY="$(cat "${UPDATER}/desktop-client-updater.key")"
	export TAURI_SIGNING_PRIVATE_KEY
	export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
fi
assert_metadata_seed_pubkey DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY "${CONNECTED_META_PUBKEY}"
assert_metadata_seed_pubkey FOFLINE_UPDATE_METADATA_SIGNING_KEY "${FOFLINE_META_PUBKEY}"

eval "$(bash "${ROOT}/scripts/eliteew/desktop-client-capsule-bake-env.sh" --export)"
bash "${ROOT}/scripts/eliteew/desktop-client-ota-release-preflight.sh"

RPM_DIR="${DC}/src-tauri/target/release/bundle/rpm"
SKIP_CONNECTED_BUILD=0
CONNECTED_RPM="$(find_rpm_artifact "${RPM_DIR}" "${VER}" connected || true)"
if [[ -n "${CONNECTED_RPM}" && -f "${CONNECTED_RPM}" && -f "${CONNECTED_RPM}.sig" ]]; then
	echo "OK: reuse Connected RPM ${CONNECTED_RPM}"
	SKIP_CONNECTED_BUILD=1
fi

if [[ "${SKIP_CONNECTED_BUILD}" -eq 0 ]]; then
	echo "=== Build Connected RPM ==="
	(cd "${DC}" && bash scripts/bundle.sh --bundles rpm --with-signing-config)
	CONNECTED_RPM="$(find_rpm_artifact "${RPM_DIR}" "${VER}" connected || true)"
fi
CONNECTED_SIG="${CONNECTED_RPM}.sig"
if [[ -z "${CONNECTED_RPM}" || ! -f "${CONNECTED_RPM}" || ! -f "${CONNECTED_SIG}" ]]; then
	echo "FAIL: Connected RPM/sig missing for ${VER} under ${RPM_DIR}" >&2
	exit 1
fi

echo "=== Build FoFline RPM ==="
(cd "${DC}" && bash scripts/build-linux-fofline.sh --with-signing-config)

FOFLINE_RPM="$(find_rpm_artifact "${RPM_DIR}" "${VER}" fofline || true)"
FOFLINE_SIG="${FOFLINE_RPM}.sig"
if [[ -z "${FOFLINE_RPM}" || ! -f "${FOFLINE_RPM}" || ! -f "${FOFLINE_SIG}" ]]; then
	echo "FAIL: FoFline RPM/sig missing for ${VER} under ${RPM_DIR}" >&2
	exit 1
fi

echo "=== Stage publish (local) ==="
seed_local_v2_from_live \
	"${DESKTOP_CLIENT_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/desktop-client-updates}/latest.v2.json" \
	"${ROOT}/docker/data/desktop-client-updates/latest.v2.json"
seed_local_v2_from_live \
	"${FOFLINE_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/fofline-updates}/latest.v2.json" \
	"${ROOT}/docker/data/fofline-updates/latest.v2.json"
bash "${ROOT}/scripts/eliteew/desktop-client-publish-update.sh" \
	--bridge-release \
	--version "${VER}" \
	--rpm "${CONNECTED_RPM}" \
	--sig "${CONNECTED_SIG}" \
	--replace-all-platforms \
		--notes "EliteEW desktop-client ${VER} — EBrowser stage not labwc-fullscreen (Linux RPM)"

bash "${ROOT}/scripts/eliteew/fofline-publish-update.sh" \
	--version "${VER}" \
	--rpm "${FOFLINE_RPM}" \
	--sig "${FOFLINE_SIG}" \
	--replace-all-platforms \
	--notes "EliteEW FoFline ${VER} — EBrowser stage not labwc-fullscreen (Linux RPM)"

mkdir -p "${HANDOFF}/ota-${VER}"
install -m 0644 "${CONNECTED_RPM}" "${HANDOFF}/ota-${VER}/"
install -m 0644 "${CONNECTED_SIG}" "${HANDOFF}/ota-${VER}/"
install -m 0644 "${FOFLINE_RPM}" "${HANDOFF}/ota-${VER}/"
install -m 0644 "${FOFLINE_SIG}" "${HANDOFF}/ota-${VER}/"

echo "OK: handoff ${HANDOFF}/ota-${VER}/"
echo "OK: staged docker/data/desktop-client-updates + fofline-updates at ${VER} (RPM only)"
echo "OK: latest.json platforms = linux-x86_64-rpm (+ linux-x86_64 alias → same RPM); no windows / AppImage"
echo "NOTE: Windows 0.4.61 seats will see ota_manifest_platform_missing until the next NSIS wave."
FOFLINE_STAGE="${ROOT}/docker/data/fofline-updates"
CONNECTED_STAGE="${ROOT}/docker/data/desktop-client-updates"
if [[ -f "${FOFLINE_STAGE}/spa-latest.json" ]]; then
	echo "OK: local FoFline spa-latest.json present (prod sync must keep remote SPA packs)"
else
	echo "WARN: local FoFline spa-latest.json missing — prod sync must not prune dest SPA artifacts" >&2
fi
if [[ -f "${CONNECTED_STAGE}/denylist.json" ]]; then
	echo "OK: local Connected denylist.json present"
else
	echo "WARN: local Connected denylist.json missing — prod sync must not prune dest denylist" >&2
fi

cat <<EOF

=== Operator sync (prod-core .111) — do not prune dest ===
rsync -av \\
  ${ROOT}/docker/data/desktop-client-updates/ \\
  192.168.1.111:/srv/eliteew/desktop-client-updates/
rsync -av \\
  ${ROOT}/docker/data/fofline-updates/ \\
  192.168.1.111:/srv/eliteew/fofline-updates/

Verify (version + platforms + v2 + SPA):
  curl -sf https://app.eliteew.ru/desktop-client-updates/latest.json | jq '{version, platforms: (.platforms|keys)}'
  curl -sf https://app.eliteew.ru/desktop-client-updates/latest.v2.json | jq '{version, platforms: (.platforms|keys)}'
  curl -sf https://app.eliteew.ru/fofline-updates/latest.json | jq '{version, platforms: (.platforms|keys)}'
  curl -sf https://app.eliteew.ru/fofline-updates/latest.v2.json | jq '{version, platforms: (.platforms|keys)}'
  curl -sf -o /dev/null -w 'fofline_spa=%{http_code}\\n' https://app.eliteew.ru/fofline-updates/spa-latest.json
  bash scripts/eliteew/desktop-client-fedora-e2e-checklist.sh --version ${VER} --rpm-only

If RPM URLs return HTTP 403: set SELinux container_file_t on new artifacts (Connected-client §OTA).
Windows 0.4.61: updater check reports missing windows-x86_64 until the next NSIS ship.

EOF
