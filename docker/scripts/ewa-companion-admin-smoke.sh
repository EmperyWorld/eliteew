#!/usr/bin/env bash
# EWA Companion — operator smoke (master-plan §12): automated layer for stack0.
#
# Автоматизирует: health контейнеров, проверку EWA_* flags в Postgres, pytest contract/trigger/admin.
# Ручной слой (desktop UI, SSE, Confirm) — см. documentation/product/ewa/EWA-COMPANION-ADMIN-SMOKE-STACK0.md
#
# Usage (repo root):
#   ./docker/scripts/ewa-companion-admin-smoke.sh
#   ./docker/scripts/ewa-companion-admin-smoke.sh --skip-pytest
#   EWA_SMOKE_API_CONTAINER=stack0-eliteew-api-prod ./docker/scripts/ewa-companion-admin-smoke.sh
#   EWA_SMOKE_BEARER_TOKEN=... ./docker/scripts/ewa-companion-admin-smoke.sh --skip-pytest
#
# Exit 0 — automated checks PASS; оператор всё равно должен закрыть manual checklist в doc.

set -euo pipefail

API_CONTAINER="${EWA_SMOKE_API_CONTAINER:-stack0-eliteew-api-prod}"
CELERY_CONTAINER="${EWA_SMOKE_CELERY_CONTAINER:-stack0-eliteew-celery-worker-prod}"
EWA_PG_CONTAINER="${EWA_SMOKE_EWA_PG_CONTAINER:-stack-ewa-postgres}"
EWA_PG_USER="${EWA_SMOKE_EWA_PG_USER:-ewa_user}"
EWA_PG_DB="${EWA_SMOKE_EWA_DB:-ewa}"
SKIP_PYTEST=0
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

usage() {
  cat <<'EOF'
EWA Companion admin smoke — automated checks (§12 partial).

  ./docker/scripts/ewa-companion-admin-smoke.sh [--skip-pytest]

Env:
  EWA_SMOKE_API_CONTAINER      (default stack0-eliteew-api-prod)
  EWA_SMOKE_CELERY_CONTAINER   (default stack0-eliteew-celery-worker-prod)
  EWA_SMOKE_EWA_PG_CONTAINER   (default stack-ewa-postgres)
  EWA_SMOKE_BEARER_TOKEN       Optional: run live companion plan API smoke

Manual UI steps: documentation/product/ewa/EWA-COMPANION-ADMIN-SMOKE-STACK0.md
EOF
  exit 1
}

log() { printf '[ewa-smoke] %s\n' "$*"; }
fail() { printf '[ewa-smoke] FAIL: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pytest) SKIP_PYTEST=1; shift ;;
    -h | --help) usage ;;
    *) fail "Unknown arg: $1 (use --help)" ;;
  esac
done

command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1 || fail "container runtime not found: ${CONTAINER_RUNTIME}"

container_running() {
  "${CONTAINER_RUNTIME}" inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -qx true
}

check_health() {
  local name="$1"
  container_running "$name" || fail "container not running: $name"
  log "OK running: $name"
}

check_api_health() {
  "${CONTAINER_RUNTIME}" exec "$API_CONTAINER" curl -sf http://127.0.0.1:8000/health >/dev/null \
    || fail "API /health failed inside $API_CONTAINER"
  log "OK API /health"
}

read_setting() {
  local key="$1"
  "${CONTAINER_RUNTIME}" exec "$EWA_PG_CONTAINER" psql -U "$EWA_PG_USER" -d "$EWA_PG_DB" -t -A -v ON_ERROR_STOP=1 -c \
    "SELECT value_text FROM ewa_platform_setting WHERE setting_key = '$key'" 2>/dev/null || echo ""
}

check_db_flags() {
  local -a required=(
    EWA_COMPANION_WF_ENGINE_ENABLED=1
    EWA_COMPANION_WF_MUSIC_FULL_V1=1
    EWA_COMPANION_ASYNC_JOBS_ENABLED=1
    EWA_COMPANION_ADMIN_ENABLED=1
    EWA_COMPANION_IMAGE_GENERATION_ENABLED=1
    EWA_COMPANION_PLAN_ENABLED=1
  )
  local pair key want val
  for pair in "${required[@]}"; do
    key="${pair%%=*}"
    want="${pair##*=}"
    val="$(read_setting "$key" | tr -d '[:space:]')"
    if [[ "$val" != "$want" ]]; then
      fail "DB setting $key=$val (expected $want) — fix on admin Settings tab"
    fi
    log "OK DB $key=$val"
  done
}

check_prompt_blocks_seeded() {
  local cnt
  cnt="$("${CONTAINER_RUNTIME}" exec "$EWA_PG_CONTAINER" psql -U "$EWA_PG_USER" -d "$EWA_PG_DB" -t -A -v ON_ERROR_STOP=1 -c \
    "SELECT COUNT(*) FROM ewa_companion_prompt_block" 2>/dev/null || echo "0")"
  cnt="$(echo "$cnt" | tr -d '[:space:]')"
  if [[ -z "$cnt" || "$cnt" -lt 20 ]]; then
    fail "ewa_companion_prompt_block count=$cnt (expected ≥20 after migration 034 + API bootstrap)"
  fi
  log "OK prompt_blocks seeded count=$cnt"
}

check_runtime_plan_api() {
  if [[ -z "${EWA_SMOKE_BEARER_TOKEN:-}" ]]; then
    log "SKIP runtime plan API smoke (set EWA_SMOKE_BEARER_TOKEN)"
    return
  fi
  "${CONTAINER_RUNTIME}" exec -e EWA_SMOKE_BEARER_TOKEN="$EWA_SMOKE_BEARER_TOKEN" "$API_CONTAINER" python - <<'PY' \
    || fail "runtime plan API smoke failed"
import json
import os
import sys
import urllib.error
import urllib.request

token = os.environ.get("EWA_SMOKE_BEARER_TOKEN", "").strip()
payload = json.dumps({"message": "Составь план на неделю по EWA companion runtime smoke."}).encode("utf-8")
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/ewa/companion-chat/message",
    data=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=45) as resp:
        body = resp.read().decode("utf-8", "replace")
        status = resp.status
except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", "replace")
    print(f"HTTP {exc.code}: {body[:500]}", file=sys.stderr)
    raise SystemExit(1) from exc

try:
    data = json.loads(body)
except json.JSONDecodeError as exc:
    print(f"Invalid JSON response ({status}): {body[:500]}", file=sys.stderr)
    raise SystemExit(1) from exc

reply = str(data.get("reply") or "")
branch = str(data.get("orchestration_branch") or "")
if "EWA_COMPANION_PLAN_ENABLED" in reply or "Не удалось сохранить план" in reply:
    print(f"Plan flag/cache blocker in reply: {reply[:500]}", file=sys.stderr)
    raise SystemExit(1)
if branch != "plan_v1" and "Цели" not in reply and "Шаги" not in reply and "Goals" not in reply:
    print(f"Unexpected plan reply branch={branch!r}: {reply[:500]}", file=sys.stderr)
    raise SystemExit(1)
print("OK runtime plan API smoke")
PY
  log "OK runtime plan API smoke"
}

run_pytest() {
  local tests=(
    tests/test_companion_tool_catalog_contract.py
    tests/test_ewa_companion_action_workflow_triggers.py
    tests/test_ewa_companion_admin_api.py
    tests/test_ewa_companion_admin_settings_api.py
    tests/test_ewa_companion_admin_smoke_stack0.py
    tests/test_ewa_companion_admin_users_allowlist.py
    tests/test_ewa_companion_prompt_blocks.py
    tests/test_ewa_companion_workflow_run_capacity.py
  )
  local joined=""
  local t
  for t in "${tests[@]}"; do
    joined="$joined $t"
  done
  log "pytest:$joined"
  "${CONTAINER_RUNTIME}" exec "$API_CONTAINER" sh -lc \
    "cd /app/api && PYTHONPATH=. .venv/bin/python -m pytest -q$joined" \
    || fail "pytest smoke bundle failed"
  log "OK pytest smoke bundle"
}

main() {
  log "=== EWA Companion smoke (automated) ==="
  check_health "$API_CONTAINER"
  if container_running "$CELERY_CONTAINER"; then
    log "OK running: $CELERY_CONTAINER"
  else
    log "WARN: $CELERY_CONTAINER not running — async music workflow may fail (check lan141 worker?)"
  fi
  check_health "$EWA_PG_CONTAINER"
  check_api_health
  check_db_flags
  check_prompt_blocks_seeded
  check_runtime_plan_api
  if [[ "$SKIP_PYTEST" -eq 0 ]]; then
    run_pytest
  else
    log "SKIP pytest (--skip-pytest)"
  fi
  log "=== Automated PASS ==="
  log "Next: manual checklist → documentation/product/ewa/EWA-COMPANION-ADMIN-SMOKE-STACK0.md §3"
}

main "$@"
