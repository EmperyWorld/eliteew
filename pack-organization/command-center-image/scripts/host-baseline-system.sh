#!/usr/bin/env bash
# Command-center host baseline (no monorepo): CPU firmware, NVIDIA akmod, tuned, harden, security report.
# Run on 192.168.1.136 as root: sudo bash host-baseline-system.sh
set -euo pipefail

LOG="/var/log/eliteew-cc-host-baseline.log"
exec > >(tee -a "${LOG}") 2>&1

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

echo "=== eliteew-cc host baseline $(date -Is) ==="

echo "=== [1/7] drivers + tools (delegated) ==="
BASELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -x "${BASELINE_DIR}/install-host-drivers-and-tools.sh" ]]; then
  bash "${BASELINE_DIR}/install-host-drivers-and-tools.sh" || true
else
  dnf install -y amd-ucode microcode_ctl tuned git ripgrep fd-find podman || true
fi
dnf install -y lynis firewalld 2>/dev/null || true

echo "=== [2/7] Network (static .136 only) ==="
CON="$(nmcli -t -f NAME,DEVICE connection show | awk -F: '$2=="enp5s0"{print $1; exit}')"
if [[ -n "${CON}" ]]; then
  nmcli connection modify "${CON}" \
    ipv4.method manual \
    ipv4.addresses "192.168.1.136/24" \
    ipv4.gateway "192.168.1.1" \
    ipv4.dns "192.168.1.1 1.1.1.1" \
    ipv4.ignore-auto-dns yes \
    ipv6.method disabled \
    connection.autoconnect yes
  nmcli connection up "${CON}" || true
fi
ip -4 addr del dev enp5s0 192.168.88.254/24 2>/dev/null || true
hostnamectl set-hostname empery.world

echo "=== [3/7] CPU / I/O profile ==="
systemctl enable --now tuned
tuned-adm profile throughput-performance 2>/dev/null || tuned-adm profile balanced || true
tuned-adm active

echo "=== [4/7] NVIDIA — see install-host-drivers-and-tools.sh log ==="

echo "=== [5/7] EliteEW firstboot + harden hooks ==="
install -d -m 0755 /opt/eliteew-cc /etc/eliteew
if [[ -f /tmp/harden-command-center-host.sh ]]; then
  install -m 0755 /tmp/harden-command-center-host.sh /opt/eliteew-cc/harden-command-center-host.sh
fi
if [[ -f /tmp/eliteew-cc-firstboot ]]; then
  install -m 0755 /tmp/eliteew-cc-firstboot /usr/local/bin/eliteew-cc-firstboot
fi
if [[ -f /tmp/eliteew-cc-firstboot.service ]]; then
  install -m 0644 /tmp/eliteew-cc-firstboot.service /etc/systemd/system/eliteew-cc-firstboot.service
  systemctl daemon-reload
fi
if [[ -x /opt/eliteew-cc/harden-command-center-host.sh ]]; then
  ELITEEW_HARDEN_FORCE=1 /opt/eliteew-cc/harden-command-center-host.sh || true
fi
if id owned >/dev/null 2>&1; then
  loginctl enable-linger owned 2>/dev/null || true
fi

echo "=== [6/7] Security snapshot (before BIOS GPU / MOK changes) ==="
{
  echo "--- Secure Boot ---"
  mokutil --sb-state 2>/dev/null || true
  echo "--- SELinux ---"
  getenforce
  echo "--- Firewalld ---"
  firewall-cmd --get-default-zone
  firewall-cmd --list-all 2>/dev/null || true
  echo "--- SSH effective (sshd -T) ---"
  sshd -T 2>/dev/null | grep -iE '^(passwordauthentication|pubkeyauthentication|permitrootlogin|x11forwarding|maxauthtries)' || true
  echo "--- Listening (TCP) ---"
  ss -tlnp
  echo "--- Failed units ---"
  systemctl --failed --no-pager || true
  echo "--- NVIDIA / module ---"
  lsmod | grep -i nvidia || echo "nvidia module not loaded yet (reboot/MOK expected)"
  nvidia-smi 2>/dev/null || echo "nvidia-smi not ready"
  echo "--- CPU microcode ---"
  dmesg | grep -i microcode | tail -3 || true
} | tee /var/log/eliteew-cc-security-snapshot.txt

if command -v lynis >/dev/null 2>&1; then
  echo "=== Lynis quick audit (may take 1–2 min) ==="
  lynis audit system --quick --no-colors 2>/dev/null | tee /var/log/eliteew-cc-lynis-quick.txt || true
  tail -30 /var/log/eliteew-cc-lynis-quick.txt 2>/dev/null || true
fi

echo "=== [7/7] Reboot hint ==="
if mokutil --sb-state 2>/dev/null | grep -qi enabled; then
  echo "Secure Boot ON: after reboot, if nvidia-smi fails, enroll MOK at boot (akmods) OR disable Secure Boot in BIOS for this build host."
fi
echo "Reboot recommended: systemctl reboot"
echo "After reboot: nvidia-smi; cat /var/log/eliteew-cc-security-snapshot.txt"
echo "=== baseline done $(date -Is) ==="
