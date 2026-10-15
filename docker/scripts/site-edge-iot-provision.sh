#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Render Butane + SSH/network placeholders, compile Ignition, write Fedora IoT image to a block device.
# Invariants:
# - No passwords/private keys in repo; pubkey file required at provision time.
# - Refuses to write without --yes and typed device confirmation; never auto-picks a disk.
# Related:
# - documentation/platform/SITE-EDGE-CARRIER.md
# - docker/site-edge-iot/
# ---
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IOT_DIR="${REPO_ROOT}/docker/site-edge-iot"
BUTANE_SRC="${IOT_DIR}/edge-node.bu"

ASSUME_YES=0
DRY_RUN=0
IMAGE_FILE=""
DEVICE=""
SSH_PUBKEY_FILE=""
HOSTNAME_VALUE="site-edge-01"
NETWORK_MODE="dhcp"
NETWORK_ENV=""
OUT_IGN=""
CONFIRM_DEVICE=""

usage() {
	cat <<EOF
Usage: $(basename "$0") --image <fedora-iot.raw[.xz]> --device /dev/sdX \\
         --ssh-pubkey-file <path> [--hostname NAME] [options]

Zero-touch Fedora IoT flash for Site-Edge (Celeron).

Required:
  --image PATH              Fedora IoT metal/raw image (.raw or .raw.xz)
  --device PATH             target block device (USB/SSD), e.g. /dev/sdb
  --ssh-pubkey-file PATH    file with one or more SSH public keys

Options:
  --hostname NAME           default: site-edge-01
  --network-dhcp            DHCP (default)
  --network-env PATH        static IP from network.env (NETWORK_MODE=static + STATIC_IP/GATEWAY/DNS)
  --ignition-out PATH       write compiled config.ign here (default: temp + copy to IOT_DIR/config.ign)
  --yes                     skip interactive Continue? (still requires --confirm-device)
  --confirm-device PATH     must equal --device (safety latch)
  --dry-run                 render+compile only; do not write disk
  -h, --help
EOF
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*"; }

while [[ $# -gt 0 ]]; do
	case "$1" in
		--image)
			IMAGE_FILE="${2:-}"
			shift 2
			;;
		--device)
			DEVICE="${2:-}"
			shift 2
			;;
		--ssh-pubkey-file)
			SSH_PUBKEY_FILE="${2:-}"
			shift 2
			;;
		--hostname)
			HOSTNAME_VALUE="${2:-}"
			shift 2
			;;
		--network-dhcp)
			NETWORK_MODE="dhcp"
			shift
			;;
		--network-env)
			NETWORK_MODE="static"
			NETWORK_ENV="${2:-}"
			shift 2
			;;
		--ignition-out)
			OUT_IGN="${2:-}"
			shift 2
			;;
		--yes)
			ASSUME_YES=1
			shift
			;;
		--confirm-device)
			CONFIRM_DEVICE="${2:-}"
			shift 2
			;;
		--dry-run)
			DRY_RUN=1
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			die "unknown option: $1"
			;;
	esac
done

[[ -f "${BUTANE_SRC}" ]] || die "missing ${BUTANE_SRC}"
[[ -n "${SSH_PUBKEY_FILE}" && -f "${SSH_PUBKEY_FILE}" ]] || die "--ssh-pubkey-file required"
[[ -n "${HOSTNAME_VALUE}" ]] || die "--hostname empty"

if [[ "${DRY_RUN}" -eq 0 ]]; then
	[[ -n "${IMAGE_FILE}" && -f "${IMAGE_FILE}" ]] || die "--image required (or use --dry-run)"
	[[ -n "${DEVICE}" ]] || die "--device required (or use --dry-run)"
	[[ -b "${DEVICE}" ]] || die "not a block device: ${DEVICE}"
	[[ "${CONFIRM_DEVICE}" == "${DEVICE}" ]] || die "pass --confirm-device ${DEVICE} (must match --device)"
fi

# Refuse obvious system disks when possible
if [[ "${DRY_RUN}" -eq 0 ]]; then
	root_src="$(findmnt -n -o SOURCE / 2>/dev/null || true)"
	if [[ -n "${root_src}" && "${DEVICE}" == "${root_src}"* ]]; then
		die "refusing to write to root device family (${root_src})"
	fi
fi

if [[ "${ASSUME_YES}" -eq 0 && "${DRY_RUN}" -eq 0 && -t 0 ]]; then
	log "WILL ERASE ${DEVICE} and install Fedora IoT + Ignition (hostname=${HOSTNAME_VALUE})"
	read -r -p "Type the device path again to continue: " typed
	[[ "${typed}" == "${DEVICE}" ]] || die "confirmation mismatch"
elif [[ "${ASSUME_YES}" -eq 0 && "${DRY_RUN}" -eq 0 ]]; then
	die "non-interactive flash requires --yes and --confirm-device"
fi

WORKDIR="$(mktemp -d /tmp/site-edge-iot-XXXXXX)"
cleanup() { rm -rf "${WORKDIR}"; }
trap cleanup EXIT

mkdir -p "${WORKDIR}/render"
cp -a "${IOT_DIR}/." "${WORKDIR}/render/"
RENDER_BU="${WORKDIR}/render/edge-node.bu"
RENDER_NM="${WORKDIR}/render/files/edge-lan-dhcp.nmconnection"

# Inject SSH public keys (YAML list under ssh_authorized_keys)
mapfile -t PUBKEYS < <(grep -E '^(ssh-|ecdsa-)' "${SSH_PUBKEY_FILE}" || true)
[[ "${#PUBKEYS[@]}" -gt 0 ]] || die "no ssh-* public keys found in ${SSH_PUBKEY_FILE}"

export SITE_EDGE_RENDER_BU="${RENDER_BU}"
export SITE_EDGE_HOSTNAME_VALUE="${HOSTNAME_VALUE}"
printf '%s\n' "${PUBKEYS[@]}" >"${WORKDIR}/pubkeys.txt"
export SITE_EDGE_PUBKEYS_FILE="${WORKDIR}/pubkeys.txt"

python3 <<'PY'
from pathlib import Path
import os
import re

path = Path(os.environ["SITE_EDGE_RENDER_BU"])
hostname = os.environ["SITE_EDGE_HOSTNAME_VALUE"]
keys = [
    line.strip()
    for line in Path(os.environ["SITE_EDGE_PUBKEYS_FILE"]).read_text(encoding="utf-8").splitlines()
    if line.strip()
]
keys_yaml = "".join(f'        - "{k.replace(chr(92), chr(92)+chr(92)).replace(chr(34), chr(92)+chr(34))}"\n' for k in keys)
text = path.read_text(encoding="utf-8").replace("REPLACE_ME_HOSTNAME", hostname)
text2, n = re.subn(
    r"      ssh_authorized_keys:\n(?:        - .*\n)+",
    "      ssh_authorized_keys:\n" + keys_yaml,
    text,
    count=1,
)
if n != 1:
    raise SystemExit("failed to inject ssh_authorized_keys into Butane")
path.write_text(text2, encoding="utf-8")
PY

if [[ "${NETWORK_MODE}" == "static" ]]; then
	[[ -n "${NETWORK_ENV}" && -f "${NETWORK_ENV}" ]] || die "--network-env required for static mode"
	# shellcheck disable=SC1090
	source "${NETWORK_ENV}"
	if [[ "${NETWORK_MODE}" != "static" ]]; then
		die "dual-flag conflict: CLI static mode but network.env NETWORK_MODE=${NETWORK_MODE}"
	fi
	[[ -n "${STATIC_IP:-}" && -n "${GATEWAY:-}" && -n "${DNS:-}" ]] || die "STATIC_IP, GATEWAY, DNS required in network.env"
	STATIC_TMPL="${IOT_DIR}/files/edge-lan-static.nmconnection.example"
	sed \
		-e "s|REPLACE_ME_ADDRESS|${STATIC_IP}|g" \
		-e "s|REPLACE_ME_GATEWAY|${GATEWAY}|g" \
		-e "s|REPLACE_ME_DNS|${DNS}|g" \
		"${STATIC_TMPL}" >"${RENDER_NM}"
fi

OUT_IGN="${OUT_IGN:-${IOT_DIR}/config.ign}"
log "=== compile Butane → ${OUT_IGN} ==="

run_butane() {
	local out="$1"
	if command -v butane >/dev/null 2>&1; then
		(cd "${WORKDIR}/render" && butane --pretty --strict --files-dir=. edge-node.bu -o "${out}")
	elif command -v podman >/dev/null 2>&1; then
		podman run --rm -i \
			-v "${WORKDIR}/render:/cfg:Z" \
			quay.io/coreos/butane:release \
			--pretty --strict --files-dir=/cfg /cfg/edge-node.bu >"${out}"
	else
		die "need butane CLI or podman to run quay.io/coreos/butane:release"
	fi
}

run_butane "${OUT_IGN}"
python3 -m json.tool "${OUT_IGN}" >/dev/null || die "config.ign is not valid JSON"
if command -v ignition-validate >/dev/null 2>&1; then
	ignition-validate "${OUT_IGN}" || die "ignition-validate failed"
fi
log "OK: Ignition written (${OUT_IGN})"

if [[ "${DRY_RUN}" -eq 1 ]]; then
	log "dry-run: skipping disk write"
	exit 0
fi

RAW="${IMAGE_FILE}"
if [[ "${IMAGE_FILE}" == *.xz ]]; then
	log "=== decompress ${IMAGE_FILE} ==="
	RAW="${WORKDIR}/fedora-iot.raw"
	xzcat "${IMAGE_FILE}" >"${RAW}"
fi

command -v coreos-installer >/dev/null 2>&1 || die "coreos-installer not found (install coreos-installer package)"

log "=== coreos-installer install ${DEVICE} ==="
coreos-installer install "${DEVICE}" \
	--image-file "${RAW}" \
	--ignition-file "${OUT_IGN}" \
	--insecure

sync
log "OK: flash complete. Insert disk into Celeron, power on, wait for possible package reboot."
log "Then: bash docker/scripts/site-edge-iot-verify.sh --host <EDGE_IP_OR_DNS>"
