#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# U2 inventory: fail if createPortal(..., document.body) appears under
# pages/Desktop outside shell/shellBodyPortal.tsx (and optional test paths).
# Related:
# - shared/web/frontend/src/pages/Desktop/shell/shellBodyPortal.tsx
# - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESKTOP="${ROOT}/shared/web/frontend/src/pages/Desktop"
ALLOWED="${DESKTOP}/shell/shellBodyPortal.tsx"

if [[ ! -d "${DESKTOP}" ]]; then
	echo "desktop-u2-portal-inventory: missing ${DESKTOP}" >&2
	exit 2
fi

# Only files that import createPortal from react-dom (skip comment-only hits).
mapfile -t hits < <(
	rg -l --glob '*.{ts,tsx}' --glob '!**/__tests__/**' --glob '!**/*.{test,spec}.{ts,tsx}' \
		"from 'react-dom'" "${DESKTOP}" 2>/dev/null | while read -r file; do
		[[ "${file}" == "${ALLOWED}" ]] && continue
		if ! rg -q '\bcreatePortal\b' "${file}"; then
			continue
		fi
		# Strip // and /* */ comments, then look for createPortal(..., document.body)
		if python3 - "${file}" <<'PY'
import re, sys
path = sys.argv[1]
src = open(path, encoding="utf-8").read()
src = re.sub(r"/\*[\s\S]*?\*/", " ", src)
src = re.sub(r"(^|[^:])//.*$", r"\1", src, flags=re.M)
if re.search(r"createPortal\s*\(\s*[\s\S]{0,400}?,\s*document\.body\s*\)", src):
    sys.exit(0)
sys.exit(1)
PY
		then
			echo "${file}"
		fi
	done
)

if ((${#hits[@]} > 0)); then
	echo "U2 FAIL: createPortal(..., document.body) outside shellBodyPortal.tsx:" >&2
	printf '  %s\n' "${hits[@]}" >&2
	exit 1
fi

echo "U2 OK: sole body createPortal owner is shell/shellBodyPortal.tsx"
exit 0
