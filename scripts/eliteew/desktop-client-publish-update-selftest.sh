#!/usr/bin/env bash
# Narrow lock: publish-update merges platforms; signs latest.v2; never invents signatures.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUB="$ROOT/scripts/eliteew/desktop-client-publish-update.sh"
STAGE="$(mktemp -d /tmp/eliteew-dc-pub-selftest.XXXXXX)"
cleanup() { :; }
trap cleanup EXIT

# Wave 8: ephemeral metadata seed for selftest only (not the production bake key).
export DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY="$(
	python3 - <<'PY'
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
print(Ed25519PrivateKey.generate().private_bytes_raw().hex())
PY
)"
export DESKTOP_CLIENT_OTA_METADATA_KEY_ID="selftest-meta-1"

make_pair() {
	local base="$1"
	printf 'fake-binary-%s' "$base" >"${STAGE}/${base}"
	printf 'fake-sig-%s' "$base" >"${STAGE}/${base}.sig"
}

make_pair "EliteEW_Desktop_Client-x86_64.AppImage"
make_pair "EliteEW_Desktop_Client-0.4.2-1.x86_64.rpm"
make_pair "EliteEW-Desktop-Client-0.4.2-x64-setup.exe"

bash "$PUB" \
	--version 0.4.2 \
	--appimage "${STAGE}/EliteEW_Desktop_Client-x86_64.AppImage" \
	--sig "${STAGE}/EliteEW_Desktop_Client-x86_64.AppImage.sig" \
	--out "${STAGE}/out" \
	--notes "selftest-linux"

bash "$PUB" \
	--version 0.4.2 \
	--rpm "${STAGE}/EliteEW_Desktop_Client-0.4.2-1.x86_64.rpm" \
	--sig "${STAGE}/EliteEW_Desktop_Client-0.4.2-1.x86_64.rpm.sig" \
	--out "${STAGE}/out" \
	--notes "selftest-linux-rpm"

bash "$PUB" \
	--version 0.4.2 \
	--nsis "${STAGE}/EliteEW-Desktop-Client-0.4.2-x64-setup.exe" \
	--sig "${STAGE}/EliteEW-Desktop-Client-0.4.2-x64-setup.exe.sig" \
	--out "${STAGE}/out" \
	--notes "selftest-windows-merge"

python3 - "${STAGE}/out/latest.json" "${STAGE}/out/latest.v2.json" <<'PY'
import json, sys
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey, Ed25519PrivateKey
import os

doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert doc["version"] == "0.4.2", doc
plats = doc["platforms"]
assert "linux-x86_64" in plats, plats
assert "linux-x86_64-rpm" in plats, plats
assert "windows-x86_64" in plats, plats
assert plats["linux-x86_64"]["url"].endswith(".AppImage"), plats
assert plats["linux-x86_64-rpm"]["url"].endswith(".rpm"), plats
assert plats["windows-x86_64"]["url"].endswith(".exe"), plats
print("OK: merge selftest")

v2 = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
assert v2["schema"] == "eliteew.ota.latest.v2", v2
assert v2["product_id"] == "world.empery.desktop.client"
assert v2["channel"] == "connected"
assert v2["sequence"] >= 1
assert v2["metadata_key_id"] == "selftest-meta-1"
assert "metadata_signature" in v2 and len(v2["metadata_signature"]) == 128
assert "linux-x86_64-rpm" in v2["platforms"]
rpm = v2["platforms"]["linux-x86_64-rpm"]
assert rpm["package_id"] == "elite-ew-desktop-client"
assert rpm["package_type"] == "rpm"
assert len(rpm["sha256"]) == 64
assert rpm["size"] > 0

sign_obj = {k: v for k, v in v2.items() if k != "metadata_signature"}

def sort_value(value):
    if isinstance(value, dict):
        return {k: sort_value(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [sort_value(v) for v in value]
    return value

canonical = json.dumps(sort_value(sign_obj), separators=(",", ":"), ensure_ascii=False).encode()
seed = bytes.fromhex(os.environ["DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY"])
pk = Ed25519PrivateKey.from_private_bytes(seed).public_key()
pk.verify(bytes.fromhex(v2["metadata_signature"]), canonical)
print("OK: latest.v2 signature")

v2_bad = dict(v2)
v2_bad["version"] = "9.9.9"
try:
    sign_obj2 = {k: v for k, v in v2_bad.items() if k != "metadata_signature"}
    canonical2 = json.dumps(sort_value(sign_obj2), separators=(",", ":"), ensure_ascii=False).encode()
    pk.verify(bytes.fromhex(v2_bad["metadata_signature"]), canonical2)
    raise SystemExit("FAIL: tampered metadata still verified")
except Exception as e:
    if "FAIL:" in str(e):
        raise
    print("OK: tampered metadata rejected")
PY

# Missing metadata seed must fail
unset DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY
if bash "$PUB" --version 0.4.3 --rpm "${STAGE}/EliteEW_Desktop_Client-0.4.2-1.x86_64.rpm" --sig "${STAGE}/EliteEW_Desktop_Client-0.4.2-1.x86_64.rpm.sig" --out "${STAGE}/out-noseed" 2>/dev/null; then
	echo "FAIL: expected missing metadata seed to fail" >&2
	exit 1
fi
echo "OK: missing-metadata-seed fail-closed"
# Restore ephemeral seed for any follow-up (none required)
export DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY="$(
	python3 - <<'PY'
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
print(Ed25519PrivateKey.generate().private_bytes_raw().hex())
PY
)"

# Missing sig must fail
if bash "$PUB" --version 0.4.2 --nsis "${STAGE}/EliteEW-Desktop-Client-0.4.2-x64-setup.exe" --sig "${STAGE}/missing.sig" --out "${STAGE}/out2" 2>/dev/null; then
	echo "FAIL: expected missing sig to fail" >&2
	exit 1
fi
echo "OK: missing-sig fail-closed"
: >"${STAGE}/empty.sig"
if bash "$PUB" --version 0.4.2 --nsis "${STAGE}/EliteEW-Desktop-Client-0.4.2-x64-setup.exe" --sig "${STAGE}/empty.sig" --out "${STAGE}/out3" 2>/dev/null; then
	echo "FAIL: expected empty sig to fail" >&2
	exit 1
fi
echo "OK: empty-sig fail-closed"
if compgen -G "${STAGE}/out/.latest.json.*" >/dev/null; then
	echo "FAIL: atomic publish left a latest.json temp file" >&2
	exit 1
fi
echo "OK: latest.json atomic temp cleaned"

# Wave 9: --freeze-legacy keeps latest.json frozen; advances only latest.v2
export DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY="$(
	python3 - <<'PY'
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
print(Ed25519PrivateKey.generate().private_bytes_raw().hex())
PY
)"
FROZEN_VER="$(python3 -c "import json; print(json.load(open('${STAGE}/out/latest.json'))['version'])")"
make_pair "EliteEW_Desktop_Client-0.4.46-1.x86_64.rpm"
if bash "$PUB" \
	--version 0.4.46 \
	--rpm "${STAGE}/EliteEW_Desktop_Client-0.4.46-1.x86_64.rpm" \
	--sig "${STAGE}/EliteEW_Desktop_Client-0.4.46-1.x86_64.rpm.sig" \
	--out "${STAGE}/out" \
	--freeze-legacy \
	--notes "selftest-freeze" 2>/dev/null; then
	echo "FAIL: expected --freeze-legacy to refuse newer version vs frozen latest.json" >&2
	exit 1
fi
echo "OK: freeze-legacy refuses newer latest.json version"
# Same frozen version: v2-only publish allowed
bash "$PUB" \
	--version "${FROZEN_VER}" \
	--rpm "${STAGE}/EliteEW_Desktop_Client-0.4.2-1.x86_64.rpm" \
	--sig "${STAGE}/EliteEW_Desktop_Client-0.4.2-1.x86_64.rpm.sig" \
	--out "${STAGE}/out" \
	--freeze-legacy \
	--notes "selftest-freeze-same"
python3 - "${STAGE}/out/latest.json" "${STAGE}/out/latest.v2.json" "${FROZEN_VER}" <<'PY'
import json, sys
from pathlib import Path
doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert doc["version"] == sys.argv[3], doc
v2 = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
assert v2["version"] == sys.argv[3], v2
print("OK: freeze-legacy same-version v2-only")
PY

echo "PASS desktop-client-publish-update-selftest"
