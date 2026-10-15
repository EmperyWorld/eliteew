#!/usr/bin/env bash
# Purpose: Opt-in apply of default-deny egress sketch (WG + DNS allow).
# Related: docs/NETWORK-HANDOFF.md
set -euo pipefail

die() { printf 'apply-egress-sketch: %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "run as root"
command -v nft >/dev/null 2>&1 || die "nftables (nft) required"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NFT_SRC="${1:-${ROOT}/payload-templates/etc-nftables/eliteew-ts-egress.nft}"

[[ -f "${NFT_SRC}" ]] || die "nft file missing: ${NFT_SRC}"

install -d -m 0755 /etc/eliteew-trusted-substrate
install -m 0644 "${NFT_SRC}" /etc/eliteew-trusted-substrate/eliteew-ts-egress.nft

nft -f /etc/eliteew-trusted-substrate/eliteew-ts-egress.nft
echo "apply-egress-sketch: loaded ${NFT_SRC}"
echo "apply-egress-sketch: WARNING — review rules before production; this is a pilot sketch"
