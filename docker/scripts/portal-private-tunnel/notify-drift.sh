#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: CC drift check with notify-only on FAIL (never mutates edge).
# Invariants:
# - Calls portalctl drift; on mismatch → audit + logger + notify file; exit 2.
# - Never starts a release/apply path; human review required.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ROOT="$(portal_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
portal_private_tunnel_source_env "$ROOT"

DATA="$(portal_private_tunnel_data_dir "$ROOT")"
NOTIFY_DIR="$DATA/notify"
mkdir -p "$NOTIFY_DIR"
chmod 700 "$NOTIFY_DIR" 2>/dev/null || true

write_notify() {
	local path="$1"
	local content="$2"
	local tmp
	tmp="$(mktemp)"
	printf '%s\n' "$content" >"$tmp"
	install -m 644 "$tmp" "$path"
	rm -f "$tmp"
}

set +e
out="$(bash "$SCRIPT_DIR/portalctl" drift 2>&1)"
rc=$?
set -e

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s\n' "$out"

if [[ "$rc" -eq 0 ]]; then
	write_notify "$NOTIFY_DIR/drift_latest.txt" "${ts} status=OK no_drift"
	exit 0
fi

# Drift or tool failure — notify only (HARD: no deploy).
portal_private_tunnel_audit "$ROOT" "alert_p1_drift" "exit=${rc} auto_deploy=forbidden"
logger -t portalctl -- "DRIFT DETECTED — notify only; auto deploy forbidden; human review required. exit=${rc}"
write_notify "$NOTIFY_DIR/drift_latest.txt" "$(
	cat <<EOF
${ts} status=DRIFT exit=${rc}
action=NOTIFY_ONLY auto_deploy=FORBIDDEN
operator_next=run_portalctl_drift_then_human_review_before_any_deploy

${out}
EOF
)"

echo "NOTIFY: drift failure recorded (auto deploy forbidden)" >&2
exit 2
