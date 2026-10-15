#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Post-boot verification of Fedora IoT Site-Edge from Heavy-Node (command-center).
# Invariants:
# - Uses SSH BatchMode (key-only); no password prompts.
# Related:
# - documentation/platform/SITE-EDGE-CARRIER.md
# - docker/scripts/site-edge-iot-provision.sh
# ---
set -euo pipefail

EDGE_HOST=""
EDGE_USER="${SITE_EDGE_USER:-siteedge}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
RETRIES=12
SLEEP_SEC=10

usage() {
	cat <<EOF
Usage: $(basename "$0") --host <ip-or-dns> [--user siteedge]

Checks from Heavy-Node after first boot (and optional rpm-ostree reboot):
  1) ICMP reachability
  2) SSH key login
  3) podman version/info
  4) sshd PasswordAuthentication no
  5) Carrier workdir /var/lib/eliteew/site-edge

Env:
  SITE_EDGE_USER   override SSH user (default: siteedge)
EOF
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
ok() { printf 'OK: %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

while [[ $# -gt 0 ]]; do
	case "$1" in
		--host)
			EDGE_HOST="${2:-}"
			shift 2
			;;
		--user)
			EDGE_USER="${2:-}"
			shift 2
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			die "unknown option: $1"
			;;
	esac
done

[[ -n "${EDGE_HOST}" ]] || die "--host required"
TARGET="${EDGE_USER}@${EDGE_HOST}"

log_step() { printf '\n==> %s\n' "$*"; }

log_step "1/5 ping ${EDGE_HOST}"
if ping -c 3 -W 2 "${EDGE_HOST}" >/dev/null 2>&1; then
	ok "ICMP reachable"
else
	warn "ICMP failed (may be firewalled); continuing to SSH"
fi

log_step "2/5 SSH ${TARGET} (retry up to ${RETRIES}x — wait for package reboot)"
ssh_ok=0
for i in $(seq 1 "${RETRIES}"); do
	if ssh "${SSH_OPTS[@]}" "${TARGET}" true 2>/dev/null; then
		ssh_ok=1
		ok "SSH BatchMode login"
		break
	fi
	warn "SSH attempt ${i}/${RETRIES} failed; sleep ${SLEEP_SEC}s"
	sleep "${SLEEP_SEC}"
done
[[ "${ssh_ok}" -eq 1 ]] || die "SSH failed — ensure Ignition pubkey matches this host and edge finished first-boot"

log_step "3/5 podman on Edge"
if ssh "${SSH_OPTS[@]}" "${TARGET}" 'podman version && podman info --format "{{.Host.RemoteSocket.Exists}}" >/dev/null'; then
	ok "podman operational"
else
	if ssh "${SSH_OPTS[@]}" "${TARGET}" 'test -f /var/lib/eliteew/.edge-packages-done'; then
		die "podman missing after packages marker — inspect rpm-ostree status on edge"
	fi
	die "podman not ready yet (first-boot package layer may still be running / rebooting)"
fi

log_step "4/5 sshd hardening"
remote_pw="$(ssh "${SSH_OPTS[@]}" "${TARGET}" "sudo sshd -T 2>/dev/null | awk '/^passwordauthentication /{print \$2}'" || true)"
if [[ "${remote_pw}" == "no" ]]; then
	ok "PasswordAuthentication no"
else
	warn "could not confirm PasswordAuthentication no (got '${remote_pw:-empty}'); check /etc/ssh/sshd_config.d/99-edge.conf"
fi
ssh "${SSH_OPTS[@]}" "${TARGET}" 'systemctl is-active sshd' >/dev/null
ok "sshd active"

log_step "5/5 Carrier workdir"
ssh "${SSH_OPTS[@]}" "${TARGET}" 'test -d /var/lib/eliteew/site-edge && test -w /var/lib/eliteew/site-edge || sudo test -d /var/lib/eliteew/site-edge'
ok "/var/lib/eliteew/site-edge present"

printf '\nAll checks passed for %s\n' "${TARGET}"
printf 'Next: SITE_EDGE_SSH=%s bash docker/scripts/site-edge-carrier-deploy.sh --slug demo --content-dir <dist> --yes\n' "${TARGET}"
