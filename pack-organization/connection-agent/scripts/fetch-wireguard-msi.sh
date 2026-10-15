#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Thin wrapper — real fetch lives under packaging/windows/.
# Invariants:
# - Does not duplicate download logic; fails if packaging script is missing.
# Related:
# - packaging/windows/fetch-wireguard-msi.sh
# - documentation/product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md
# ---
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/packaging/windows/fetch-wireguard-msi.sh"
if [[ ! -f "$TARGET" ]]; then
	echo "FAIL: missing packaging script $TARGET" >&2
	exit 2
fi
exec bash "$TARGET" "$@"
