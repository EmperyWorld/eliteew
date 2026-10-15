#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stack0 UGS operator smoke — API health, UGS health/providers, optional queue-ops, ComfyUI probe,
# optional SSE generate/stream path proof (UGS_SMOKE_SSE=1).
# Invariants:
# - ComfyUI probe on command-center :31003 is informational only (non-fatal).
# - SSE path is opt-in; requires TOKEN; default type_key=text_chat (billing may apply).
# Related:
# - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md
# - documentation/product/UGS-HUB-STABILITY-PROGRAM.md
# ---
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:29000}"
UGS_BASE="${API_BASE}/api/v1/ugs"
TOKEN="${TOKEN:-${UGS_ADMIN_TOKEN:-}}"
COMFY_BASE="${COMFY_BASE:-http://192.168.1.136:31003}"
# Opt-in path proof: TOKEN + UGS_SMOKE_SSE=1 runs short SSE generate→terminal event
UGS_SMOKE_SSE="${UGS_SMOKE_SSE:-0}"
UGS_SMOKE_TYPE_KEY="${UGS_SMOKE_TYPE_KEY:-text_chat}"
UGS_SMOKE_PROMPT="${UGS_SMOKE_PROMPT:-UGS smoke: reply with OK only.}"
UGS_SMOKE_SSE_MAX_SEC="${UGS_SMOKE_SSE_MAX_SEC:-120}"
CURL=(curl -fsS --connect-timeout 8 --max-time 20)

log() {
  printf '[ugs-stack0-smoke] %s\n' "$*"
}

fail() {
  printf '[ugs-stack0-smoke] FAIL: %s\n' "$*" >&2
  exit 1
}

auth_args=()
if [[ -n "${TOKEN}" ]]; then
  auth_args=(-H "Authorization: Bearer ${TOKEN}")
fi

log "stack0 API health ${API_BASE}/api/health"
"${CURL[@]}" "${API_BASE}/api/health" >/dev/null || fail "GET /api/health"
log "ok: stack0 /api/health"

log "UGS aggregate health ${UGS_BASE}/health"
ugs_health="$("${CURL[@]}" "${UGS_BASE}/health")"
if command -v jq >/dev/null 2>&1; then
  printf '%s\n' "${ugs_health}" | jq -e '.status != null and .providers != null' >/dev/null \
    || fail "UGS /health JSON shape"
  log "ok: UGS /health ($(printf '%s' "${ugs_health}" | jq -r '.status'))"
else
  printf '%s\n' "${ugs_health}" | rg -q '"status"' || fail "UGS /health missing status"
  log "ok: UGS /health (jq unavailable — status key present)"
fi

log "UGS providers status ${UGS_BASE}/providers/status"
providers_body="$(curl -sS --connect-timeout 8 --max-time 20 \
  "${auth_args[@]}" \
  -w '\n%{http_code}' \
  "${UGS_BASE}/providers/status" || printf '\n000')"
providers_http="${providers_body##*$'\n'}"
providers_json="${providers_body%$'\n'*}"
if [[ "${providers_http}" == "200" ]]; then
  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "${providers_json}" | jq -e '.summary.total >= 0 and (.providers | type) == "array"' >/dev/null \
      || fail "providers/status JSON shape"
    summary="$(printf '%s\n' "${providers_json}" | jq -c '.summary')"
    log "ok: providers/status ${summary}"
  else
    printf '%s\n' "${providers_json}" | rg -q '"summary"' || fail "providers/status missing summary"
    log "ok: providers/status (jq unavailable — summary key present)"
  fi
elif [[ "${providers_http}" == "401" || "${providers_http}" == "403" ]]; then
  if [[ -z "${TOKEN}" ]]; then
    log "skip: providers/status requires Bearer TOKEN (set TOKEN or UGS_ADMIN_TOKEN)"
  else
    fail "providers/status HTTP ${providers_http} with TOKEN set"
  fi
else
  fail "providers/status HTTP ${providers_http:-000}"
fi

if [[ -n "${TOKEN}" ]]; then
  log "UGS admin queue-ops ${UGS_BASE}/admin/queue-ops"
  queue_ops="$("${CURL[@]}" "${auth_args[@]}" "${UGS_BASE}/admin/queue-ops")"
  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "${queue_ops}" | jq -e '.status != null and has("operator_slo")' >/dev/null \
      || fail "queue-ops JSON shape (need status + operator_slo)"
    slo_level="$(printf '%s' "${queue_ops}" | jq -r '.operator_slo.level // "null"')"
    log "ok: queue-ops status=$(printf '%s' "${queue_ops}" | jq -r '.status') operator_slo.level=${slo_level}"
  else
    printf '%s\n' "${queue_ops}" | rg -q '"status"' || fail "queue-ops missing status"
    printf '%s\n' "${queue_ops}" | rg -q '"operator_slo"' || fail "queue-ops missing operator_slo"
    log "ok: queue-ops (jq unavailable — status + operator_slo keys present)"
  fi
else
  log "skip: queue-ops (set TOKEN or UGS_ADMIN_TOKEN for admin snapshot)"
fi

log "ComfyUI system_stats ${COMFY_BASE}/system_stats (non-fatal)"
if curl -fsS --connect-timeout 4 --max-time 8 "${COMFY_BASE}/system_stats" >/dev/null 2>&1; then
  log "ok: ComfyUI reachable at ${COMFY_BASE}"
else
  log "warn: ComfyUI unreachable at ${COMFY_BASE} (expected when command-center Comfy is down)"
fi

# Optional SSE generate path (billing may apply for UGS_SMOKE_TYPE_KEY)
if [[ "${UGS_SMOKE_SSE}" == "1" || "${UGS_SMOKE_SSE}" == "true" || "${UGS_SMOKE_SSE}" == "yes" ]]; then
  if [[ -z "${TOKEN}" ]]; then
    fail "UGS_SMOKE_SSE=1 requires TOKEN / UGS_ADMIN_TOKEN"
  fi
  smoke_key="ugs-smoke-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  log "UGS SSE generate/stream type_key=${UGS_SMOKE_TYPE_KEY} idempotency=${smoke_key}"
  sse_tmp="$(mktemp)"
  # shellcheck disable=SC2064
  trap 'rm -f "${sse_tmp}"' RETURN
  if command -v jq >/dev/null 2>&1; then
    sse_payload="$(jq -n \
      --arg tk "${UGS_SMOKE_TYPE_KEY}" \
      --arg prompt "${UGS_SMOKE_PROMPT}" \
      --arg key "${smoke_key}" \
      '{type_key:$tk, input_data:{prompt:$prompt}, idempotency_key:$key}')"
  else
    sse_payload="$(
      UGS_SMOKE_TYPE_KEY="${UGS_SMOKE_TYPE_KEY}" \
      UGS_SMOKE_PROMPT="${UGS_SMOKE_PROMPT}" \
      SMOKE_KEY="${smoke_key}" \
      python3 -c 'import json,os; print(json.dumps({"type_key":os.environ["UGS_SMOKE_TYPE_KEY"],"input_data":{"prompt":os.environ["UGS_SMOKE_PROMPT"]},"idempotency_key":os.environ["SMOKE_KEY"]}))'
    )"
  fi
  http_code="$(
    curl -sS --connect-timeout 8 --max-time "${UGS_SMOKE_SSE_MAX_SEC}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -H "Accept: text/event-stream" \
      -H "Idempotency-Key: ${smoke_key}" \
      -d "${sse_payload}" \
      -o "${sse_tmp}" \
      -w '%{http_code}' \
      "${UGS_BASE}/generate/stream" || printf '000'
  )"
  if [[ "${http_code}" != "200" ]]; then
    head -c 400 "${sse_tmp}" >&2 || true
    fail "generate/stream HTTP ${http_code}"
  fi
  if ! rg -q 'event: (result|error|cancelled)' "${sse_tmp}"; then
    head -c 800 "${sse_tmp}" >&2 || true
    fail "generate/stream: no terminal SSE event (result|error|cancelled) within ${UGS_SMOKE_SSE_MAX_SEC}s"
  fi
  if rg -q 'event: error' "${sse_tmp}"; then
    head -c 800 "${sse_tmp}" >&2 || true
    fail "generate/stream ended with event: error"
  fi
  if rg -q 'event: cancelled' "${sse_tmp}"; then
    fail "generate/stream ended with event: cancelled"
  fi
  log "ok: SSE generate/stream reached event: result"
else
  log "skip: SSE generate (set UGS_SMOKE_SSE=1 and TOKEN for path proof)"
fi

log "PASS"
