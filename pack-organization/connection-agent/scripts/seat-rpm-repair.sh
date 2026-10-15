#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Ops-only remote RPM repair for seats stuck on broken OTA bake (e.g. 0.4.7
# signing_required, or ≤0.4.40 dnf5 bare `--` in pkexec install). End users must
# never run this — product path is in-app recovery after 0.4.41+.
# Usage:
#   bash pack-organization/connection-agent/scripts/seat-rpm-repair.sh --host poet@192.168.x.y
#   bash pack-organization/connection-agent/scripts/seat-rpm-repair.sh --host poet@EWSolo --rpm-url URL
# ---
set -euo pipefail

HOST=""
RPM_URL="${DESKTOP_CLIENT_REPAIR_RPM_URL:-https://app.eliteew.ru/desktop-client-updates/artifacts/EliteEW_Desktop_Client-0.4.46-1.x86_64.rpm}"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--host)
		HOST="${2:-}"
		shift 2
		;;
	--rpm-url)
		RPM_URL="${2:-}"
		shift 2
		;;
	-h | --help)
		sed -n '2,12p' "$0"
		exit 0
		;;
	*)
		echo "unknown arg: $1" >&2
		exit 2
		;;
	esac
done

if [[ -z "${HOST}" ]]; then
	echo "FAIL: --host user@ip required (ops remote repair)" >&2
	exit 2
fi

echo "OK: repairing ${HOST} via ${RPM_URL}"
ssh -o BatchMode=yes -o ConnectTimeout=10 "${HOST}" bash -s <<EOF
set -euo pipefail
tmp="\$(mktemp /tmp/eliteew-desktop-repair-XXXXXX.rpm)"
curl -fL --retry 3 -o "\$tmp" "${RPM_URL}"
if command -v dnf >/dev/null 2>&1; then
  pkexec dnf install -y --setopt=install_weak_deps=False --nogpgcheck "\$tmp" || sudo dnf install -y --nogpgcheck "\$tmp"
elif command -v rpm >/dev/null 2>&1; then
  pkexec rpm -Uvh --force "\$tmp" || sudo rpm -Uvh --force "\$tmp"
else
  echo "FAIL: no dnf/rpm" >&2
  exit 127
fi
rm -f "\$tmp"
rpm -qa | grep -i eliteew || true
EOF
echo "OK: remote repair finished — ask seat to relaunch Desktop Client"
