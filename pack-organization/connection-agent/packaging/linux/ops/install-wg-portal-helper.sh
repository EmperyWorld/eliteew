#!/bin/bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Install ops-only wg-portal helper + polkit action (never retail RPM).
# Usage: sudo bash packaging/linux/ops/install-wg-portal-helper.sh <path-to-helper-binary>
# Related: documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-02
# ---
set -euo pipefail
src="${1:-}"
if [[ -z "$src" || ! -f "$src" ]]; then
  echo "usage: $0 <eliteew-wg-portal-helper-binary>" >&2
  exit 2
fi
install -d -m 0755 /usr/libexec
install -m 0755 -o root -g root "$src" /usr/libexec/eliteew-wg-portal-helper
policy_src="$(cd "$(dirname "$0")/../../polkit" && pwd)/world.empery.desktop.client.wg.policy.in"
install -d -m 0755 /usr/share/polkit-1/actions
install -m 0644 -o root -g root "$policy_src"   /usr/share/polkit-1/actions/world.empery.desktop.client.wg.policy
echo "OK: helper + polkit installed (ops)"
