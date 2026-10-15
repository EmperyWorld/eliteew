#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fail-closed rg gate for FE dirty-typing Patterns A/C/D (API integrity).
# R6 default: REST-strict — only SSE + documented REST exceptions may remain.
# Invariants:
# - Exit 0 when hits ⊆ (SSE allowlist ∪ REST exceptions), unless API_INTEGRITY_STRICT=1.
# - Exit 1 on any new hit outside those files (or any hit in STRICT mode).
# - Does not replace Biome / openapi-ssot-bridge hook / Vitest inventory.
# Related:
# - documentation/api/API-INTEGRITY-BACKLOG.md
# - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption
# - shared/web/frontend/biome.json (noExplicitAny error)
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${FE_ROOT}"

ALLOWLIST_REST="${API_INTEGRITY_ALLOWLIST:-${SCRIPT_DIR}/api-integrity-allowlist.txt}"
ALLOWLIST_SSE="${API_INTEGRITY_ALLOWLIST_SSE:-${SCRIPT_DIR}/api-integrity-allowlist-sse.txt}"
STRICT="${API_INTEGRITY_STRICT:-0}"

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: [API INTEGRITY] rg (ripgrep) is required" >&2
  exit 2
fi

HITS_RAW="$(mktemp "${TMPDIR:-/tmp}/api-integrity-hits.XXXXXX")"
ALLOW_NORM="$(mktemp "${TMPDIR:-/tmp}/api-integrity-allow.XXXXXX")"
NEW_HITS="$(mktemp "${TMPDIR:-/tmp}/api-integrity-new.XXXXXX")"
# Intentionally no rm: trash-retention gate; temp files under /tmp with unique names.

RG_EXCLUDES=(
  --glob '!**/*.test.ts'
  --glob '!**/*.test.tsx'
  --glob '!**/*.spec.ts'
  --glob '!**/*.spec.tsx'
  --glob '!**/__tests__/**'
  --glob '!**/generated/**'
)

: >"${HITS_RAW}"

append_hits() {
  local pattern_id="$1"
  local regex="$2"
  shift 2
  local match
  local line
  local rel
  local rest
  while IFS= read -r match; do
    [[ -z "${match}" ]] && continue
    # rg --no-heading format: path:line:content
    rel="${match%%:*}"
    rest="${match#*:}"
    line="${rest%%:*}"
    [[ "${rel}" == src/* ]] || rel="src/${rel}"
    printf '%s:%s:%s\n' "${rel}" "${line}" "${pattern_id}" >>"${HITS_RAW}"
  done < <(rg -n --no-heading "${RG_EXCLUDES[@]}" "${regex}" "$@" 2>/dev/null || true)
}

# Pattern A — as unknown as in services / domain API surfaces
append_hits A '\bas unknown as\b' \
  src/services \
  src/features/ewa \
  src/features/professional-worlds \
  src/pages/Admin/musicForge \
  src/pages/MarketingCabinet/marketingCabinetApi

# Also *Api.ts under pages/features/services (path may already be covered)
while IFS= read -r path; do
  [[ -z "${path}" ]] && continue
  append_hits A '\bas unknown as\b' "${path}"
done < <(rg --files -g '*Api.ts' -g '*Api.tsx' src/pages src/features src/services 2>/dev/null | rg -v '__tests__|\.test\.|\.spec\.' || true)

# Pattern C — Zod .passthrough( in Marketing + EWA
append_hits C '\.passthrough\s*\(' \
  src/pages/MarketingCabinet/marketingCabinetApi \
  src/services/ewa \
  src/features/ewa

# Pattern D — api.<unknown> on critical contract paths
append_hits D 'api\.(get|post|put|patch|delete)\s*<\s*unknown\s*>' \
  src/features/professional-worlds \
  src/pages/Admin/musicForge \
  src/pages/MarketingCabinet/marketingCabinetApi \
  src/services/ewa \
  src/services/contentApi \
  src/features/ewa

sort -u "${HITS_RAW}" -o "${HITS_RAW}"

normalize_allowlist_file() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "ERROR: [API INTEGRITY] missing allowlist: ${file}" >&2
    exit 2
  fi
  grep -vE '^\s*(#|$)' "${file}" || true
}

if [[ "${STRICT}" == "1" ]]; then
  cp "${HITS_RAW}" "${NEW_HITS}"
else
  {
    normalize_allowlist_file "${ALLOWLIST_REST}"
    normalize_allowlist_file "${ALLOWLIST_SSE}"
  } | sort -u >"${ALLOW_NORM}"
  comm -23 "${HITS_RAW}" "${ALLOW_NORM}" >"${NEW_HITS}" || true
fi

TOTAL="$(wc -l <"${HITS_RAW}" | tr -d ' ')"
NEW_COUNT="$(wc -l <"${NEW_HITS}" | tr -d ' ')"
ALLOW_COUNT=0
if [[ "${STRICT}" != "1" ]]; then
  ALLOW_COUNT="$(wc -l <"${ALLOW_NORM}" | tr -d ' ')"
fi

echo "=== API integrity gate (dirty typing A/C/D) ==="
echo "frontend: ${FE_ROOT}"
echo "mode=rest-strict+sse-allowlist strict=${STRICT}"
echo "hits_total=${TOTAL} allowlisted=${ALLOW_COUNT} new=${NEW_COUNT}"
echo "allowlist_rest=${ALLOWLIST_REST}"
echo "allowlist_sse=${ALLOWLIST_SSE}"

if [[ "${STRICT}" == "1" ]]; then
  if [[ "${TOTAL}" -gt 0 ]]; then
    echo "ERROR: [API INTEGRITY] STRICT mode — ${TOTAL} residual hit(s) remain (incl. P2 SSE)" >&2
    head -50 "${HITS_RAW}" >&2
    exit 1
  fi
  echo "✅ API integrity gate passed (STRICT: zero A/C/D hits)"
  exit 0
fi

if [[ "${NEW_COUNT}" -gt 0 ]]; then
  echo "ERROR: [API INTEGRITY] new dirty-typing hits (not in REST/SSE allowlists):" >&2
  head -50 "${NEW_HITS}" >&2
  if [[ "${NEW_COUNT}" -gt 50 ]]; then
    echo "... ($((NEW_COUNT - 50)) more)" >&2
  fi
  echo "HINT: fix the cast/generic/passthrough, or document in documentation/api/API-INTEGRITY-BACKLOG.md and the matching allowlist (REST vs SSE)." >&2
  echo "HINT: full debt (incl. SSE): API_INTEGRITY_STRICT=1 bash scripts/lint-api-integrity.sh" >&2
  exit 1
fi

echo "✅ API integrity gate passed (REST-strict; SSE/P2 residuals allowlisted)"
exit 0
