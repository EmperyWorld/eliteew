# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Stage signed FoFline OTA artifacts for /fofline-updates/ (separate from desktop-client).
# Invariants:
# - Does not publish to live prod by default — stages under docker/data/fofline-updates.
# - Reuses desktop-client-publish-update.sh signing rules; never invents .sig.
# - Sets FoFline product/channel/package/metadata key ids for latest.v2.
# - Requires FOFLINE_UPDATE_METADATA_SIGNING_KEY (never Connected metadata seed).
# - Vanilla /desktop-client-updates/ channel stays untouched.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11 / W4
# - scripts/eliteew/desktop-client-publish-update.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUBLIC_BASE="${FOFLINE_UPDATE_PUBLIC_BASE:-https://app.eliteew.ru/fofline-updates}"
OUT_DIR="${FOFLINE_UPDATES_OUT:-${ROOT}/docker/data/fofline-updates}"

export DESKTOP_CLIENT_OTA_PRODUCT_ID="${DESKTOP_CLIENT_OTA_PRODUCT_ID:-world.empery.fofline}"
export DESKTOP_CLIENT_OTA_CHANNEL="${DESKTOP_CLIENT_OTA_CHANNEL:-fofline}"
export DESKTOP_CLIENT_OTA_PACKAGE_ID="${DESKTOP_CLIENT_OTA_PACKAGE_ID:-elite-ew-fo-fline}"
export DESKTOP_CLIENT_OTA_METADATA_KEY_ID="${DESKTOP_CLIENT_OTA_METADATA_KEY_ID:-fofline-meta-1}"
export DESKTOP_CLIENT_OTA_ARTIFACT_KEY_ID="${DESKTOP_CLIENT_OTA_ARTIFACT_KEY_ID:-fofline-artifact-1}"
# Prefer FoFline-specific metadata seed — never sign FoFline latest.v2 with Connected seed.
if [[ -z "${FOFLINE_UPDATE_METADATA_SIGNING_KEY:-}" ]]; then
	echo "FAIL: FOFLINE_UPDATE_METADATA_SIGNING_KEY required (FoFline metadata pubkey is not Connected)" >&2
	exit 2
fi
export DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY="${FOFLINE_UPDATE_METADATA_SIGNING_KEY}"

exec bash "${ROOT}/scripts/eliteew/desktop-client-publish-update.sh" \
	--public-base "${PUBLIC_BASE}" \
	--out "${OUT_DIR}" \
	--notes "${FOFLINE_UPDATE_NOTES:-EliteEW FoFline private OTA}" \
	"$@"
