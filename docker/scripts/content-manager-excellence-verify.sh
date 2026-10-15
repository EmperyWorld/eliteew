#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# P0 regression entrypoint for Content Manager: stack0 API pytest slice + focused Vitest.
# Invariants:
# - Runs from monorepo root; exit non-zero on first failing phase.
# - API tests use immutable run-stack0-api-tests.sh wrapper only.
# Related:
# - documentation/product/CONTENT-MANAGER.md
# - docker/scripts/run-stack0-api-tests.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="${ROOT}/shared/web/frontend"
API_TEST_WRAPPER="${ROOT}/docker/scripts/run-stack0-api-tests.sh"

# Narrow pytest -k: unified content, folder-view, download tickets, admin content-ops.
PYTEST_K="${CONTENT_MANAGER_PYTEST_K:-unified_content or folder_view or content_folder or download_ticket or admin_content}"

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Content Manager excellence verify (API + frontend contract slice).

Phases:
  1) bash docker/scripts/run-stack0-api-tests.sh tests/ -k '<slice>' -q --tb=short
  2) pnpm exec vitest run — ContentManager, folder window, picker, contentApi downloads

Options:
  -h, --help    Show this help

Env:
  CONTENT_MANAGER_PYTEST_K   override pytest -k expression (default: narrow CM slice)
EOF
}

log_step() {
	printf '\n==> %s\n' "$*"
}

die() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		-h | --help)
			usage
			exit 0
			;;
		*)
			die "unknown option: $1 (try --help)"
			;;
	esac
done

[[ -d "${ROOT}" ]] || die "repo root not found: ${ROOT}"
[[ -x "${API_TEST_WRAPPER}" || -f "${API_TEST_WRAPPER}" ]] || die "missing API test wrapper: ${API_TEST_WRAPPER}"
[[ -d "${FRONTEND_DIR}" ]] || die "frontend dir not found: ${FRONTEND_DIR}"

cd "${ROOT}"

log_step "1/2 stack0 API pytest (content manager slice)"
bash "${API_TEST_WRAPPER}" tests/ -k "${PYTEST_K}" -q --tb=short

log_step "2/2 frontend vitest (Content Manager + folder window + picker + downloads)"
cd "${FRONTEND_DIR}"
pnpm exec vitest run \
	src/pages/ContentManager/ \
	src/pages/Desktop/components/desktopFolderWindow/ \
	src/pages/Desktop/utils/__tests__/folderWindowLibraryDrag.test.ts \
	src/pages/Desktop/utils/__tests__/folderWindowTreeDrop.test.ts \
	src/components/UnifiedContent/picker/ \
	src/services/contentApi.downloads.test.ts \
	src/services/contentApi.disposition.test.ts \
	src/services/content/contentDownloadResilience.test.ts \
	src/services/__tests__/contentDownloadWithRetry.test.ts

printf '\n[content-manager-excellence-verify] PASS\n'
