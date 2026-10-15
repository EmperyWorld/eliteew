#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Smoke public surface contracts: health {ok}, manifest Host gate, Socket.IO notes.
# Invariants:
# - Does not require admin token; does not mutate prod.
# Related:
# - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
# - shared/api/monitoring/api_health_public.py
# ---
set -euo pipefail

BASE="${ELITEEW_PUBLIC_SURFACE_BASE:-https://app.eliteew.ru}"
FAIL=0

log() { printf '[public-surface-smoke] %s\n' "$*"; }
fail() { log "FAIL: $*"; FAIL=1; }

log "base=${BASE}"

# --- /api/health public shape ---
health_body="$(curl -sf --max-time 15 "${BASE}/api/health" || true)"
if [[ -z "${health_body}" ]]; then
  fail "/api/health empty or unreachable"
else
  keys="$(printf '%s' "${health_body}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(",".join(sorted(d.keys())))' 2>/dev/null || echo '')"
  if [[ "${keys}" != "ok" ]]; then
    fail "/api/health expected keys=ok got keys=${keys} body=${health_body:0:200}"
  else
    ok_val="$(printf '%s' "${health_body}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("ok"))')"
    if [[ "${ok_val}" != "True" && "${ok_val}" != "False" ]]; then
      fail "/api/health ok must be bool got ${ok_val}"
    else
      log "OK /api/health {ok=${ok_val}}"
    fi
  fi
fi

# --- deployment-manifest public Host ---
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  -H 'Host: app.eliteew.ru' "${BASE}/deployment-manifest.json" || echo 000)"
if [[ "${code}" != "404" ]]; then
  fail "/deployment-manifest.json on public Host expected 404 got ${code}"
else
  log "OK /deployment-manifest.json → 404 (public Host)"
fi

# --- scanner probe ---
for p in /env /swagger /nginx_status /actuator/env; do
  c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE}${p}" || echo 000)"
  if [[ "${c}" == "200" ]]; then
    # SPA HTML fallback would be ~4k; treat 200 as fail for these paths
    fail "${p} returned 200 (expected 404)"
  else
    log "OK ${p} → ${c}"
  fi
done

# --- Socket.IO Engine.IO open (sid expected); app connect requires JWT (unit-tested) ---
sio="$(curl -sf --max-time 15 "${BASE}/socket.io/?EIO=4&transport=polling" | head -c 200 || true)"
if [[ -z "${sio}" ]]; then
  fail "socket.io polling open empty"
else
  log "OK socket.io Engine.IO open (handshake may include sid); JWT connect enforced in API"
fi

# --- /api/version public fields ---
ver="$(curl -sf --max-time 15 "${BASE}/api/version" || true)"
if [[ -z "${ver}" ]]; then
  fail "/api/version empty"
else
  bad="$(printf '%s' "${ver}" | python3 -c '
import sys,json
d=json.load(sys.stdin)
forbidden={"environment","buildTime"}
leak=sorted(forbidden & set(d))
need={"version","buildHash","appBuildId"}
missing=sorted(need - set(d))
print("leak="+",".join(leak)+";missing="+",".join(missing))
' 2>/dev/null || echo 'parse_error')"
  if [[ "${bad}" == *leak=*environment* || "${bad}" == *leak=*buildTime* || "${bad}" == *missing=* || "${bad}" == parse_error* ]]; then
    if [[ "${bad}" != "leak=;missing=" ]]; then
      fail "/api/version contract ${bad} body=${ver:0:200}"
    else
      log "OK /api/version public fields"
    fi
  else
    log "OK /api/version public fields"
  fi
fi

if [[ "${FAIL}" -ne 0 ]]; then
  log "FAILED"
  exit 1
fi
log "PASSED"
exit 0
