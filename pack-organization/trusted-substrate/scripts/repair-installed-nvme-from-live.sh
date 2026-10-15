#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Run on LIVE installer media (SSH). Mounts installed NVMe root and repairs
# cause-layer gaps: ssh host keys, kiosk hold, fonts/i915/client from current
# live archive — without full reinstall.
set -euo pipefail

DISK="${1:-/dev/nvme0n1}"
ARCHIVE="${ELITEEW_TS_ROOTFS_ARCHIVE:-/opt/eliteew-ts-install/rootfs.tar.gz}"
MNT="${ELITEEW_TS_REPAIR_MNT:-/mnt/eliteew-ts-repair}"

die() { echo "FATAL: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "run as root (sudo -n)"
[[ -b "$DISK" ]] || die "not a block device: $DISK"
[[ -f "$ARCHIVE" ]] || die "missing archive: $ARCHIVE"

if [[ "$DISK" == *nvme* ]]; then
  P1="${DISK}p1"
  P2="${DISK}p2"
else
  P1="${DISK}1"
  P2="${DISK}2"
fi
[[ -b "$P2" ]] || die "missing root partition $P2"

mkdir -p "$MNT"
mountpoint -q "$MNT" && umount -R "$MNT" || true
mount "$P2" "$MNT"
mkdir -p "$MNT/boot/efi"
if [[ -b "$P1" ]]; then
  mountpoint -q "$MNT/boot/efi" || mount "$P1" "$MNT/boot/efi" || true
fi

echo "[repair] extracting metal stack files from $ARCHIVE"
TMP="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP"
  umount "$MNT/boot/efi" 2>/dev/null || true
  umount "$MNT" 2>/dev/null || true
}
trap cleanup EXIT

# Selective extract of cause-layer paths (OS helpers — not Desktop Client).
# Desktop Client is baked into BR SoT at post-build (payload-tauri.env pin).
# Never host-cp from repair onto installed NVMe.
gzip -dc "$ARCHIVE" | tar -C "$TMP" -x \
  ./usr/local/bin/eliteew-ts-kiosk \
  ./usr/local/bin/eliteew-ts-session-router \
  ./usr/local/bin/eliteew-ts-install-apply \
  ./usr/share/fonts/dejavu \
  ./lib/firmware/i915 \
  ./etc/ssh/sshd_config \
  ./etc/ssh/sshd_config.d/10-empiieros-security.conf \
  ./home/eliteew-ts/.bash_profile \
  ./usr/local/sbin/empiieros-wifi-restore \
  ./etc/systemd/network/20-wireless.network \
  ./etc/systemd/system/getty@tty1.service.d/autologin.conf \
  ./etc/systemd/system/empiieros-runtime.service \
  ./etc/systemd/system/empiieros-shell-bridge.socket \
  ./etc/systemd/system/empiieros-shell-bridge.service \
  ./etc/systemd/system/empiieros-wifi@.service \
  ./etc/systemd/system/empiieros-wifi-restore.service \
  ./etc/systemd/system/empiieros-power-reboot.service \
  ./etc/systemd/system/empiieros-power-poweroff.service \
  2>/dev/null || true

# Always sync what we got
for rel in \
  usr/local/bin/eliteew-ts-kiosk \
  usr/local/bin/eliteew-ts-session-router \
  usr/share/fonts/dejavu \
  lib/firmware/i915 \
  etc/ssh/sshd_config \
  home/eliteew-ts/.bash_profile \
  usr/local/sbin/empiieros-wifi-restore \
  etc/systemd/network/20-wireless.network \
  etc/systemd/system/getty@tty1.service.d/autologin.conf \
  etc/systemd/system/empiieros-runtime.service \
  etc/systemd/system/empiieros-shell-bridge.socket \
  etc/systemd/system/empiieros-shell-bridge.service \
  etc/systemd/system/empiieros-wifi@.service \
  etc/systemd/system/empiieros-wifi-restore.service \
  etc/systemd/system/empiieros-power-reboot.service \
  etc/systemd/system/empiieros-power-poweroff.service; do
  if [[ -e "$TMP/$rel" ]]; then
    mkdir -p "$MNT/$(dirname "$rel")"
    cp -a "$TMP/$rel" "$MNT/$rel"
    echo "[repair] synced $rel"
  fi
done

# SSH host keys: ALWAYS regenerate (never keep stale/clone keys); root:root
echo "[repair] regenerating ssh host keys on installed root"
rm -f "$MNT"/etc/ssh/ssh_host_*
mkdir -p "$MNT/etc/ssh"
if command -v ssh-keygen >/dev/null 2>&1; then
  # Prefer live OpenSSH -A -f — fresh/mounted root may lack /dev/null for chroot
  ssh-keygen -A -f "$MNT" || die "ssh-keygen -A -f failed"
elif [[ -x "$MNT/usr/bin/ssh-keygen" ]]; then
  mkdir -p "$MNT/dev"
  if [[ ! -c "$MNT/dev/null" ]]; then
    if [[ -c /dev/null ]] && mount --bind /dev "$MNT/dev" 2>/dev/null; then
      :
    else
      mknod -m 666 "$MNT/dev/null" c 1 3 || die "cannot create $MNT/dev/null"
    fi
  fi
  chroot "$MNT" /usr/bin/ssh-keygen -A || die "chroot ssh-keygen -A failed"
  umount "$MNT/dev" 2>/dev/null || true
else
  die "ssh-keygen missing on live and target"
fi
[[ -f "$MNT/etc/ssh/ssh_host_ed25519_key" || -f "$MNT/etc/ssh/ssh_host_rsa_key" ]] \
  || die "no ssh host keys after regenerate"
chown root:root "$MNT/etc/ssh"/ssh_host_*
chmod 600 "$MNT/etc/ssh"/ssh_host_*_key 2>/dev/null || true
chmod 644 "$MNT/etc/ssh"/ssh_host_*.pub 2>/dev/null || true
echo "[repair] ssh host keys ownership → root:root"
owner="$(stat -c '%u' "$MNT/etc/ssh/ssh_host_ed25519_key" 2>/dev/null \
  || stat -c '%u' "$MNT/etc/ssh/ssh_host_rsa_key" 2>/dev/null || echo missing)"
[[ "$owner" == "0" ]] || die "ssh host key still not root-owned (uid=$owner)"
kiosk_uid="$(awk -F: '$1=="eliteew-ts"{print $3; exit}' "$MNT/etc/passwd")"
kiosk_gid="$(awk -F: '$1=="eliteew-ts"{print $4; exit}' "$MNT/etc/passwd")"
maint_uid="$(awk -F: '$1=="empiieros-maint"{print $3; exit}' "$MNT/etc/passwd")"
maint_gid="$(awk -F: '$1=="empiieros-maint"{print $4; exit}' "$MNT/etc/passwd")"
[[ "$kiosk_uid:$kiosk_gid" == "105:113" ]] \
  || die "kiosk identity 105:113 missing from installed root"
[[ "$maint_uid:$maint_gid" == "106:114" ]] \
  || die "maintenance identity 106:114 missing; use a fresh secure-reset image"
if [[ -d "$MNT/home/eliteew-ts" ]]; then
  chown -R "$kiosk_uid:$kiosk_gid" "$MNT/home/eliteew-ts"
  echo "[repair] home/eliteew-ts → ${kiosk_uid}:${kiosk_gid}"
fi
mkdir -p "$MNT/etc/ssh/sshd_config.d"
if [[ ! -f "$MNT/etc/ssh/sshd_config" ]] \
  || ! awk 'NF && $1 !~ /^#/ { print; exit }' "$MNT/etc/ssh/sshd_config" \
    | grep -Fqx 'Include /etc/ssh/sshd_config.d/*.conf'; then
  cat >"$MNT/etc/ssh/sshd_config" <<'EOF'
Include /etc/ssh/sshd_config.d/*.conf
Subsystem sftp internal-sftp
EOF
fi
if [[ -f "$TMP/etc/ssh/sshd_config.d/10-empiieros-security.conf" ]]; then
  cp -a "$TMP/etc/ssh/sshd_config.d/10-empiieros-security.conf" "$MNT/etc/ssh/sshd_config.d/"
else
  cat >"$MNT/etc/ssh/sshd_config.d/10-empiieros-security.conf" <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
AllowUsers empiieros-maint
MaxAuthTries 3
MaxSessions 4
LoginGraceTime 30
StrictModes yes
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
AllowStreamLocalForwarding no
GatewayPorts no
PermitTunnel no
PermitUserEnvironment no
EOF
fi
chown root:root "$MNT/etc/ssh/sshd_config"
chmod 0644 "$MNT/etc/ssh/sshd_config"
chown root:root "$MNT/etc/ssh/sshd_config.d/10-empiieros-security.conf"
chmod 0644 "$MNT/etc/ssh/sshd_config.d/10-empiieros-security.conf"

# Product path: no live stamp, no system kiosk unit fight
rm -f "$MNT/etc/eliteew-trusted-substrate/live-installer"
rm -f "$MNT/etc/sudoers.d/eliteew-ts-installer"
rm -f "$MNT/etc/systemd/system/multi-user.target.wants/eliteew-ts-kiosk.service"
mkdir -p "$MNT/etc/systemd/system/multi-user.target.wants"
ln -sfn /usr/lib/systemd/system/seatd.service \
  "$MNT/etc/systemd/system/multi-user.target.wants/seatd.service" 2>/dev/null || true
if [[ -f "$MNT/etc/systemd/system/empiieros-wifi-restore.service" ]]; then
  ln -sfn ../empiieros-wifi-restore.service \
    "$MNT/etc/systemd/system/multi-user.target.wants/empiieros-wifi-restore.service"
fi
if [[ -x "$MNT/usr/local/bin/empiieros-runtime" \
  && -f "$MNT/etc/systemd/system/empiieros-runtime.service" ]]; then
  ln -sfn ../empiieros-runtime.service \
    "$MNT/etc/systemd/system/multi-user.target.wants/empiieros-runtime.service"
fi
if [[ -f "$MNT/etc/systemd/system/empiieros-shell-bridge.socket" ]]; then
  mkdir -p "$MNT/etc/systemd/system/sockets.target.wants"
  ln -sfn ../empiieros-shell-bridge.socket \
    "$MNT/etc/systemd/system/sockets.target.wants/empiieros-shell-bridge.socket"
fi

# Copy an explicitly provisioned live-media public key when available.
LIVE_AUTHORIZED_KEYS="/home/eliteew-ts/.ssh/authorized_keys"
TARGET_AUTHORIZED_KEYS="$MNT/home/empiieros-maint/.ssh/authorized_keys"
if [[ -s "$LIVE_AUTHORIZED_KEYS" ]]; then
  install -d -m 0700 -o "$maint_uid" -g "$maint_gid" "$MNT/home/empiieros-maint/.ssh"
  install -m 0600 -o "$maint_uid" -g "$maint_gid" \
    "$LIVE_AUTHORIZED_KEYS" "$TARGET_AUTHORIZED_KEYS"
fi
if [[ -s "$TARGET_AUTHORIZED_KEYS" ]]; then
  if [[ -L "$MNT/etc/systemd/system/sshd.service" ]] \
    && [[ "$(readlink "$MNT/etc/systemd/system/sshd.service")" == "/dev/null" ]]; then
    rm -f "$MNT/etc/systemd/system/sshd.service"
  fi
  ln -sfn /usr/lib/systemd/system/sshd.service \
    "$MNT/etc/systemd/system/multi-user.target.wants/sshd.service"
  echo "[repair] key-only sshd enabled"
else
  rm -f "$MNT/etc/systemd/system/multi-user.target.wants/sshd.service"
  ln -sfn /dev/null "$MNT/etc/systemd/system/sshd.service"
  echo "[repair] no operator public key; sshd masked"
fi

# Sanity
[[ -f "$MNT/etc/ssh/ssh_host_ed25519_key" ]] || die "ssh host key still missing"
[[ -x "$MNT/usr/local/bin/eliteew-ts-kiosk" ]] || die "kiosk missing"
grep -q 'holding tty1 — not exiting' "$MNT/usr/local/bin/eliteew-ts-kiosk" \
  || die "kiosk hold guard missing — wrong binary"

sync
echo "[repair] OK — reboot installed NVMe; sshd listens only when an operator public key exists."
