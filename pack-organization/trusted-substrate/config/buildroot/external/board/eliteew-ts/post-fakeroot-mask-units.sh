#!/usr/bin/env bash
# Apply product systemd masks AFTER systemctl preset-all (ROOTFS_PRE_CMD).
# Buildroot order: PRE_CMD (preset-all) → BR2_ROOTFS_POST_FAKEROOT_SCRIPT (this).
# Masks before preset print "Unit … is masked, ignoring" / "Failed to preset".
# Disable SoT stays in etc/systemd/system-preset/00-empiieros.preset; masks are
# the durable "cannot start even manually" lock for timesyncd / extra gettys /
# stock ask-password / unprovisioned sshd.
set -euo pipefail

TARGET_DIR="${1:?TARGET_DIR required}"
SYS="${TARGET_DIR}/etc/systemd/system"
mkdir -p "${SYS}"

_mask() {
  local unit="$1"
  rm -f "${SYS}/${unit}"
  ln -sfn /dev/null "${SYS}/${unit}"
  if [[ ! -L "${SYS}/${unit}" ]] || [[ "$(readlink "${SYS}/${unit}")" != "/dev/null" ]]; then
    echo "eliteew-ts post-fakeroot: FAIL mask ${unit}" >&2
    exit 1
  fi
}

# Extra VTs — product console is tty1 only.
for _tty in 2 3 4 5 6; do
  rm -f "${SYS}/getty@${_tty}.service"
  _mask "getty@tty${_tty}.service"
done

# timesyncd FallbackNTP is Google; wall clock is installer/operator SoT.
rm -f "${SYS}/../sysinit.target.wants/systemd-timesyncd.service" \
  "${TARGET_DIR}/etc/systemd/system/sysinit.target.wants/systemd-timesyncd.service" 2>/dev/null || true
_mask systemd-timesyncd.service

# Stock ask-password agents — branded state-unlock agent owns the console path.
_mask systemd-ask-password-console.path
_mask systemd-ask-password-wall.path

# Maintenance SSH: mask unless a supported authorized_keys was planted.
_authorized_keys="${TARGET_DIR}/home/empiieros-maint/.ssh/authorized_keys"
_sshd_wants="${SYS}/multi-user.target.wants/sshd.service"
if [[ -s "${_authorized_keys}" ]] \
  && awk 'NF && $1 !~ /^#/ {print}' "${_authorized_keys}" \
    | rg -q '^(ssh-ed25519|sk-ssh-ed25519@openssh\.com|ecdsa-sha2-nistp(256|384|521)|sk-ecdsa-sha2-nistp256@openssh\.com|ssh-rsa) [A-Za-z0-9+/=]+( .*)?$'; then
  if [[ -L "${SYS}/sshd.service" && "$(readlink "${SYS}/sshd.service")" == "/dev/null" ]]; then
    rm -f "${SYS}/sshd.service"
  fi
else
  rm -f "${_sshd_wants}"
  _mask sshd.service
fi

echo "eliteew-ts post-fakeroot: product unit masks applied"
