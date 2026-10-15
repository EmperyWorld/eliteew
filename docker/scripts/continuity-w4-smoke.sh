#!/usr/bin/env bash
# Continuity W4 — narrow cloud smoke (read-only). Run from command-center.
# Does not bake/release stack0. Exit non-zero on any failed hard check.
set -euo pipefail

PROD_CORE="${ELITEEW_PROD_CORE_HOST:-192.168.1.111}"
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "OK  $name"
  else
    echo "FAIL $name"
    fail=1
  fi
}

warn_check() {
  local name="$1"
  shift
  if "$@"; then
    echo "OK  $name"
  else
    echo "WARN $name (expected until Continuity W0–W3 stack0 release)"
  fi
}

echo "Continuity W4 smoke against ${PROD_CORE}"

check "api health :29000" \
  ssh -o BatchMode=yes -o ConnectTimeout=8 "$PROD_CORE" \
  'curl -sf http://127.0.0.1:29000/api/health >/dev/null'

check "spa root :29001" \
  ssh -o BatchMode=yes -o ConnectTimeout=8 "$PROD_CORE" \
  'curl -sf http://127.0.0.1:29001/ >/dev/null'

warn_check "SSO session-policy declared_current" \
  ssh -o BatchMode=yes -o ConnectTimeout=8 "$PROD_CORE" \
  'curl -sf "http://127.0.0.1:29000/api/v1/auth/sso/session-policy?source=declared_current" | grep -q 43200'

check "recovery capsule table present" \
  ssh -o BatchMode=yes -o ConnectTimeout=8 "$PROD_CORE" \
  "podman exec -i stack1-postgres psql -U ai_user -d ai_services -tAc \"SELECT to_regclass('public.web_sso_recovery_capsules');\" | grep -q web_sso_recovery_capsules"

check "schema_migrations 20260830_01" \
  ssh -o BatchMode=yes -o ConnectTimeout=8 "$PROD_CORE" \
  "podman exec -i stack1-postgres psql -U ai_user -d ai_services -tAc \"SELECT 1 FROM schema_migrations WHERE version='20260830_01' AND name='web_sso_recovery_capsules';\" | grep -q 1"

if [[ "$fail" -ne 0 ]]; then
  echo "Continuity W4 smoke FAILED"
  exit 1
fi
echo "Continuity W4 smoke OK (infra + session-policy when Continuity API is live)."
