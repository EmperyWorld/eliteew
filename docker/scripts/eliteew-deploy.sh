#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unified deploy CLI: gate → build/package → transfer → verify for stack0 lines A/B.
# Invariants:
# - Delegates to canonical eeprodbaked / eeprodline / eeprodruntime / eeprodstack6 scripts.
# - `deploy stack0` runs provenance gate before release and verify after (unless skipped).
# Related:
# - docker/scripts/eliteew-docker-aliases.sh
# - documentation/platform/audit/README.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [subcommand] [options…]

Commands:
  deploy stack0 [--yes] --all   gate → baked release → verify
  release stack0 [--yes] --all  → eeprodbaked (canonical stack0 release; --all required for agents)
                         optional: --refresh-openapi-pilots (tree OpenAPI → pilots before SPA build)
  hotfix stack0 sync|up-dev-bind|up-baked|status [opts…]         → eeprodline
  release runtime [--yes] [--all|--stack2-only|--stack4-only]    → eeprodruntime
  release stack6 [--yes] [--all|--build-only]                    → eeprodstack6 (Keycloak 26.7.1 + SPI)
  audit export [--live] [--out FILE]                             → deploy-provenance-audit.sh
  verify [--live] [--strict]                                     → deploy-provenance-verify.sh
  gate --release | --hotfix [--acknowledge-dirty]                → deploy-provenance-gate.sh
  selftest                                                       → verify-deploy-provenance-gate-selftest.sh

Examples:
  bash docker/scripts/$(basename "$0") deploy stack0 --yes --all
  bash docker/scripts/$(basename "$0") verify --live --strict
  bash docker/scripts/$(basename "$0") release stack0 --all
  bash docker/scripts/$(basename "$0") release stack0 --all --yes
  bash docker/scripts/$(basename "$0") release stack0 --all --yes --refresh-openapi-pilots
  bash docker/scripts/$(basename "$0") release stack0 --all --yes --no-maintenance

Agent / default release invariant: always "release stack0 --all".
Do not use --frontend-only / --backend-only for stack0 release (legacy CLI only).
`release stack0 --all` enables a ~60s user-visible maintenance notice before recreate
(Redis + static JSON; opt-out: --no-maintenance). See USER-SAFE-RESTARTS-AND-MAINTENANCE.md.

Legacy paths (eedeploy menu, eeproddev) remain deprecated — use subcommands above.
EOF
}

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 2
fi

CMD="$1"
shift

case "${CMD}" in
  deploy)
    SUB="${1:-}"
    shift || true
    case "${SUB}" in
      stack0)
        bash "${SCRIPT_DIR}/deploy-provenance-gate.sh" --release
        bash "${REPO_ROOT}/docker/scripts/eliteew-stack0-baked-deploy.sh" "$@"
        ;;
      *)
        echo "ERROR: deploy requires stack0 subcommand" >&2
        exit 2
        ;;
    esac
    ;;
  release)
    SUB="${1:-}"
    shift || true
    case "${SUB}" in
      stack0)
        exec bash "${REPO_ROOT}/docker/scripts/eliteew-stack0-baked-deploy.sh" "$@"
        ;;
      runtime)
        exec bash "${REPO_ROOT}/docker/scripts/eliteew-prod-core-runtime-deploy.sh" "$@"
        ;;
      stack6)
        exec bash "${REPO_ROOT}/docker/scripts/eeprodstack6.sh" "$@"
        ;;
      *)
        echo "ERROR: release requires stack0, runtime, or stack6" >&2
        exit 2
        ;;
    esac
    ;;
  hotfix)
    SUB="${1:-}"
    shift || true
    case "${SUB}" in
      stack0)
        exec bash "${REPO_ROOT}/docker/scripts/eeprodline.sh" "$@"
        ;;
      *)
        echo "ERROR: hotfix requires stack0 subcommand (sync|up-dev-bind|up-baked|status)" >&2
        exit 2
        ;;
    esac
    ;;
  audit)
    SUB="${1:-export}"
    shift || true
    case "${SUB}" in
      export)
        exec bash "${SCRIPT_DIR}/deploy-provenance-audit.sh" "$@"
        ;;
      *)
        echo "ERROR: unknown audit subcommand: ${SUB}" >&2
        exit 2
        ;;
    esac
    ;;
  verify)
    exec bash "${SCRIPT_DIR}/deploy-provenance-verify.sh" "$@"
    ;;
  gate)
    exec bash "${SCRIPT_DIR}/deploy-provenance-gate.sh" "$@"
    ;;
  selftest)
    exec bash "${SCRIPT_DIR}/verify-deploy-provenance-gate-selftest.sh" "$@"
    ;;
  -h | --help | help)
    usage
    ;;
  *)
    echo "ERROR: unknown command: ${CMD}" >&2
    usage >&2
    exit 2
    ;;
esac
