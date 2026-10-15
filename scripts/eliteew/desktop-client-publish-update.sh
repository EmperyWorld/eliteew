#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Stage private Tauri updater artifacts (O2) for /desktop-client-updates/.
# Invariants:
# - Never invents signatures; requires non-empty artifact + .sig from signed tauri build.
# - Merges platform keys into existing latest.json when --version matches (legacy bridge).
# - Also writes signed latest.v2.json (Wave 8) — requires DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY.
# - --bridge-release: dual-write latest.json + latest.v2 (default / explicit).
# - --freeze-legacy: write only latest.v2; refuse if latest.json would move to a newer version.
# - Publishes with atomic same-directory replace.
# - linux-x86_64 (AppImage), linux-x86_64-rpm (RPM installs), windows-x86_64 (NSIS).
# Related:
# - pack-organization/connection-agent/packaging/signing/README.md
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §8 / §12g
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION=""
ARTIFACT=""
SIG=""
NOTES="EliteEW desktop-client private OTA"
PUBLIC_BASE="${DESKTOP_CLIENT_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/desktop-client-updates}"
OUT_DIR="${DESKTOP_CLIENT_UPDATES_OUT:-${ROOT}/docker/data/desktop-client-updates}"
TARGET_KEY=""
REPLACE_ALL=0
BRIDGE_RELEASE=0
FREEZE_LEGACY=0
PRODUCT_ID="${DESKTOP_CLIENT_OTA_PRODUCT_ID:-world.empery.desktop.client}"
CHANNEL="${DESKTOP_CLIENT_OTA_CHANNEL:-connected}"
PACKAGE_ID="${DESKTOP_CLIENT_OTA_PACKAGE_ID:-elite-ew-desktop-client}"
METADATA_KEY_ID="${DESKTOP_CLIENT_OTA_METADATA_KEY_ID:-connected-meta-1}"
ARTIFACT_KEY_ID="${DESKTOP_CLIENT_OTA_ARTIFACT_KEY_ID:-connected-artifact-1}"
SEQUENCE_OVERRIDE="${DESKTOP_CLIENT_OTA_SEQUENCE:-}"
EXPIRES_DAYS="${DESKTOP_CLIENT_OTA_EXPIRES_DAYS:-90}"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--version)
		VERSION="${2:-}"
		shift 2
		;;
	--appimage)
		ARTIFACT="${2:-}"
		TARGET_KEY="${TARGET_KEY:-linux-x86_64}"
		shift 2
		;;
	--rpm)
		ARTIFACT="${2:-}"
		TARGET_KEY="${TARGET_KEY:-linux-x86_64-rpm}"
		shift 2
		;;
	--nsis)
		ARTIFACT="${2:-}"
		TARGET_KEY="${TARGET_KEY:-windows-x86_64}"
		shift 2
		;;
	--artifact)
		ARTIFACT="${2:-}"
		shift 2
		;;
	--sig)
		SIG="${2:-}"
		shift 2
		;;
	--platform)
		TARGET_KEY="${2:-}"
		shift 2
		;;
	--out)
		OUT_DIR="${2:-}"
		shift 2
		;;
	--notes)
		NOTES="${2:-}"
		shift 2
		;;
	--public-base)
		PUBLIC_BASE="${2:-}"
		shift 2
		;;
	--replace-all-platforms)
		REPLACE_ALL=1
		shift
		;;
	--bridge-release)
		BRIDGE_RELEASE=1
		shift
		;;
	--freeze-legacy)
		FREEZE_LEGACY=1
		shift
		;;
	-h | --help)
		sed -n '2,16p' "$0"
		cat <<EOF

Usage (Linux OTA — AppImage clients look up linux-x86_64):
  bash scripts/eliteew/desktop-client-publish-update.sh \\
    --version 0.4.2 \\
    --appimage path/to/*.AppImage \\
    --sig path/to/*.AppImage.sig \\
    [--out docker/data/desktop-client-updates]

Usage (Linux OTA — RPM first-install clients look up linux-x86_64-rpm first):
  bash scripts/eliteew/desktop-client-publish-update.sh \\
    --version 0.4.2 \\
    --rpm path/to/*.rpm \\
    --sig path/to/*.rpm.sig \\
    [--out docker/data/desktop-client-updates]

Usage (Windows OTA — requires Tauri updater .sig from signed NSIS build):
  bash scripts/eliteew/desktop-client-publish-update.sh \\
    --version 0.4.2 \\
    --nsis path/to/*setup.exe \\
    --sig path/to/*setup.exe.sig \\
    [--out docker/data/desktop-client-updates]

Flags:
  --bridge-release   Dual-write latest.json + latest.v2 (default behavior; explicit).
  --freeze-legacy    Write only latest.v2; fail if latest.json would move to a newer version.

Same --version merges platforms into existing latest.json (AppImage + RPM + Windows).
Different --version without --replace-all-platforms starts a new platforms map (WARN).
Unsigned Authenticode NSIS for first install stays handout-only — do not publish without .sig.
RPM seats without linux-x86_64-rpm fall back to linux-x86_64 (AppImage) and fail install — always publish both.

Then sync OUT to prod-core /srv/eliteew/desktop-client-updates (volume on stack0 frontend).
EOF
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ "${BRIDGE_RELEASE}" -eq 1 && "${FREEZE_LEGACY}" -eq 1 ]]; then
	echo "FAIL: --bridge-release and --freeze-legacy are mutually exclusive" >&2
	exit 2
fi

if [[ -z "${VERSION}" || -z "${ARTIFACT}" || -z "${SIG}" ]]; then
	echo "FAIL: --version, artifact (--appimage|--rpm|--nsis|--artifact), and --sig are required" >&2
	exit 2
fi
if [[ -z "${TARGET_KEY}" ]]; then
	case "${ARTIFACT}" in
	*.AppImage | *.appimage) TARGET_KEY="linux-x86_64" ;;
	*.rpm) TARGET_KEY="linux-x86_64-rpm" ;;
	*.exe | *.msi) TARGET_KEY="windows-x86_64" ;;
	*)
		echo "FAIL: cannot infer --platform from artifact name; pass --platform" >&2
		exit 2
		;;
	esac
fi
case "${TARGET_KEY}" in
linux-x86_64 | linux-x86_64-rpm | linux-x86_64-appimage | windows-x86_64) ;;
*)
	echo "FAIL: --platform must be linux-x86_64|linux-x86_64-rpm|linux-x86_64-appimage|windows-x86_64 (got: ${TARGET_KEY})" >&2
	exit 2
	;;
esac
if [[ ! -s "${ARTIFACT}" ]]; then
	echo "FAIL: artifact not found: ${ARTIFACT}" >&2
	exit 1
fi
if [[ ! -s "${SIG}" ]]; then
	echo "FAIL: signature not found: ${SIG}" >&2
	exit 1
fi

mkdir -p "${OUT_DIR}/artifacts"
BASE_NAME="$(basename "${ARTIFACT}")"
SIG_NAME="$(basename "${SIG}")"
# Tauri productName yields "EliteEW FoFline-*.rpm"; public URLs must use underscores.
SAFE_BASE="${BASE_NAME// /_}"
SAFE_SIG="${SIG_NAME// /_}"
# Prefer install over cp -f (trash gate / overwrite policy on some hosts)
install -m 0644 "${ARTIFACT}" "${OUT_DIR}/artifacts/${SAFE_BASE}"
install -m 0644 "${SIG}" "${OUT_DIR}/artifacts/${SAFE_SIG}"

export DC_PUB_VERSION="${VERSION}"
export DC_PUB_NOTES="${NOTES}"
export DC_PUB_DATE
DC_PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
export DC_PUB_TARGET="${TARGET_KEY}"
export DC_PUB_URL="${PUBLIC_BASE%/}/artifacts/${SAFE_BASE}"
export DC_PUB_SIG
DC_PUB_SIG="$(tr -d '\n\r' <"${SIG}")"
if [[ -z "${DC_PUB_SIG}" ]]; then
	echo "FAIL: signature is empty after normalization: ${SIG}" >&2
	exit 1
fi
export DC_PUB_OUT="${OUT_DIR}/latest.json"
export DC_PUB_OUT_V2="${OUT_DIR}/latest.v2.json"
export DC_PUB_REPLACE_ALL="${REPLACE_ALL}"
export DC_PUB_FREEZE_LEGACY="${FREEZE_LEGACY}"
export DC_PUB_PRODUCT_ID="${PRODUCT_ID}"
export DC_PUB_CHANNEL="${CHANNEL}"
export DC_PUB_PACKAGE_ID="${PACKAGE_ID}"
export DC_PUB_METADATA_KEY_ID="${METADATA_KEY_ID}"
export DC_PUB_ARTIFACT_KEY_ID="${ARTIFACT_KEY_ID}"
export DC_PUB_SEQUENCE_OVERRIDE="${SEQUENCE_OVERRIDE}"
export DC_PUB_EXPIRES_DAYS="${EXPIRES_DAYS}"
export DC_PUB_ARTIFACT_PATH="${OUT_DIR}/artifacts/${SAFE_BASE}"
export DC_PUB_METADATA_SEED="${DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY:-}"

case "${TARGET_KEY}" in
linux-x86_64 | linux-x86_64-appimage) export DC_PUB_PACKAGE_TYPE="appimage" ;;
windows-x86_64) export DC_PUB_PACKAGE_TYPE="nsis" ;;
*) export DC_PUB_PACKAGE_TYPE="rpm" ;;
esac

if [[ -z "${DC_PUB_METADATA_SEED}" || "${DC_PUB_METADATA_SEED}" == *REPLACE_WITH* || ${#DC_PUB_METADATA_SEED} -ne 64 ]]; then
	echo "FAIL: DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY must be a 32-byte hex seed (Wave 8 latest.v2)" >&2
	exit 2
fi

python3 <<'PY'
import hashlib
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

SCHEMA = "eliteew.ota.latest.v2"

out = Path(os.environ["DC_PUB_OUT"])
out_v2 = Path(os.environ["DC_PUB_OUT_V2"])
version = os.environ["DC_PUB_VERSION"]
notes = os.environ["DC_PUB_NOTES"]
pub_date = os.environ["DC_PUB_DATE"]
target = os.environ["DC_PUB_TARGET"]
url = os.environ["DC_PUB_URL"]
sig = os.environ["DC_PUB_SIG"]
replace_all = os.environ.get("DC_PUB_REPLACE_ALL", "0") == "1"
freeze_legacy = os.environ.get("DC_PUB_FREEZE_LEGACY", "0") == "1"
artifact_path = Path(os.environ["DC_PUB_ARTIFACT_PATH"])
product_id = os.environ["DC_PUB_PRODUCT_ID"]
channel = os.environ["DC_PUB_CHANNEL"]
package_id = os.environ["DC_PUB_PACKAGE_ID"]
package_type = os.environ["DC_PUB_PACKAGE_TYPE"]
metadata_key_id = os.environ["DC_PUB_METADATA_KEY_ID"]
artifact_key_id = os.environ["DC_PUB_ARTIFACT_KEY_ID"]
seed_hex = os.environ["DC_PUB_METADATA_SEED"].strip()
expires_days = int(os.environ.get("DC_PUB_EXPIRES_DAYS") or "90")
seq_override = (os.environ.get("DC_PUB_SEQUENCE_OVERRIDE") or "").strip()

EXPECTED_METADATA_PUBKEY = {
    "world.empery.desktop.client": "23c0e20fd622b0882f343b73e87ec77bd780ef33025cdc15d71be05e990cbdae",
    "world.empery.fofline": "d757086ddf665032e4b14711d268d3744d76cd0cd30c23bf459dd5a0caef889a",
}
expected_pk = EXPECTED_METADATA_PUBKEY.get(product_id)
if not expected_pk:
    print(f"FAIL: unknown product_id {product_id} for metadata pubkey check", file=sys.stderr)
    sys.exit(2)
derived_pk = (
    Ed25519PrivateKey.from_private_bytes(bytes.fromhex(seed_hex))
    .public_key()
    .public_bytes_raw()
    .hex()
)
if derived_pk != expected_pk:
    print("FAIL: metadata seed does not match baked product pubkey", file=sys.stderr)
    sys.exit(2)
print("OK: metadata seed matches baked product pubkey")

entry = {"signature": sig, "url": url}


def parse_semver(v: str):
    parts = []
    for p in (v or "").strip().split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def is_newer(candidate: str, baseline: str) -> bool:
    return parse_semver(candidate) > parse_semver(baseline)


# --- latest.json (legacy bridge) ---
write_latest_json = True
if freeze_legacy:
    write_latest_json = False
    if out.is_file():
        try:
            frozen = json.loads(out.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"FAIL: corrupt latest.json under --freeze-legacy: {e}", file=sys.stderr)
            sys.exit(1)
        frozen_ver = str(frozen.get("version") or "") if isinstance(frozen, dict) else ""
        if frozen_ver and is_newer(version, frozen_ver):
            print(
                f"FAIL: --freeze-legacy refuses advancing latest.json "
                f"{frozen_ver} → {version} (v2-only publish)",
                file=sys.stderr,
            )
            sys.exit(1)
        print(f"OK: freeze-legacy keeps latest.json at {frozen_ver or '(unset)'}")
    else:
        print("OK: freeze-legacy; no latest.json present — writing latest.v2 only")

if write_latest_json:
    if out.is_file() and not replace_all:
        try:
            doc = json.loads(out.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"FAIL: corrupt latest.json: {e}", file=sys.stderr)
            sys.exit(1)
        if not isinstance(doc, dict):
            print("FAIL: latest.json root must be object", file=sys.stderr)
            sys.exit(1)
        prev_ver = str(doc.get("version") or "")
        platforms = doc.get("platforms")
        if not isinstance(platforms, dict):
            platforms = {}
        if prev_ver and prev_ver != version:
            print(
                f"WARN: version {prev_ver} → {version}; resetting platforms "
                f"(re-publish other targets for {version})",
                file=sys.stderr,
            )
            platforms = {}
        platforms[target] = entry
        if target == "linux-x86_64-rpm" and "linux-x86_64" not in platforms:
            platforms["linux-x86_64"] = entry
            print("OK: aliased linux-x86_64 → same RPM for Tauri updater lookup")
        doc = {
            "version": version,
            "notes": notes,
            "pub_date": pub_date,
            "platforms": platforms,
        }
    else:
        platforms = {target: entry}
        if target == "linux-x86_64-rpm":
            platforms["linux-x86_64"] = entry
            print("OK: aliased linux-x86_64 → same RPM for Tauri updater lookup")
        doc = {
            "version": version,
            "notes": notes,
            "pub_date": pub_date,
            "platforms": platforms,
        }
else:
    doc = {"version": version, "platforms": {}}


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=path.parent, prefix=f".{path.name}.", delete=False
        ) as tmp:
            tmp_path = Path(tmp.name)
            tmp.write(payload)
            tmp.flush()
            os.fsync(tmp.fileno())
        os.replace(tmp_path, path)
        tmp_path = None
        os.chmod(path, 0o644)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)


if write_latest_json:
    payload = (json.dumps(doc, indent=2) + "\n").encode("utf-8")
    atomic_write(out, payload)
    print(f"OK: wrote {out}")
else:
    print(f"OK: skipped {out} (--freeze-legacy)")

# --- latest.v2 (signed metadata) ---
raw = artifact_path.read_bytes()
size = len(raw)
sha256 = hashlib.sha256(raw).hexdigest()
plat_v2 = {
    "url": url,
    "size": size,
    "sha256": sha256,
    "signature": sig,
    "artifact_key_id": artifact_key_id,
    "package_id": package_id,
    "package_type": package_type,
}

prev_v2 = {}
if out_v2.is_file():
    try:
        prev_v2 = json.loads(out_v2.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        prev_v2 = {}

prev_seq = int(prev_v2.get("sequence") or 0) if isinstance(prev_v2, dict) else 0
prev_ver = str(prev_v2.get("version") or "") if isinstance(prev_v2, dict) else ""
platforms_v2 = {}
if (
    not replace_all
    and isinstance(prev_v2, dict)
    and isinstance(prev_v2.get("platforms"), dict)
    and prev_ver == version
):
    platforms_v2 = dict(prev_v2["platforms"])
platforms_v2[target] = plat_v2
if target == "linux-x86_64-rpm" and "linux-x86_64" not in platforms_v2:
    alias = dict(plat_v2)
    alias["package_type"] = "appimage"
    # Do not alias RPM as appimage under linux-x86_64 for v2 — omit alias.
    pass

if seq_override:
    sequence = int(seq_override)
elif prev_ver == version and prev_seq > 0:
    prev_plat = (prev_v2.get("platforms") or {}).get(target) or {}
    prev_sha = str(prev_plat.get("sha256") or "").strip().lower()
    if prev_sha and prev_sha != sha256.strip().lower():
        sequence = prev_seq + 1
    else:
        sequence = prev_seq
else:
    sequence = prev_seq + 1 if prev_seq > 0 else 1

expires_at = (
    datetime.now(timezone.utc) + timedelta(days=expires_days)
).strftime("%Y-%m-%dT%H:%M:%SZ")

doc_v2 = {
    "schema": SCHEMA,
    "product_id": product_id,
    "channel": channel,
    "sequence": sequence,
    "version": version,
    "expires_at": expires_at,
    "platforms": platforms_v2,
    "metadata_key_id": metadata_key_id,
    "metadata_signature": "",
}

# Canonical sign bytes: sorted JSON without metadata_signature (matches Rust).
sign_obj = {k: v for k, v in doc_v2.items() if k != "metadata_signature"}


def sort_value(value):
    if isinstance(value, dict):
        return {k: sort_value(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [sort_value(v) for v in value]
    return value


canonical = json.dumps(sort_value(sign_obj), separators=(",", ":"), ensure_ascii=False).encode(
    "utf-8"
)
sk = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(seed_hex))
doc_v2["metadata_signature"] = sk.sign(canonical).hex()

atomic_write(out_v2, (json.dumps(doc_v2, indent=2) + "\n").encode("utf-8"))
print(f"OK: wrote {out_v2} sequence={sequence} size={size}")
print(f"OK: platform={target} platforms={sorted(doc.get('platforms') or [])}")
print(f"OK: artifacts under {out.parent / 'artifacts'}")
print(
    "Next: sync to prod-core /srv/eliteew/desktop-client-updates "
    "and ensure nginx /desktop-client-updates/ is live"
)
PY
