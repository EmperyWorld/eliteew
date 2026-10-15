#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# C2: single script SoT — rootfs_overlay is living BR SoT; sync shared helpers
# into payload-templates (EmpiierOS preflight / overlay mirror). Does NOT
# overwrite profile-specific labels.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OV="${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay"
PT="${ROOT}/payload-templates"
CHECK_ONLY=0

die() { echo "FATAL: $*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: sync-payload-templates-from-overlay.sh [--check]

  (default) copy shared overlay helpers → payload-templates
  --check   exit 0 only if shared paths already match (no write)
EOF
}

[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && { usage; exit 0; }
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

[[ -d "$OV" ]] || die "missing overlay: $OV"
[[ -d "$PT" ]] || die "missing payload-templates: $PT"

# overlay_rel → payload-templates_rel
declare -a PAIRS=(
  "usr/local/bin/eliteew-ts-install-apply:usr-local-bin/eliteew-ts-install-apply"
  "usr/local/bin/eliteew-ts-installer-session:usr-local-bin/eliteew-ts-installer-session"
  "usr/local/bin/eliteew-ts-kiosk:usr-local-bin/eliteew-ts-kiosk"
  "usr/local/bin/eliteew-ts-session-router:usr-local-bin/eliteew-ts-session-router"
  "usr/local/bin/eliteew-ts-secrets-up:usr-local-bin/eliteew-ts-secrets-up"
  "usr/local/bin/eliteew-ts-smoke:usr-local-bin/eliteew-ts-smoke"
  "home/eliteew-ts/.bash_profile:home-eliteew-ts/.bash_profile"
  "etc/systemd/system/eliteew-ts-kiosk.service:systemd/eliteew-ts-kiosk.service"
  "etc/systemd/system/eliteew-ts-tunnel.service:systemd/eliteew-ts-tunnel.service"
  "etc/systemd/system/getty@tty1.service.d/autologin.conf:systemd/getty@tty1.service.d/autologin.conf"
  "usr/share/mime/packages/eliteew-capsule.xml:usr-share-mime-packages/eliteew-capsule.xml"
)

# Optional binary (gitignored in overlay; tracked under payload-templates)
if [[ -x "$OV/usr/local/bin/eliteew-ts-installer" ]]; then
  PAIRS+=("usr/local/bin/eliteew-ts-installer:usr-local-bin/eliteew-ts-installer")
fi

mismatches=0
for pair in "${PAIRS[@]}"; do
  src="${OV}/${pair%%:*}"
  dst="${PT}/${pair#*:}"
  [[ -e "$src" ]] || die "overlay missing: $src"
  if [[ "$CHECK_ONLY" -eq 1 ]]; then
    if [[ ! -e "$dst" ]] || ! cmp -s "$src" "$dst"; then
      echo "MISMATCH: $src  vs  $dst"
      mismatches=$((mismatches + 1))
    else
      echo "OK  $pair"
    fi
  else
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
    echo "synced $pair"
  fi
done

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  [[ "$mismatches" -eq 0 ]] || die "$mismatches shared path(s) diverge — run without --check"
  echo "sync-payload-templates-from-overlay: CHECK OK"
else
  echo "sync-payload-templates-from-overlay: OK (labels intentionally not synced)"
fi
