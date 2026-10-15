#!/usr/bin/env bash
# EWA companion profile — operator actions on EWA Postgres (+ optional Qdrant episodic).
#
# Requires containers on the host where this runs (typically prod-core .111):
#   main DB: stack1-postgres; EWA: stack-ewa-postgres; API (for Qdrant): stack0-eliteew-api-prod-baked
#
# Usage (repo root or copied onto prod-core):
#   ./docker/scripts/ewa-companion-user-admin.sh reset poet
#   ./docker/scripts/ewa-companion-user-admin.sh set-trust poet 10
#   ./docker/scripts/ewa-companion-user-admin.sh inventory
#   ./docker/scripts/ewa-companion-user-admin.sh reset-all --dry-run
#   EWA_ADMIN_CONFIRM_RESET_ALL=yes ./docker/scripts/ewa-companion-user-admin.sh reset-all
#
# Deprecated / incomplete (prefer reset-all):
#   EWA_ADMIN_CONFIRM_TRUNCATE=yes ./docker/scripts/ewa-companion-user-admin.sh truncate-all-ewa
#
# reset — DELETE ewa_companion_profile for username(s) (CASCADE children) + user_workflows + Qdrant points.
# reset-all — wipe ALL per-user companion state (profiles CASCADE + user_workflows + orchestration
#             + recreate empty companion episodic Qdrant collection). Does NOT touch
#             ewa_platform_setting*, ewa_companion_prompt_block*, ewa_companion_workflow_catalog*.
# set-trust — merge baseline.ewa_companion_trust_v1; profile must exist.
# inventory — print counts (read-only).

set -euo pipefail

MAIN_PG_CONTAINER="${EWA_ADMIN_STACK1_PG_CONTAINER:-stack1-postgres}"
EWA_PG_CONTAINER="${EWA_ADMIN_EWA_PG_CONTAINER:-stack-ewa-postgres}"
API_CONTAINER="${EWA_ADMIN_API_CONTAINER:-stack0-eliteew-api-prod-baked}"
MAIN_PG_USER="${EWA_ADMIN_MAIN_PG_USER:-ai_user}"
MAIN_PG_DB="${EWA_ADMIN_MAIN_PG_DB:-ai_services}"
EWA_PG_USER="${EWA_ADMIN_EWA_PG_USER:-ewa_user}"
EWA_PG_DB="${EWA_ADMIN_EWA_DB:-ewa}"
QDRANT_HTTP="${EWA_ADMIN_QDRANT_HTTP:-http://stack1-qdrant:6333}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

usage() {
  cat <<'EOF'
EWA companion — reset / set-trust / inventory / reset-all (Docker/Podman Postgres + Qdrant).

  ./docker/scripts/ewa-companion-user-admin.sh inventory
  ./docker/scripts/ewa-companion-user-admin.sh reset USER [USER ...]
  ./docker/scripts/ewa-companion-user-admin.sh set-trust USER [SCORE]
  ./docker/scripts/ewa-companion-user-admin.sh reset-all --dry-run
  EWA_ADMIN_CONFIRM_RESET_ALL=yes ./docker/scripts/ewa-companion-user-admin.sh reset-all

  # Deprecated incomplete path (prefer reset-all):
  EWA_ADMIN_CONFIRM_TRUNCATE=yes ./docker/scripts/ewa-companion-user-admin.sh truncate-all-ewa

Env:
  EWA_ADMIN_STACK1_PG_CONTAINER   (default stack1-postgres)
  EWA_ADMIN_EWA_PG_CONTAINER      (default stack-ewa-postgres)
  EWA_ADMIN_API_CONTAINER         (default stack0-eliteew-api-prod-baked)
  EWA_ADMIN_QDRANT_HTTP           (default http://stack1-qdrant:6333 — from API container)
  EWA_ADMIN_EMBED_DIM             (optional override; else AI_EMBEDDINGS_DIMENSION from API)

EOF
  exit 1
}

require_docker() {
  if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
    echo "container runtime not found in PATH: ${CONTAINER_RUNTIME}" >&2
    exit 1
  fi
}

ewa_psql() {
  "${CONTAINER_RUNTIME}" exec -i "$EWA_PG_CONTAINER" psql -U "$EWA_PG_USER" -d "$EWA_PG_DB" -v ON_ERROR_STOP=1 "$@"
}

ewa_psql_t() {
  "${CONTAINER_RUNTIME}" exec "$EWA_PG_CONTAINER" psql -U "$EWA_PG_USER" -d "$EWA_PG_DB" -t -A -v ON_ERROR_STOP=1 -c "$1"
}

validate_username() {
  local u="$1"
  if [[ ! "$u" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "Invalid username (allowed: A–Z a–z 0–9 . _ -): $u" >&2
    exit 1
  fi
}

resolve_principal() {
  local u="$1"
  local pid
  pid="$("${CONTAINER_RUNTIME}" exec "$MAIN_PG_CONTAINER" psql -U "$MAIN_PG_USER" -d "$MAIN_PG_DB" -t -A -v ON_ERROR_STOP=1 -c \
    "SELECT id::text FROM users WHERE lower(username) = lower('${u}');")"
  pid="$(echo -n "$pid" | tr -d '[:space:]')"
  if [[ -z "$pid" ]]; then
    echo "No user with username: $u (main DB $MAIN_PG_DB)" >&2
    return 1
  fi
  echo "$pid"
}

resolve_embed_dim() {
  local dim="${EWA_ADMIN_EMBED_DIM:-}"
  if [[ -z "$dim" ]]; then
    dim="$("${CONTAINER_RUNTIME}" exec "$API_CONTAINER" printenv AI_EMBEDDINGS_DIMENSION 2>/dev/null || true)"
    dim="$(echo -n "$dim" | tr -d '[:space:]')"
  fi
  if [[ -z "$dim" || ! "$dim" =~ ^[0-9]+$ ]]; then
    echo "Cannot resolve embed dim (set EWA_ADMIN_EMBED_DIM or AI_EMBEDDINGS_DIMENSION in API)" >&2
    return 1
  fi
  echo "$dim"
}

companion_episodic_collection() {
  local dim="$1"
  echo "ewa_companion_episodic_v1_d${dim}"
}

print_inventory() {
  echo "=== EWA companion inventory (${EWA_PG_CONTAINER}/${EWA_PG_DB}) ==="
  ewa_psql <<'SQL'
SELECT t, c FROM (
  SELECT 'ewa_companion_profile'::text AS t, COUNT(*)::text AS c FROM ewa_companion_profile
  UNION ALL SELECT 'ewa_companion_episodes', COUNT(*)::text FROM ewa_companion_episodes
  UNION ALL SELECT 'ewa_atom', COUNT(*)::text FROM ewa_atom
  UNION ALL SELECT 'ewa_companion_user_workflows', COUNT(*)::text FROM ewa_companion_user_workflows
  UNION ALL SELECT 'ewa_companion_task_runs', COUNT(*)::text FROM ewa_companion_task_runs
  UNION ALL SELECT 'ewa_companion_plans', COUNT(*)::text FROM ewa_companion_plans
  UNION ALL SELECT 'ewa_agentic_sessions', COUNT(*)::text FROM ewa_agentic_sessions
  UNION ALL SELECT 'ewa_orchestration_session', COUNT(*)::text FROM ewa_orchestration_session
  UNION ALL SELECT 'ewa_platform_setting (preserve)', COUNT(*)::text FROM ewa_platform_setting
  UNION ALL SELECT 'ewa_companion_prompt_block (preserve)', COUNT(*)::text FROM ewa_companion_prompt_block
  UNION ALL SELECT 'ewa_companion_workflow_catalog (preserve)', COUNT(*)::text FROM ewa_companion_workflow_catalog
) s ORDER BY 1;
SQL
}

qdrant_check_reachable() {
  local dim collection
  dim="$(resolve_embed_dim)" || return 1
  collection="$(companion_episodic_collection "$dim")"
  echo "[qdrant] probe ${QDRANT_HTTP} collection=${collection} dim=${dim}"
  "${CONTAINER_RUNTIME}" exec -i "$API_CONTAINER" python - <<PY
import json, sys, urllib.error, urllib.request
base = ${QDRANT_HTTP@Q}
coll = ${collection@Q}
try:
    with urllib.request.urlopen(base + "/collections", timeout=10) as r:
        data = json.load(r)
except Exception as exc:
    print("QDRANT_UNREACHABLE", exc, file=sys.stderr)
    sys.exit(2)
names = [c.get("name") for c in (data.get("result") or {}).get("collections") or []]
print("collections_ok", len(names), "has_target", coll in names)
try:
    with urllib.request.urlopen(base + "/collections/" + coll, timeout=10) as r:
        info = json.load(r)
    pts = ((info.get("result") or {}).get("points_count"))
    print("points_count", pts)
except urllib.error.HTTPError as exc:
    if exc.code == 404:
        print("points_count", 0, "(collection missing)")
    else:
        print("QDRANT_COLLECTION_ERROR", exc, file=sys.stderr)
        sys.exit(3)
PY
}

qdrant_purge_all_episodic() {
  local dim collection
  dim="$(resolve_embed_dim)" || return 1
  collection="$(companion_episodic_collection "$dim")"
  echo "[qdrant] delete+recreate collection=${collection} dim=${dim}"
  "${CONTAINER_RUNTIME}" exec -i "$API_CONTAINER" python - <<PY
import json, sys, urllib.error, urllib.request

base = ${QDRANT_HTTP@Q}
coll = ${collection@Q}
dim = int(${dim@Q})

def req(method, path, body=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        base + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data is not None else {},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)

# Delete if present
try:
    req("DELETE", "/collections/" + coll)
    print("deleted", coll)
except urllib.error.HTTPError as exc:
    if exc.code == 404:
        print("delete_skip_missing", coll)
    else:
        print("DELETE_FAILED", exc, file=sys.stderr)
        sys.exit(4)

# Recreate empty cosine collection (next upserts work without waiting for ensure)
body = {"vectors": {"size": dim, "distance": "Cosine"}}
try:
    req("PUT", "/collections/" + coll, body)
    print("recreated", coll, "dim", dim)
except Exception as exc:
    print("RECREATE_FAILED", exc, file=sys.stderr)
    sys.exit(5)

info = req("GET", "/collections/" + coll)
pts = ((info.get("result") or {}).get("points_count"))
print("points_count_after", pts)
if pts not in (0, None):
    print("UNEXPECTED_POINTS", pts, file=sys.stderr)
    sys.exit(6)
PY
}

qdrant_delete_principal() {
  local pid="$1"
  local dim collection
  dim="$(resolve_embed_dim)" || return 1
  collection="$(companion_episodic_collection "$dim")"
  echo "[qdrant] delete points principal=${pid} collection=${collection}"
  "${CONTAINER_RUNTIME}" exec -i "$API_CONTAINER" python - <<PY
import json, sys, urllib.error, urllib.request

base = ${QDRANT_HTTP@Q}
coll = ${collection@Q}
principal = ${pid@Q}

body = {
    "filter": {"must": [{"key": "principal_id", "match": {"value": principal}}]},
}
data = json.dumps(body).encode("utf-8")
request = urllib.request.Request(
    base + "/collections/" + coll + "/points/delete",
    data=data,
    method="POST",
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(request, timeout=60) as response:
        print(json.load(response))
except urllib.error.HTTPError as exc:
    if exc.code == 404:
        print("collection_missing_skip")
    else:
        print("PRINCIPAL_QDRANT_DELETE_FAILED", exc, file=sys.stderr)
        sys.exit(7)
PY
}

cmd_inventory() {
  print_inventory
  qdrant_check_reachable || true
}

cmd_reset() {
  local u pid
  for u in "$@"; do
    validate_username "$u"
    pid="$(resolve_principal "$u")" || continue
    echo "[$u] principal_id=$pid — DELETE user_workflows + ewa_companion_profile (+ CASCADE)"
    ewa_psql <<SQL
DELETE FROM ewa_companion_user_workflows WHERE principal_id::text = '${pid}';
DELETE FROM ewa_companion_profile WHERE principal_id = '${pid}';
SQL
    qdrant_delete_principal "$pid" || {
      echo "ERROR: Qdrant purge failed for principal=${pid}; PG profile already deleted." >&2
      exit 1
    }
  done
}

cmd_set_trust() {
  local u="$1"
  local score="${2:-10}"
  validate_username "$u"
  if [[ ! "$score" =~ ^[0-9]+$ ]] || (( score < 0 || score > 10 )); then
    echo "trust score must be integer 0..10" >&2
    exit 1
  fi
  local pid
  pid="$(resolve_principal "$u")" || exit 1
  local updated_at
  updated_at="$(date -u +"%Y-%m-%dT%H:%M:%S+00:00")"
  echo "[$u] principal_id=$pid — set ewa_companion_trust_v1.score=$score"
  local out
  out="$(ewa_psql <<SQL
WITH upd AS (
  UPDATE ewa_companion_profile
  SET baseline = jsonb_set(
      COALESCE(baseline, '{}'::jsonb),
      '{ewa_companion_trust_v1}',
      jsonb_build_object('score', ${score}, 'updated_at', '${updated_at}'),
      true
    ),
    companion_revision = companion_revision + 1,
    updated_at = now()
  WHERE principal_id = '${pid}'
  RETURNING principal_id
)
INSERT INTO ewa_companion_profile_audit (principal_id, action, detail)
SELECT
  upd.principal_id,
  'operator_set_trust',
  jsonb_build_object(
    'score', ${score},
    'updated_at', '${updated_at}',
    'source', 'docker/scripts/ewa-companion-user-admin.sh'
  )
FROM upd;
SQL
)"
  echo "$out"
  if echo "$out" | grep -q 'INSERT 0 0'; then
    echo "Warning: no companion profile for $u — run initialize (companion-profile) first; nothing updated." >&2
  fi
}

cmd_reset_all() {
  local dry_run=0
  local arg
  for arg in "$@"; do
    case "$arg" in
      --dry-run | dry-run) dry_run=1 ;;
      -h | --help) usage ;;
      *)
        echo "Unknown reset-all arg: $arg" >&2
        usage
        ;;
    esac
  done

  print_inventory
  local settings_before
  settings_before="$(ewa_psql_t 'SELECT COUNT(*) FROM ewa_platform_setting;')"
  echo "settings_before=${settings_before}"

  if ! qdrant_check_reachable; then
    echo "Refusing reset-all: Qdrant unreachable (fail-closed before PG wipe)." >&2
    exit 1
  fi

  if [[ "$dry_run" -eq 1 ]]; then
    echo "=== dry-run: would wipe per-user companion PG + recreate episodic Qdrant; preserve settings/prompt_blocks/workflow_catalog ==="
    exit 0
  fi

  if [[ "${EWA_ADMIN_CONFIRM_RESET_ALL:-}" != "yes" ]]; then
    echo "Refusing: set EWA_ADMIN_CONFIRM_RESET_ALL=yes (or pass --dry-run)." >&2
    exit 1
  fi

  echo "=== PG wipe: user_workflows + profile CASCADE + orchestration ==="
  ewa_psql <<'SQL'
BEGIN;
-- No FK to profile — must clear explicitly.
DELETE FROM ewa_companion_user_workflows;
-- CASCADE clears episodes, atoms, plans, task_runs, agentic, audit, presets, turn_dedup, …
TRUNCATE TABLE ewa_companion_profile RESTART IDENTITY CASCADE;
-- Desk orchestration (not settings).
TRUNCATE TABLE ewa_orchestration_event, ewa_orchestration_session RESTART IDENTITY CASCADE;
COMMIT;
SQL

  echo "=== Qdrant purge episodic collection ==="
  if ! qdrant_purge_all_episodic; then
    echo "ERROR: Qdrant purge failed after PG wipe — full clear incomplete." >&2
    exit 1
  fi

  echo "=== after ==="
  print_inventory
  local settings_after
  settings_after="$(ewa_psql_t 'SELECT COUNT(*) FROM ewa_platform_setting;')"
  echo "settings_before=${settings_before} settings_after=${settings_after}"
  if [[ "$settings_after" != "$settings_before" ]]; then
    echo "ERROR: ewa_platform_setting count changed — investigate." >&2
    exit 1
  fi

  local profiles
  profiles="$(ewa_psql_t 'SELECT COUNT(*) FROM ewa_companion_profile;')"
  if [[ "$profiles" != "0" ]]; then
    echo "ERROR: profiles remaining=${profiles}" >&2
    exit 1
  fi
  echo "reset-all OK — next companion open runs initialize (first-meet)."
  echo "Residual: SPA localStorage (pins/snooze/onboarding) — hard refresh / clear site data if needed."
}

cmd_truncate_all_ewa() {
  echo "WARNING: truncate-all-ewa is incomplete/dangerous vs reset-all (missing episodes/atoms/Qdrant; incomplete table list)." >&2
  echo "Prefer: EWA_ADMIN_CONFIRM_RESET_ALL=yes $0 reset-all" >&2
  if [[ "${EWA_ADMIN_CONFIRM_TRUNCATE:-}" != "yes" ]]; then
    echo "Refusing: set EWA_ADMIN_CONFIRM_TRUNCATE=yes to force legacy truncate." >&2
    exit 1
  fi
  echo "TRUNCATE legacy subset on container ${EWA_PG_CONTAINER} db=${EWA_PG_DB}"
  ewa_psql <<'SQL'
BEGIN;
TRUNCATE TABLE
  ewa_companion_task_steps,
  ewa_companion_task_runs,
  ewa_companion_quick_action_presets,
  ewa_companion_profile_audit,
  ewa_companion_profile,
  ewa_orchestration_event,
  ewa_orchestration_session
RESTART IDENTITY CASCADE;
COMMIT;
SQL
  echo "Done (legacy). Qdrant NOT purged — run reset-all instead for full clear."
}

main() {
  require_docker
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    inventory)
      cmd_inventory
      ;;
    reset)
      [[ $# -ge 1 ]] || usage
      cmd_reset "$@"
      ;;
    set-trust)
      [[ $# -ge 1 ]] || usage
      cmd_set_trust "$1" "${2:-10}"
      ;;
    reset-all)
      cmd_reset_all "$@"
      ;;
    truncate-all-ewa)
      cmd_truncate_all_ewa
      ;;
    -h | --help | help | "")
      usage
      ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      ;;
  esac
}

main "$@"
