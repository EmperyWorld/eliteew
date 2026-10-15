#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Thin wrapper — real icon rebuild lives under packaging/linux/.
# Invariants:
# - Does not duplicate imaging logic; fails if packaging script is missing.
# Related:
# - packaging/linux/regenerate-icons.sh
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/packaging/linux/regenerate-icons.sh"
if [[ ! -f "$TARGET" ]]; then
	echo "FAIL: missing packaging script $TARGET" >&2
	exit 2
fi
exec bash "$TARGET" "$@"
