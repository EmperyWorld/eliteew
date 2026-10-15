#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Install/enable user systemd timers for portal probe/metrics/drift/stale on CC.
# Invariants:
# - Runs on command-center only; never installs units on edge.
# - Drift/stale timers notify only — never call deploy.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${ELITEEW_REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
UNIT_SRC="$SCRIPT_DIR/systemd"
UNIT_DST="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

TIMERS=(
	portal-private-tunnel-probe
	portal-private-tunnel-metrics
	portal-private-tunnel-drift
	portal-private-tunnel-stale
)

usage() {
	cat <<EOF
Usage: bash $0 <install|uninstall|status>

Installs user systemd timers (CC):
  - probe / metrics (5m)
  - drift notify (10m, no auto-deploy)
  - stale required-peer notify (10m)
Repo root: $REPO_ROOT
EOF
}

die() {
	echo "FAIL: $*" >&2
	exit 1
}

install_unit_pair() {
	local name="$1"
	sed -e "s|%h/powered_by_emperyworld|${REPO_ROOT}|g" \
		"$UNIT_SRC/${name}.service" >"$UNIT_DST/${name}.service"
	sed -e "s|%h/powered_by_emperyworld|${REPO_ROOT}|g" \
		"$UNIT_SRC/${name}.timer" >"$UNIT_DST/${name}.timer"
	systemctl --user enable --now "${name}.timer"
	echo "OK: enabled ${name}.timer"
}

cmd_install() {
	[[ -d "$REPO_ROOT/docker/scripts/portal-private-tunnel" ]] || die "repo root looks wrong: $REPO_ROOT"
	mkdir -p "$UNIT_DST"
	local name
	for name in "${TIMERS[@]}"; do
		[[ -f "$UNIT_SRC/${name}.service" && -f "$UNIT_SRC/${name}.timer" ]] || die "missing units for $name"
	done
	# Guard: drift path must not invoke apply/release
	if grep -EqE 'portalctl[[:space:]]+deploy|deploy-edge\.sh|/bin/bash.*deploy' \
		"$UNIT_SRC/portal-private-tunnel-drift.service" \
		"$SCRIPT_DIR/notify-drift.sh"; then
		die "drift notify must not invoke apply/release"
	fi
	systemctl --user daemon-reload
	for name in "${TIMERS[@]}"; do
		install_unit_pair "$name"
	done
	systemctl --user daemon-reload
	cmd_status
}

cmd_uninstall() {
	local name
	for name in "${TIMERS[@]}"; do
		systemctl --user disable --now "${name}.timer" 2>/dev/null || true
	done
	for name in "${TIMERS[@]}"; do
		# Replace unit files with empty uninstall via install of /dev/null not allowed;
		# use truncate pattern: move aside via systemd disable then unlink via python
		python3 -c "
import os, pathlib
d=pathlib.Path(os.environ['UNIT_DST'])
for n in '''${TIMERS[*]}'''.split():
  for ext in ('.service', '.timer'):
    p=d/f'{n}{ext}'
    if p.exists():
      p.unlink()
" 
	done
	systemctl --user daemon-reload || true
	echo "OK: removed user portal tunnel timers"
}

cmd_status() {
	local name
	export UNIT_DST
	for name in "${TIMERS[@]}"; do
		systemctl --user status "${name}.timer" --no-pager || true
	done
	local health metrics drift_n stale_n
	health="$REPO_ROOT/docker/data/portal-private-tunnel/health/health_latest.json"
	metrics="$REPO_ROOT/docker/data/portal-private-tunnel/metrics/latest.json"
	drift_n="$REPO_ROOT/docker/data/portal-private-tunnel/notify/drift_latest.txt"
	stale_n="$REPO_ROOT/docker/data/portal-private-tunnel/notify/required_peers_stale.txt"
	if [[ -f "$health" ]]; then
		echo "health_latest: $health"
		jq -r '"status=" + .status + " ts=" + .timestamp' "$health" 2>/dev/null || true
	fi
	if [[ -f "$metrics" ]]; then
		echo "metrics_latest: $metrics"
		jq -r '"status=" + .status + " exporter_up=" + (.exporter_up|tostring)' "$metrics" 2>/dev/null || true
	fi
	[[ -f "$drift_n" ]] && echo "notify_drift: $(head -1 "$drift_n")"
	[[ -f "$stale_n" ]] && echo "notify_stale: $(head -1 "$stale_n")"
}

main() {
	case "${1:-}" in
	install) cmd_install ;;
	uninstall)
		export UNIT_DST
		cmd_uninstall
		;;
	status) cmd_status ;;
	-h | --help | help | "") usage ;;
	*)
		usage
		die "unknown command: $1"
		;;
	esac
}

main "$@"
