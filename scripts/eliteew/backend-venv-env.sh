#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pin host backend tooling to monorepo-root .venv (not shared/api/.venv).
# Source from operator scripts after ELITEEW_ROOT or REPO_ROOT is known.
# Invariants:
# - Podman stack0 images keep /app/ .venv inside the container; this file is host-only.
# Related:
# - documentation/platform/TESTING-STRATEGY.md §Host venv
# - .cursor/rules/dev-tooling.mdc §Backend local venv
# ---

eliteew_backend_venv_init() {
	local repo_root="${1:-}"
	if [[ -z "$repo_root" ]]; then
		echo "eliteew_backend_venv_init: repo root required" >&2
		return 1
	fi
	ELITEEW_ROOT="${repo_root}"
	ELITEEW_API="${repo_root}/shared/api"
	ELITEEW_HOST_VENV="${repo_root}/.venv"
	export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-${ELITEEW_HOST_VENV}}"
	# Parent of package dir `api/` so `import api…` resolves (shared/, not EliteEW/).
	export PYTHONPATH="${PYTHONPATH:-${repo_root}/shared}"
}

eliteew_backend_venv_guard() {
	if [[ -d "${ELITEEW_API}/.venv" ]]; then
		cat >&2 <<EOF
ERROR: stray host venv at shared/api/.venv (canonical: repo-root .venv).
Move to trash: bash scripts/eliteew/trash-move.sh shared/api/.venv
Then sync: cd shared/api && UV_PROJECT_ENVIRONMENT=../../.venv uv sync --extra dev
Then prod-aligned install: bash scripts/eliteew/sync-host-api-venv.sh
EOF
		return 1
	fi
	if [[ ! -x "${ELITEEW_HOST_VENV}/bin/python" ]]; then
		echo "ERROR: host backend venv missing: ${ELITEEW_HOST_VENV}/bin/python" >&2
		echo "See documentation/platform/TESTING-STRATEGY.md §Host venv" >&2
		return 1
	fi
	return 0
}
