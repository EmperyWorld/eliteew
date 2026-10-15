#!/usr/bin/env bash
# W2 exit proof: policy tests + handoff status honesty + secret-scan regression.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

bash "${ROOT}/scripts/selftest-policy.sh"

# Status helper with fake env (no real wg required)
TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

export WG_PORTAL_CONF="${TMP}/missing.conf"
export WG_PORTAL_IFACE=wg-portal
export ELITEEW_TS_STATUS_DIR="${TMP}/run"
bash "${ROOT}/scripts/handoff-status.sh" | tee "${TMP}/out1.txt"
rg -q 'state=peer_missing' "${TMP}/out1.txt"
rg -q 'connected=0' "${ELITEEW_TS_STATUS_DIR}/network-status"

# Peer present but no iface → degraded
echo 'PlaceholderKey = not-a-real-peer' >"${TMP}/wg-portal.conf"
export WG_PORTAL_CONF="${TMP}/wg-portal.conf"
bash "${ROOT}/scripts/handoff-status.sh" | tee "${TMP}/out2.txt"
rg -q 'state=degraded' "${TMP}/out2.txt"
rg -q 'connected=0' "${ELITEEW_TS_STATUS_DIR}/network-status"

# Secret-scan regression: baking peer into stage must fail prepare path scan
STAGE="${TMP}/evil-stage"
mkdir -p "${STAGE}/etc/wireguard"
cp "${TMP}/wg-portal.conf" "${STAGE}/etc/wireguard/wg-portal.conf"
PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"
if PYTHONPATH="${ROOT}" "${PYTHON_BIN}" -c "
from pathlib import Path
from policy.image_forbidden_globs import scan_forbidden_paths
hits = scan_forbidden_paths(Path('${STAGE}'))
assert hits, 'expected forbidden hits'
print('secret-scan regression OK', hits[0])
"; then
  :
else
  echo "selftest-w2: secret-scan regression FAILED" >&2
  exit 1
fi

# handoff-apply refuses install-media paths
if bash "${ROOT}/scripts/handoff-apply-peer.sh" /run/install/repo/wg-portal.conf 2>"${TMP}/refuse.txt"; then
  echo "selftest-w2: expected refuse for /run/install path" >&2
  exit 1
fi
rg -q 'refusing install-media' "${TMP}/refuse.txt"

# Tunnel bringup skips cleanly without peer (as root simulation via missing conf)
export WG_PORTAL_CONF="${TMP}/missing.conf"
if ! bash "${ROOT}/scripts/tunnel-up.sh" 2>"${TMP}/tun.txt"; then
  # non-root should fail; if we are root in CI, missing peer exits 0
  if [[ "$(id -u)" -eq 0 ]]; then
    echo "selftest-w2: tunnel-up as root with missing peer should exit 0" >&2
    exit 1
  fi
  rg -q 'must run as root' "${TMP}/tun.txt"
else
  rg -q 'peer missing' "${TMP}/tun.txt"
fi

rg -q 'eliteew-ts-kiosk' "${ROOT}/scripts/handoff-apply-peer.sh"
rg -q 'eliteew-ts-tunnel' "${ROOT}/scripts/handoff-apply-peer.sh"

echo "[W2] selftest-w2 PASS"
