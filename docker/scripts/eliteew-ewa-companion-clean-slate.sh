#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# DEWA dispatch: full EWA companion clean slate on prod-core (.111) via SSH.
# Invariants:
# - Destructive: Redis FLUSHALL, EWA Postgres schema reset, companion Qdrant collection.
# - Uses prod-baked container names when stack0-eliteew-api-prod-baked is running.
# Related:
# - ewa-companion-clean-slate-interactive.sh
# - documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"

ASSUME_YES=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Full EWA companion reset on prod-core (Redis + EWA PG + episodic Qdrant + API restart).

Options:
  --yes    skip interactive YES (required for DEWA dispatch)
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=1
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

if [[ "${ASSUME_YES}" -eq 0 ]]; then
  echo "ERROR: pass --yes (DEWA sets confirmed=true; script must not prompt)" >&2
  exit 1
fi

if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "ssh ${DEWA_OPS_PROD_CORE_SSH} ewa-companion-clean-slate --yes"
  exit 0
fi

ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s <<'REMOTE'
set -euo pipefail
REPO="${REPO_ROOT:-/home/owned/powered_by_emperyworld}"
cd "${REPO}"
export EWA_CLEAN_SLATE_API_CONTAINER="${EWA_CLEAN_SLATE_API_CONTAINER:-stack0-eliteew-api-prod-baked}"
export EWA_CLEAN_SLATE_CELERY_WORKER="${EWA_CLEAN_SLATE_CELERY_WORKER:-stack0-eliteew-celery-worker-prod-baked}"
export EWA_CLEAN_SLATE_CELERY_BEAT="${EWA_CLEAN_SLATE_CELERY_BEAT:-stack0-eliteew-celery-beat-prod-baked}"
bash docker/scripts/ewa-companion-clean-slate-interactive.sh --yes
REMOTE

echo "✅ EWA companion clean slate complete on ${DEWA_OPS_PROD_CORE_SSH}"
