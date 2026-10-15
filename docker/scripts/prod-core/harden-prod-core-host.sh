#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# One-shot prod-core (.111) host harden: firewall allowlist, Cockpit LAN-only, SSH keys-only,
# disable desktop/nexus/SSFEW leftovers, meet-media-guard system scope, optional NVIDIA/MOK.
# Invariants:
# - Must run as root on prod-core.
# - Does not build images; does not open Workstation high-port range.
# - Preserves Meet WG: 10.77.77.1 -> udp/34000 (media) + TCP backhaul ports + SSH.
# - ELITEEW_HARDEN_SKIP_NVIDIA=1 skips driver/MOK (operator installs NVIDIA separately).
# Related:
# - documentation/platform/docker-re_doc/MEET-MEDIA-UDP-NATIVE-PATH.md
# - documentation/platform/PRODUCTION-TOPOLOGY-STATE.md
# - docker/scripts/prod-core/start-stack9-voice.sh
# ---
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root: sudo bash $0" >&2
  exit 1
fi

hostname_s="$(hostname -s 2>/dev/null || true)"
ip_guess="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ "${ip_guess}" != "192.168.1.111" && "${ELITEEW_HARDEN_FORCE:-0}" != "1" ]]; then
  echo "ERROR: expected prod-core 192.168.1.111 (got ip=${ip_guess} host=${hostname_s}). Set ELITEEW_HARDEN_FORCE=1 to override." >&2
  exit 1
fi

ZONE="${ELITEEW_HARDEN_ZONE:-FedoraServer}"
LAN_CIDR="${ELITEEW_HARDEN_LAN_CIDR:-192.168.1.0/24}"
COCKPIT_EXTRA="${ELITEEW_HARDEN_COCKPIT_EXTRA:-192.168.8.10}"
MEET_EDGE_WG_IP="${MEET_EDGE_WG_SERVER_IP:-10.77.77.1}"
JVB_RTP_PORT="${MEET_EDGE_WG_JVB_RTP_PORT:-34000}"

echo "=== [1/6] firewalld zone ${ZONE} (allowlist) ==="
# Runtime + permanent default (avoid combining incompatible firewall-cmd flags)
firewall-cmd --set-default-zone="${ZONE}" || true
for z in FedoraWorkstation "${ZONE}"; do
  firewall-cmd --permanent --zone="${z}" --remove-service=samba-client 2>/dev/null || true
  firewall-cmd --permanent --zone="${z}" --remove-port=1025-65535/tcp 2>/dev/null || true
  firewall-cmd --permanent --zone="${z}" --remove-port=1025-65535/udp 2>/dev/null || true
done

firewall-cmd --permanent --zone="${ZONE}" --add-service=ssh

# Cockpit: only LAN + operator host 192.168.8.10
firewall-cmd --permanent --zone="${ZONE}" --remove-service=cockpit 2>/dev/null || true
firewall-cmd --permanent --zone="${ZONE}" --remove-port=9090/tcp 2>/dev/null || true
for src in "${LAN_CIDR}" "${COCKPIT_EXTRA}"; do
  firewall-cmd --permanent --zone="${ZONE}" \
    --add-rich-rule="rule family=\"ipv4\" source address=\"${src}\" port port=\"9090\" protocol=\"tcp\" accept" \
    2>/dev/null || true
done

# Meet media: edge WG -> JVB RTP
firewall-cmd --permanent --zone="${ZONE}" \
  --add-rich-rule="rule family=\"ipv4\" source address=\"${MEET_EDGE_WG_IP}/32\" port port=\"${JVB_RTP_PORT}\" protocol=\"udp\" accept" \
  2>/dev/null || true

# Meet WG HTTP backhaul: edge nginx -> eliteew-wg-tcp-proxy@* on 10.77.77.2
# (FedoraServer default REJECT; omitting these → public 502 / "No route to host" from edge)
# Canon: documentation/platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md
WG_HTTP_BACKHAUL_TCP_PORTS="${ELITEEW_HARDEN_WG_HTTP_TCP_PORTS:-29000 29001 29002 36000 13402 29180 29181 29173}"
for p in ${WG_HTTP_BACKHAUL_TCP_PORTS}; do
  firewall-cmd --permanent --zone="${ZONE}" \
    --add-rich-rule="rule family=\"ipv4\" source address=\"${MEET_EDGE_WG_IP}/32\" port port=\"${p}\" protocol=\"tcp\" accept" \
    2>/dev/null || true
done
# Classify wg0 into the allowlist zone (otherwise traffic may miss rich rules)
firewall-cmd --permanent --zone="${ZONE}" --add-interface=wg0 2>/dev/null || true

# Site internal DNS (stack12) on LAN
firewall-cmd --permanent --zone="${ZONE}" \
  --add-rich-rule="rule family=\"ipv4\" source address=\"${LAN_CIDR}\" port port=\"8053\" protocol=\"tcp\" accept" \
  2>/dev/null || true
firewall-cmd --permanent --zone="${ZONE}" \
  --add-rich-rule="rule family=\"ipv4\" source address=\"${LAN_CIDR}\" port port=\"8053\" protocol=\"udp\" accept" \
  2>/dev/null || true

firewall-cmd --permanent --zone="${ZONE}" \
  --add-rich-rule="rule family=\"ipv4\" source address=\"192.168.8.10\" port port=\"18765\" protocol=\"tcp\" accept" \
  2>/dev/null || true

firewall-cmd --permanent --zone="${ZONE}" \
  --add-rich-rule="rule family=\"ipv4\" source address=\"93.77.167.208\" reject" \
  2>/dev/null || true

# Bind LAN NIC via NetworkManager (authoritative on Fedora)
NM_CONN="${ELITEEW_HARDEN_NM_CONN:-EtherEEW-lan}"
if command -v nmcli >/dev/null 2>&1; then
  nmcli connection modify "${NM_CONN}" connection.zone "${ZONE}" 2>/dev/null || true
  nmcli connection up "${NM_CONN}" 2>/dev/null || true
fi
IFACE="$(firewall-cmd --get-active-zones 2>/dev/null | awk '/interfaces:/{print $2; exit}')"
IFACE="${IFACE:-enp5s0}"
firewall-cmd --permanent --zone=FedoraWorkstation --remove-interface="${IFACE}" 2>/dev/null || true
firewall-cmd --permanent --zone="${ZONE}" --change-interface="${IFACE}" 2>/dev/null \
  || firewall-cmd --permanent --zone="${ZONE}" --add-interface="${IFACE}" 2>/dev/null || true

firewall-cmd --reload
echo "Active zone:"; firewall-cmd --get-active-zones
echo "Zone info:"; firewall-cmd --info-zone="${ZONE}"

echo "=== [2/6] Cockpit keep enabled; access via firewall only ==="
systemctl enable --now cockpit.socket
systemctl restart cockpit.socket || true

echo "=== [3/6] SSH harden (keys only; drop-in before 50-redhat.conf) ==="
mkdir -p /etc/ssh/sshd_config.d
# OpenSSH first-match: must sort before 50-redhat.conf (which sets X11Forwarding yes).
cat >/etc/ssh/sshd_config.d/00-eliteew-prod.conf <<'EOF'
# EliteEW prod-core — must sort before 50-redhat.conf (sshd first-match wins).
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
  echo "sshd reloaded with 00-eliteew-prod.conf"
else
  echo "ERROR: sshd -t failed — restoring" >&2
  mv /etc/ssh/sshd_config.d/00-eliteew-prod.conf /var/tmp/00-eliteew-prod.conf.bad 2>/dev/null || true
fi
echo "=== [4/6] disable leftover services ==="
disable_units=(
  nexus-fleet-executor.service
  nexus-fleet-observer.service
  avahi-daemon.service
  avahi-daemon.socket
  cups.service
  cups.socket
  cups-browsed.service
  abrtd.service
  abrt-oops.service
  abrt-xorg.service
  abrt-journal-core.service
  abrt-vmcore.service
  coolercontrold.service
  lactd.service
  bluetooth.service
  plasmalogin.service
  qemu-guest-agent.service
  accounts-daemon.service
  flatpak-add-fedora-repos.service
  switcheroo-control.service
  iscsi-onboot.service
  iscsi-starter.service
  # noisy until operator installs NVIDIA drivers (CDI refresh re-enabled in NVIDIA OK below)
  nvidia-persistenced.service
  nvidia-powerd.service
  nvidia-hibernate.service
  nvidia-suspend.service
  nvidia-resume.service
  nvidia-suspend-then-hibernate.service
)
for u in "${disable_units[@]}"; do
  systemctl disable --now "${u}" 2>/dev/null || true
  echo "disabled: ${u}"
done
systemctl reset-failed 2>/dev/null || true

# Retire nexus unit files so they cannot be re-enabled by accident
mkdir -p /var/tmp/eliteew-retired-units
for u in nexus-fleet-executor.service nexus-fleet-observer.service; do
  if [[ -f /etc/systemd/system/$u ]]; then
    mv /etc/systemd/system/$u /var/tmp/eliteew-retired-units/ 2>/dev/null || true
  fi
done
systemctl daemon-reload 2>/dev/null || true

# Unused directory services
systemctl disable --now sssd.service 2>/dev/null || true

# LLMNR/mDNS off — reduce LAN chatter / 5355 listeners
mkdir -p /etc/systemd/resolved.conf.d
cat >/etc/systemd/resolved.conf.d/99-eliteew-prod.conf <<'EOF'
[Resolve]
LLMNR=no
MulticastDNS=no
EOF
systemctl restart systemd-resolved 2>/dev/null || true

# Journal size cap (prod host can grow multi-GB logs)
mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/99-eliteew-prod.conf <<'EOF'
[Journal]
SystemMaxUse=800M
SystemKeepFree=2G
MaxRetentionSec=14day
Compress=yes
EOF
systemctl restart systemd-journald 2>/dev/null || true

# User-scope leftovers (SSFEW retired; meet guard duplicated by system)
sudo -u owned XDG_RUNTIME_DIR=/run/user/1000 systemctl --user disable --now \
  eliteew-meet-media-guard.timer eliteew-meet-media-guard.service \
  eliteew-ssfew-agent.timer eliteew-ssfew-agent.service \
  2>/dev/null || true
echo "disabled user-scope: meet-media-guard + ssfew-agent"

# Point system meet guard at rootless podman socket so JVB check works
GUARD_DROPIN_DIR=/etc/systemd/system/eliteew-meet-media-guard.service.d
mkdir -p "${GUARD_DROPIN_DIR}"
cat >"${GUARD_DROPIN_DIR}/10-rootless-podman.conf" <<'EOF'
[Service]
Environment=CONTAINER_HOST=unix:///run/user/1000/podman/podman.sock
Environment=MEET_MEDIA_GUARD_ALLOW_FIREWALL_FIX=1
EOF
systemctl daemon-reload
systemctl enable --now eliteew-meet-media-guard.timer
systemctl start eliteew-meet-media-guard.service || true

# Ensure prod podman autostart (user linger already expected)
sudo -u owned XDG_RUNTIME_DIR=/run/user/1000 systemctl --user enable eliteew-podman-autostart.service 2>/dev/null || true
loginctl enable-linger owned 2>/dev/null || true

echo "=== [5/6] NVIDIA (optional) ==="
if [[ "${ELITEEW_HARDEN_SKIP_NVIDIA:-0}" == "1" ]]; then
  echo "SKIP NVIDIA/MOK (ELITEEW_HARDEN_SKIP_NVIDIA=1) — operator installs drivers separately."
  echo "After drivers: sudo modprobe nvidia && sudo nvidia-smi && sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml"
  echo "Then: systemctl enable --now nvidia-persistenced; bash docker/scripts/prod-core/start-stack9-voice.sh"
  echo "And: ELITEEW_PROD_CORE_LOCAL=1 bash docker/scripts/start-prod-core-stacks.sh stack2"
else
  AKMODS_CERT=/etc/pki/akmods/certs/public_key.der
  if [[ -f "${AKMODS_CERT}" ]]; then
    mokutil --import "${AKMODS_CERT}" || true
    echo "MOK import requested for ${AKMODS_CERT} (reboot + Enroll MOK if pending)."
  else
    echo "WARN: ${AKMODS_CERT} missing — run akmods --force after driver install"
  fi
  modprobe nvidia 2>/dev/null || true
  if nvidia-smi >/dev/null 2>&1; then
    systemctl enable --now nvidia-persistenced.service 2>/dev/null || true
    mkdir -p /etc/cdi /etc/nvidia-container-toolkit
    # System unit default writes /var/run/cdi; pin /etc/cdi so Podman always sees a fresh path.
    cat >/etc/nvidia-container-toolkit/nvidia-cdi-refresh.env <<'EOF'
NVIDIA_CTK_CDI_OUTPUT_FILE_PATH=/etc/cdi/nvidia.yaml
EOF
    nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml 2>/dev/null || true
    systemctl enable --now nvidia-cdi-refresh.service 2>/dev/null || true
    systemctl enable --now nvidia-cdi-refresh.path 2>/dev/null || true
    echo "NVIDIA OK (persistenced + CDI refresh enabled)"; nvidia-smi -L || true
  else
    echo "NVIDIA still down — install/enroll drivers, then modprobe + CDI."
    echo "Until then keep nvidia-cdi-refresh disabled; enable after nvidia-smi works."
  fi
fi

echo "=== [6/6] summary ==="
systemctl --failed --no-pager || true
sshd -T 2>/dev/null | rg -i '^(passwordauthentication|permitrootlogin|x11forwarding|pubkeyauthentication) ' || true
echo "DONE harden-prod-core-host.sh"
