#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator CLI for prod-core dual stack0 lines: baked (A) vs dev-bind NFS export (B).
# Invariants:
# - Lines are mutually exclusive on prod-core ports 29000/29001.
# - Sync always stages into ELITEEW_PROD_LINE_EXPORT_ROOT on command-center first.
# Related:
# - docker/scripts/prod-line-lib.sh
# - documentation/platform/PROD-CORE-DEV-BIND-LINE.md
# ---
set -euo pipefail

# shellcheck source=prod-line-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-line-lib.sh"

ASSUME_YES=0
WITH_FRONTEND_BUILD=0
SKIP_SYNC=0
FORCE=0
CMD="${1:-}"

shift || true

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [options]

Commands:
  status                 Show export/manifest/state and prod-core mount/containers
  sync                   Rsync api + apps + documentation + frontend-dist → export root
  export-setup           Prepare NFS export on command-center (+ mount unit hint for .111)
  up-dev-bind            Sync (optional) + recreate stack0 dev-bind line on prod-core
  up-baked               Recreate stack0 baked line on prod-core (public prod path)
  ensure-baked-env       Patch missing STACK0_*_BAKED_IMAGE keys on prod-core runtime env

Options:
  --yes                  Skip confirmation (DEWA / CI)
  --with-frontend-build  Run pnpm build:react-compiler before sync
  --skip-sync            up-dev-bind: skip sync (use existing export)
  --force                Ignore line guard warnings
  --dry-run              Print plan only (DEWA_DRY_RUN=1)
  -h, --help

Environment:
  ELITEEW_PROD_LINE_EXPORT_ROOT  (default: /srv/eliteew/prod-line-export)
  ELITEEW_PROD_LINE_MOUNT        (default: /mnt/eliteew-prod-line-export)
  DEWA_OPS_PROD_CORE_SSH         (default: prod-core)

Examples:
  bash docker/scripts/$(basename "$0") sync --with-frontend-build
  bash docker/scripts/$(basename "$0") up-dev-bind --yes --with-frontend-build
  bash docker/scripts/$(basename "$0") up-baked --yes
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=1
      shift
      ;;
    --with-frontend-build)
      WITH_FRONTEND_BUILD=1
      shift
      ;;
    --acknowledge-dirty)
      PROD_LINE_ACKNOWLEDGE_DIRTY=1
      export PROD_LINE_ACKNOWLEDGE_DIRTY
      shift
      ;;
    --skip-sync)
      SKIP_SYNC=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --dry-run)
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
      exit 2
      ;;
  esac
done

case "${CMD}" in
  status | "")
    prod_line_print_status
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  sync)
    prod_line_sync_export "${WITH_FRONTEND_BUILD}"
    ;;
  export-setup)
    prod_line_confirm "Prepare NFS export under ${PROD_LINE_EXPORT_ROOT}?" "${ASSUME_YES}" || exit 1
    prod_line_export_setup
    ;;
  up-dev-bind)
    prod_line_assert_dev_bind_switch_allowed "${FORCE}" || exit 1
    prod_line_confirm "Switch prod-core stack0 to dev-bind line (downtime on 29000/29001)?" "${ASSUME_YES}" || exit 1
    if [[ "${SKIP_SYNC}" != "1" ]]; then
      prod_line_sync_export "${WITH_FRONTEND_BUILD}"
    fi
    prod_line_remote_mount_ready
    prod_line_remote_recreate_dev_bind
    export PROD_LINE_EXPORT_ROOT PROD_LINE_MOUNT PROD_LINE_MANIFEST_FILE
    prod_line_write_state dev-bind
    prod_line_remote_smoke
    echo "✅ prod-core active line: dev-bind"
    ;;
  up-baked)
    prod_line_confirm "Switch prod-core stack0 to baked line (downtime on 29000/29001)?" "${ASSUME_YES}" || exit 1
    prod_line_remote_recreate_baked
    export PROD_LINE_EXPORT_ROOT PROD_LINE_MOUNT PROD_LINE_MANIFEST_FILE
    prod_line_write_state baked
    prod_line_remote_smoke
    echo "✅ prod-core active line: baked"
    echo "HINT: for image update run eeprodbaked --yes --all (or --backend-only)"
    ;;
  ensure-baked-env)
    prod_line_confirm "Patch missing STACK0_*_BAKED_IMAGE keys on prod-core runtime env?" "${ASSUME_YES}" || exit 1
    prod_line_remote_ensure_baked_env
    prod_line_print_status
    ;;
  *)
    echo "Unknown command: ${CMD}" >&2
    usage >&2
    exit 2
    ;;
esac
