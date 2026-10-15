#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# One-shot command-center (.136) host harden: SSH keys-only, Cockpit LAN-only,
# disable desktop/mdns leftovers, journal cap; keep NFS/nginx/NVIDIA/Comfy/SDDM/xrdp.
# Invariants:
# - Must run as root on command-center (192.168.1.136).
# - Does not disable nfs-server, nginx, nvidia-persistenced, sddm, xrdp, podman.
# - Does not rewrite existing NFS/gpu141 rich-rules wholesale.
# Related:
# - documentation/platform/PROD-CORE-HOST-HARDEN.md
# - documentation/platform/PRODUCTION-TOPOLOGY-STATE.md
# ---
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root: sudo bash $0" >&2
  exit 1
fi

ip_guess="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ "${ip_guess}" != "192.168.1.136" && "${ELITEEW_HARDEN_FORCE:-0}" != "1" ]]; then
  echo "ERROR: expected command-center 192.168.1.136 (got ${ip_guess}). Set ELITEEW_HARDEN_FORCE=1 to override." >&2
  exit 1
fi

ZONE="${ELITEEW_HARDEN_ZONE:-FedoraServer}"
LAN_CIDR="${ELITEEW_HARDEN_LAN_CIDR:-192.168.1.0/24}"
SCRIPT_DIR_CC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FW_LAN="${ELITEEW_CC_FIREWALL_SCRIPT:-}"
if [[ -z "${FW_LAN}" ]]; then
  for cand in \
    "${SCRIPT_DIR_CC}/../../../pack-organization/command-center-image/scripts/eliteew-cc-firewall-lan.sh" \
    "${HOME}/ewonika/scripts/eliteew-cc-firewall-lan.sh"; do
    if [[ -f "${cand}" ]]; then
      FW_LAN="${cand}"
      break
    fi
  done
fi

echo "=== [1/5] LAN-only SSH + Cockpit 9090 (firewalld + bind) ==="
if [[ -n "${FW_LAN}" && -f "${FW_LAN}" ]]; then
  ELITEEW_HARDEN_ZONE="${ZONE}" ELITEEW_HARDEN_LAN_CIDR="${LAN_CIDR}" bash "${FW_LAN}"
else
  echo "WARN: eliteew-cc-firewall-lan.sh not found — skip firewall LAN step" >&2
fi
firewall-cmd --info-zone="${ZONE}" 2>/dev/null | head -40 || true

echo "=== [2/5] Cockpit (already restarted by firewall script) ==="
systemctl is-active cockpit.socket 2>/dev/null || true

echo "=== [3/5] SSH harden (before 50-redhat.conf) ==="
mkdir -p /etc/ssh/sshd_config.d
cat >/etc/ssh/sshd_config.d/00-eliteew-command-center.conf <<'EOF'
# EliteEW command-center — must sort before 50-redhat.conf (sshd first-match wins).
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
PermitEmptyPasswords no
MaxAuthTries 4
EOF
if [[ -f /etc/ssh/sshd_config.d/99-eliteew-prod.conf ]]; then
  mv /etc/ssh/sshd_config.d/99-eliteew-prod.conf /var/tmp/99-eliteew-prod.conf.bak 2>/dev/null || true
fi
if sshd -t; then
  systemctl reload sshd
  echo "sshd reloaded with 00-eliteew-command-center.conf"
else
  echo "ERROR: sshd -t failed" >&2
  mv /etc/ssh/sshd_config.d/00-eliteew-command-center.conf /var/tmp/00-eliteew-command-center.conf.bad 2>/dev/null || true
fi

echo "=== [4/5] disable leftovers (keep NFS/nginx/NVIDIA/SDDM/xrdp) ==="
disable_units=(
  avahi-daemon.service
  avahi-daemon.socket
  bluetooth.service
  abrtd.service
  abrt-oops.service
  abrt-xorg.service
  abrt-journal-core.service
  abrt-vmcore.service
  coolercontrold.service
  lactd.service
  flatpak-add-fedora-repos.service
  switcheroo-control.service
  iscsi-onboot.service
  iscsi-starter.service
  sssd.service
  setroubleshootd.service
  accounts-daemon.service
  # Meet guard belongs on prod-core (.111), not command-center
)
for u in "${disable_units[@]}"; do
  systemctl disable --now "${u}" 2>/dev/null || true
  echo "disabled: ${u}"
done

# User-scope: meet-media-guard is wrong host here
if id owned >/dev/null 2>&1; then
  sudo -u owned XDG_RUNTIME_DIR=/run/user/1000 systemctl --user disable --now \
    eliteew-meet-media-guard.timer eliteew-meet-media-guard.service \
    2>/dev/null || true
  echo "disabled user-scope eliteew-meet-media-guard on command-center"
fi

# Ensure prod autostart stays off on .136
if id owned >/dev/null 2>&1; then
  sudo -u owned XDG_RUNTIME_DIR=/run/user/1000 systemctl --user disable eliteew-podman-autostart.service 2>/dev/null || true
fi

mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/99-eliteew-command-center.conf <<'EOF'
[Journal]
SystemMaxUse=800M
SystemKeepFree=2G
MaxRetentionSec=14day
Compress=yes
EOF
systemctl restart systemd-journald 2>/dev/null || true
journalctl --vacuum-size=800M || true

echo "=== [5/5] summary ==="
systemctl --failed --no-pager || true
sshd -T 2>/dev/null | rg -i '^(passwordauthentication|x11forwarding|permitrootlogin|pubkeyauthentication) ' || true
echo "KEPT active (expected): nfs-server=$(systemctl is-active nfs-server 2>/dev/null || true) nginx=$(systemctl is-active nginx 2>/dev/null || true) nvidia-persistenced=$(systemctl is-active nvidia-persistenced 2>/dev/null || true) sddm=$(systemctl is-active sddm 2>/dev/null || true) xrdp=$(systemctl is-active xrdp 2>/dev/null || true)"
echo "DONE harden-command-center-host.sh"
echo "Optional package cleanup: dnf remove coolercontrol coolercontrold lact openrgb openrgb-udev-rules"
