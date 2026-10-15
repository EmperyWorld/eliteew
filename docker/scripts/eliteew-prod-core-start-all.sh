#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Manual full prod-core (.111) startup from command-center: env pull from .136 tmpfs bundle,
# then podman autostart phases (stack1, stack0 baked, stack2/4, edge stacks).
# Invariants:
# - Runs on command-center only; prod-core must reach command-center SSH for env pull.
# - Does not rebuild images; compose up with pre-loaded baked tags.
# Related:
# - podman-autostart-prod-core.sh, prod-core-env-pull-from-cc.sh
# - documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"

ASSUME_YES=0
SKIP_ENV_PUSH=0
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Поднять все prod-core стеки после reboot или аварийной остановки.
С .136: SSH на prod-core → env pull (SOPS bundle) → podman-autostart-prod-core.sh.

Options:
  --yes              skip confirmation
  --skip-env-push    не обновлять SOPS bundle на .136 перед pull (env уже актуален)
  --dry-run          plan only (DEWA_DRY_RUN=1)
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=1
      shift
      ;;
    --skip-env-push)
      SKIP_ENV_PUSH=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      export DEWA_DRY_RUN=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "${ASSUME_YES}" -eq 0 && "${DRY_RUN}" -eq 0 && -t 0 ]]; then
  echo "This will start ALL prod-core Podman stacks on ${DEWA_OPS_PROD_CORE_SSH}."
  read -r -p "Continue? [y/N] " ans
  [[ "${ans}" =~ ^[yY] ]] || exit 0
fi

if [[ "${SKIP_ENV_PUSH}" -eq 0 ]]; then
  echo "=== Step 1/2: refresh env bundle on command-center (for prod-core pull) ==="
  if dewa_ops_is_dry_run; then
    dewa_ops_log_dry_run "eliteew-prod-core-env-push.sh --yes"
  else
    bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/eliteew-prod-core-env-push.sh" --yes
  fi
else
  echo ">>> SKIP env push (--skip-env-push)"
fi

echo "=== Step 2/2: prod-core autostart (env pull + compose up) ==="
if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "ssh ${DEWA_OPS_PROD_CORE_SSH} podman-autostart-prod-core.sh"
  exit 0
fi

ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s <<'REMOTE'
set -euo pipefail
REPO="${REPO_ROOT:-/home/owned/powered_by_emperyworld}"
cd "${REPO}"
bash docker/scripts/podman-autostart-prod-core.sh
REMOTE

echo ""
echo "=== prod-core smoke ==="
ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s <<'REMOTE'
set -euo pipefail
curl -sf --connect-timeout 10 http://127.0.0.1:29000/api/health >/dev/null && echo "✅ API :29000" || echo "❌ API :29000"
curl -sf --connect-timeout 10 http://127.0.0.1:29001/ >/dev/null && echo "✅ frontend :29001" || echo "❌ frontend :29001"
curl -sf --connect-timeout 10 http://127.0.0.1:29002/health >/dev/null && echo "✅ landing :29002" || echo "❌ landing :29002"
podman ps --format "{{.Names}} {{.Status}}" | grep -E '^stack0-eliteew|^stack1-|^stack6-|^stack2-|^stack-yandex|stack0-eliteew-landing' | head -20 || true
REMOTE

echo "✅ prod-core start-all complete"
