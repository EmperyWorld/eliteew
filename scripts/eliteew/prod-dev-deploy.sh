#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Canonical dev-bind hotfix entry (replaces missing legacy eeproddev one-shot).
# Invariants:
# - Delegates to eeprodline sync + up-dev-bind; build on command-center only.
# Related:
# - docker/scripts/eeprodline.sh
# - documentation/platform/PROD-CORE-DEV-BIND-LINE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export PROD_LINE_ACKNOWLEDGE_DIRTY="${PROD_LINE_ACKNOWLEDGE_DIRTY:-0}"

WITH_BUILD=0
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-frontend-build) WITH_BUILD=1 ;;
    --acknowledge-dirty) PROD_LINE_ACKNOWLEDGE_DIRTY=1; export PROD_LINE_ACKNOWLEDGE_DIRTY ;;
    --yes) ASSUME_YES=1 ;;
    -h | --help)
      echo "Usage: $(basename "$0") [--with-frontend-build] [--acknowledge-dirty] [--yes]"
      echo "  sync + up-dev-bind on prod-core (Line B hotfix)."
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

SYNC_ARGS=(sync)
[[ "${WITH_BUILD}" == "1" ]] && SYNC_ARGS+=(--with-frontend-build)
[[ "${ASSUME_YES}" == "1" ]] && SYNC_ARGS+=(--yes)

UP_ARGS=(up-dev-bind)
[[ "${ASSUME_YES}" == "1" ]] && UP_ARGS+=(--yes)

bash "${REPO_ROOT}/docker/scripts/eeprodline.sh" "${SYNC_ARGS[@]}"
bash "${REPO_ROOT}/docker/scripts/eeprodline.sh" "${UP_ARGS[@]}"
