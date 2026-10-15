#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Tracked regression gate for Windows NSIS build VM — SSH + toolchain, no NSIS rebuild.
# Invariants:
# - Fail-closed if guest unreachable or Node/pnpm/Rust missing.
# - Does not run `build` (full NSIS) — that stays an explicit operator/agent step.
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md
# - scripts/eliteew/desktop-client-build-windows-remote.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WRAP="${ROOT}/scripts/eliteew/desktop-client-build-windows-remote.sh"

if [[ ! -x "$WRAP" && ! -f "$WRAP" ]]; then
	echo "FAIL: missing wrapper $WRAP" >&2
	exit 2
fi

out="$(mktemp)"
cleanup() { rm -f "$out"; }
trap cleanup EXIT

echo "=== desktop-client Windows build-VM smoke ==="
if ! bash "$WRAP" test >"$out" 2>&1; then
	cat "$out" >&2
	echo "FAIL: windows remote test" >&2
	exit 1
fi
cat "$out"
if ! grep -q 'SSH_OK' "$out"; then
	echo "FAIL: expected SSH_OK in smoke output" >&2
	exit 1
fi
if ! grep -q 'TOOLCHAIN_OK' "$out"; then
	echo "FAIL: expected TOOLCHAIN_OK (guest Node/pnpm/Rust)" >&2
	exit 1
fi
echo "PASS desktop-client-windows-smoke"
