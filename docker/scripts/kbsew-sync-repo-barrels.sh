#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sync repo trees into KBSEW barrels (docs / api / frontend) via multipart ingest/upload.
# Invariants:
# - Mutations require admin JWT (service token is read-only).
# - Idempotent uploads by content hash (KBSEW asset revisions).
# Related:
# - documentation/product/KBSEW.md
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
URL="${KBSEW_SERVICE_URL:-http://127.0.0.1:28030}"
URL="${URL%/}"
BARREL="docs"
DRY_RUN=0
LIMIT=0
MAX_BYTES="${KBSEW_SYNC_MAX_BYTES:-2097152}"

usage() {
  cat <<'EOF'
Sync repository paths into KBSEW barrels.

  bash docker/scripts/kbsew-sync-repo-barrels.sh --barrel docs|api|fe [--dry-run] [--limit N]

Env:
  KBSEW_SERVICE_URL                 Default http://127.0.0.1:28030 (or stack0 gateway origin + path)
  KBSEW_ADMIN_BEARER                Admin JWT for create/upload (preferred)
  KBSEW_INTERNAL_SERVICE_TOKEN      Alt auth when server has KBSEW_SERVICE_CAN_MUTATE=true
  KBSEW_SYNC_BARREL_ID_DOCS|API|FE  Optional fixed barrel UUID (skip create-by-name)
  KBSEW_SYNC_MAX_BYTES              Skip files larger than this (default 2MiB)
  ELITEEW_REPO_ROOT                 Override repo root (default: detected)

Barrels:
  docs  name=eliteew-docs       driver=markdown       paths=documentation/{product,platform,api,database,reference}
  api   name=eliteew-api        driver=code_python    paths=shared/api/**/*.py (deny tests/migrations noise)
  fe    name=eliteew-frontend   driver=code_typescript paths=shared/web/frontend/src/**/*.{ts,tsx}
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --barrel) BARREL="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --limit) LIMIT="${2:-0}"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

case "$BARREL" in
  docs|api|fe) ;;
  *) echo "ERROR: --barrel must be docs|api|fe" >&2; exit 2 ;;
esac

if [[ -z "${KBSEW_ADMIN_BEARER:-}" && -z "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" && "$DRY_RUN" != "1" ]]; then
  echo "ERROR: set KBSEW_ADMIN_BEARER (admin JWT) or KBSEW_INTERNAL_SERVICE_TOKEN" >&2
  echo "NOTE: service token mutations require KBSEW_SERVICE_CAN_MUTATE=true on stack-kbsew." >&2
  exit 2
fi
if [[ -z "${KBSEW_ADMIN_BEARER:-}" && -n "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" && "$DRY_RUN" != "1" ]]; then
  echo "[kbsew-sync] using service token (requires KBSEW_SERVICE_CAN_MUTATE=true on server)" >&2
fi
# --dry-run may omit auth (local file inventory only).

REPO_ROOT="${ELITEEW_REPO_ROOT:-$ROOT}"
AUTH=(-H "accept: application/json")
if [[ -n "${KBSEW_ADMIN_BEARER:-}" ]]; then
  AUTH=(-H "authorization: Bearer ${KBSEW_ADMIN_BEARER}" -H "accept: application/json")
elif [[ -n "${KBSEW_INTERNAL_SERVICE_TOKEN:-}" ]]; then
  AUTH=(-H "X-KBSEW-Service-Token: ${KBSEW_INTERNAL_SERVICE_TOKEN}" -H "accept: application/json")
fi

barrel_name=""
driver=""
case "$BARREL" in
  docs) barrel_name="eliteew-docs"; driver="markdown" ;;
  api) barrel_name="eliteew-api"; driver="code_python" ;;
  fe) barrel_name="eliteew-frontend"; driver="code_typescript" ;;
esac

resolve_barrel_id() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY-RUN"
    return 0
  fi
  local fixed=""
  case "$BARREL" in
    docs) fixed="${KBSEW_SYNC_BARREL_ID_DOCS:-}" ;;
    api) fixed="${KBSEW_SYNC_BARREL_ID_API:-}" ;;
    fe) fixed="${KBSEW_SYNC_BARREL_ID_FE:-}" ;;
  esac
  if [[ -n "$fixed" ]]; then
    echo "$fixed"
    return 0
  fi
  local list
  list="$(curl -sf "${AUTH[@]}" "${URL}/api/v1/kbsew/barrels")"
  local id
  id="$(printf '%s' "$list" | python3 -c '
import json,sys
name=sys.argv[1]
rows=json.load(sys.stdin)
for r in rows:
    if isinstance(r, dict) and str(r.get("name") or "") == name:
        print(r.get("id") or "")
        break
' "$barrel_name")"
  if [[ -n "$id" ]]; then
    echo "$id"
    return 0
  fi
  local created
  created="$(curl -sf "${AUTH[@]}" -H "content-type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"name":sys.argv[1],"description":sys.argv[2],"driver_type":sys.argv[3],"enabled":True}))' \
      "$barrel_name" "EliteEW repo sync ($BARREL)" "$driver")" \
    "${URL}/api/v1/kbsew/barrels")"
  printf '%s' "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id") or "")'
}

collect_files() {
  local -a files=()
  case "$BARREL" in
    docs)
      while IFS= read -r -d '' f; do
        files+=("$f")
      done < <(find "$REPO_ROOT/documentation/product" "$REPO_ROOT/documentation/platform" \
        "$REPO_ROOT/documentation/api" "$REPO_ROOT/documentation/database" \
        "$REPO_ROOT/documentation/reference" \
        -type f \( -name '*.md' -o -name '*.markdown' \) -print0 2>/dev/null || true)
      ;;
    api)
      while IFS= read -r -d '' f; do
        case "$f" in
          */tests/*|*/migrations/*|*/.venv/*|*/__pycache__/*) continue ;;
        esac
        files+=("$f")
      done < <(find "$REPO_ROOT/shared/api" -type f -name '*.py' -print0 2>/dev/null || true)
      ;;
    fe)
      while IFS= read -r -d '' f; do
        case "$f" in
          */node_modules/*|*/dist/*|*/dist-build/*|*/__tests__/*) continue ;;
        esac
        files+=("$f")
      done < <(find "$REPO_ROOT/shared/web/frontend/src" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null || true)
      ;;
  esac
  printf '%s\0' "${files[@]}"
}

BARREL_ID="$(resolve_barrel_id)"
echo "[kbsew-sync] barrel=$BARREL name=$barrel_name driver=$driver id=${BARREL_ID:-'(pending)'} dry_run=$DRY_RUN"

uploaded=0
skipped=0
failed=0
seen=0

while IFS= read -r -d '' file; do
  [[ -z "$file" ]] && continue
  seen=$((seen + 1))
  if [[ "$LIMIT" -gt 0 && "$seen" -gt "$LIMIT" ]]; then
    break
  fi
  size="$(wc -c <"$file" | tr -d ' ')"
  if [[ "$size" -gt "$MAX_BYTES" ]]; then
    echo "[kbsew-sync] skip large ($size) $file"
    skipped=$((skipped + 1))
    continue
  fi
  rel="${file#"$REPO_ROOT"/}"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[kbsew-sync] dry-run upload $rel"
    uploaded=$((uploaded + 1))
    continue
  fi
  if [[ -z "$BARREL_ID" ]]; then
    echo "ERROR: empty barrel id" >&2
    exit 1
  fi
  if curl -sf "${AUTH[@]}" \
    -F "file=@${file};filename=${rel}" \
    -F "driver_type=${driver}" \
    "${URL}/api/v1/kbsew/barrels/${BARREL_ID}/ingest/upload" >/tmp/kbsew-sync-last.json; then
    echo "[kbsew-sync] queued $rel"
    uploaded=$((uploaded + 1))
  else
    echo "[kbsew-sync] FAIL $rel" >&2
    failed=$((failed + 1))
  fi
done < <(collect_files)

echo "[kbsew-sync] done seen=$seen uploaded=$uploaded skipped=$skipped failed=$failed"
[[ "$failed" -eq 0 ]]
