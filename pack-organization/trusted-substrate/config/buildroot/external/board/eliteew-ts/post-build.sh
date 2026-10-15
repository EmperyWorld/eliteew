#!/usr/bin/env bash
# Purpose: post-build hooks for EliteEW Trusted Substrate rootfs (W4).
# Related: docs/ROOTFS-FROM-SOURCE.md
set -euo pipefail

TARGET_DIR="${1:-${TARGET_DIR:-}}"
if [[ -z "${TARGET_DIR}" || ! -d "${TARGET_DIR}" ]]; then
  echo "eliteew-ts post-build: TARGET_DIR required" >&2
  exit 1
fi

LABELS="${TARGET_DIR}/etc/eliteew-trusted-substrate/labels"
if [[ ! -f "${LABELS}" ]]; then
  echo "eliteew-ts post-build: FAIL missing labels (overlay not applied?)" >&2
  exit 1
fi
if ! rg -q '^os_trust=from-source$' "${LABELS}"; then
  echo "eliteew-ts post-build: FAIL os_trust must be from-source for W4 image" >&2
  exit 1
fi
if ! rg -q '^payload_trust=(tauri-living|eliteew-runtime)$' "${LABELS}"; then
  echo "eliteew-ts post-build: FAIL payload_trust must be tauri-living or eliteew-runtime for from-source W4" >&2
  exit 1
fi
if ! rg -q '^payload_profile=(tauri|empiieros-shell)$' "${LABELS}"; then
  echo "eliteew-ts post-build: FAIL payload_profile must be tauri or empiieros-shell" >&2
  exit 1
fi
if rg -q '^payload_profile=empiieros-shell$' "${LABELS}"; then
  rg -q '^payload_trust=eliteew-runtime$' "${LABELS}" || {
    echo "eliteew-ts post-build: FAIL empiieros-shell requires payload_trust=eliteew-runtime" >&2
    exit 1
  }
else
  rg -q '^payload_trust=tauri-living$' "${LABELS}" || {
    echo "eliteew-ts post-build: FAIL tauri profile requires payload_trust=tauri-living" >&2
    exit 1
  }
fi

# Forbidden: WG peer materials in image (W0/W2)
if [[ -d "${TARGET_DIR}/etc/wireguard" ]]; then
  if find "${TARGET_DIR}/etc/wireguard" -type f 2>/dev/null | rg -q '.'; then
    echo "eliteew-ts post-build: FAIL wireguard materials must not be in rootfs" >&2
    exit 1
  fi
fi

mkdir -p "${TARGET_DIR}/run/eliteew-ts"
mkdir -p \
  "${TARGET_DIR}/home/eliteew-ts/EliteEW/Import" \
  "${TARGET_DIR}/home/eliteew-ts/EliteEW/Export" \
  "${TARGET_DIR}/var/lib/systemd/linger"
touch "${TARGET_DIR}/var/lib/systemd/linger/eliteew-ts"

# Full rootfs (not overlay-only selftest): require compositor + session bus helpers.
if [[ -x "${TARGET_DIR}/usr/bin/labwc" || -x "${TARGET_DIR}/bin/labwc" ]]; then
  if [[ ! -x "${TARGET_DIR}/usr/bin/dbus-run-session" && ! -x "${TARGET_DIR}/bin/dbus-run-session" ]]; then
    echo "eliteew-ts post-build: FAIL dbus-run-session missing (session bus for Tauri)" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/bin/killall" && ! -x "${TARGET_DIR}/bin/killall" ]]; then
    echo "eliteew-ts post-build: FAIL killall missing (enable BR2_PACKAGE_PSMISC)" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/bin/gnome-keyring-daemon" ]]; then
    echo "eliteew-ts post-build: FAIL gnome-keyring-daemon missing (enable BR2_PACKAGE_GNOME_KEYRING BR2_EXTERNAL)" >&2
    exit 1
  fi
  # Non-root labwc needs seatd daemon (builtin backend cannot open VTs).
  if [[ ! -x "${TARGET_DIR}/usr/bin/seatd" && ! -x "${TARGET_DIR}/bin/seatd" ]]; then
    echo "eliteew-ts post-build: FAIL seatd missing (enable BR2_PACKAGE_SEATD_DAEMON)" >&2
    exit 1
  fi
  # First-party egui installer refuses to start without DejaVu (MIT-compatible system fonts).
  if [[ ! -f "${TARGET_DIR}/usr/share/fonts/dejavu/DejaVuSans.ttf" ]]; then
    echo "eliteew-ts post-build: FAIL DejaVuSans.ttf missing (enable BR2_PACKAGE_DEJAVU + DEJAVU_SANS)" >&2
    exit 1
  fi
  # Wipe/install toolchain (live apply) — fail closed at image build, not on metal.
  for _bin in lsblk sfdisk wipefs; do
    if [[ ! -x "${TARGET_DIR}/usr/bin/${_bin}" && ! -x "${TARGET_DIR}/usr/sbin/${_bin}" && ! -x "${TARGET_DIR}/bin/${_bin}" && ! -x "${TARGET_DIR}/sbin/${_bin}" ]]; then
      echo "eliteew-ts post-build: FAIL ${_bin} missing (enable BR2_PACKAGE_UTIL_LINUX_BINARIES)" >&2
      exit 1
    fi
  done
  if [[ ! -x "${TARGET_DIR}/usr/sbin/mkfs.vfat" && ! -x "${TARGET_DIR}/usr/sbin/mkfs.fat" ]]; then
    echo "eliteew-ts post-build: FAIL mkfs.vfat/mkfs.fat missing (enable BR2_PACKAGE_DOSFSTOOLS_MKFS_FAT)" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/sbin/cryptsetup" && ! -x "${TARGET_DIR}/sbin/cryptsetup" ]]; then
    echo "eliteew-ts post-build: FAIL cryptsetup missing (enable BR2_PACKAGE_CRYPTSETUP)" >&2
    exit 1
  fi
fi

# Live-installer stamp must NEVER be in the Buildroot SoT image (stamp only on live USB).
if [[ -e "${TARGET_DIR}/etc/eliteew-trusted-substrate/live-installer" ]]; then
  echo "eliteew-ts post-build: FAIL live-installer stamp must not be in BR rootfs (use stamp-live-installer-media.sh on media only)" >&2
  exit 1
fi

# SSH host private keys must NEVER be baked into images/rootfs.tar.gz (apply: ssh-keygen -A).
if find "${TARGET_DIR}/etc/ssh" -maxdepth 1 -type f -name 'ssh_host_*_key' 2>/dev/null | rg -q .; then
  echo "eliteew-ts post-build: FAIL baked ssh_host_* private keys in rootfs (SoT must be keyless)" >&2
  exit 1
fi

# System kiosk unit must not fight agetty --autologin on installed metal.
# Remove any wants link (defense) then fail if still present / if unit has WantedBy.
rm -f "${TARGET_DIR}/etc/systemd/system/multi-user.target.wants/eliteew-ts-kiosk.service"
if [[ -e "${TARGET_DIR}/etc/systemd/system/multi-user.target.wants/eliteew-ts-kiosk.service" ]]; then
  echo "eliteew-ts post-build: FAIL eliteew-ts-kiosk must not be enabled in multi-user.wants (agetty owns tty1)" >&2
  exit 1
fi
if [[ -f "${TARGET_DIR}/etc/systemd/system/eliteew-ts-kiosk.service" ]] \
  && rg -q '^WantedBy=' "${TARGET_DIR}/etc/systemd/system/eliteew-ts-kiosk.service"; then
  echo "eliteew-ts post-build: FAIL eliteew-ts-kiosk.service must not declare WantedBy= (BR finalize would enable it)" >&2
  exit 1
fi

# seatd must be enabled for non-root labwc on metal (overlay wants symlink).
# HARD: use relative symlink — absolute /usr/lib/... breaks `test -e` on host without seatd.
if [[ -x "${TARGET_DIR}/usr/bin/labwc" || -x "${TARGET_DIR}/bin/labwc" ]]; then
  wants_dir="${TARGET_DIR}/etc/systemd/system/multi-user.target.wants"
  mkdir -p "${wants_dir}"
  wants="${wants_dir}/seatd.service"
  if [[ -f "${TARGET_DIR}/usr/lib/systemd/system/seatd.service" ]]; then
    ln -sfn ../../../../usr/lib/systemd/system/seatd.service "${wants}"
  elif [[ -f "${TARGET_DIR}/lib/systemd/system/seatd.service" ]]; then
    ln -sfn ../../../../lib/systemd/system/seatd.service "${wants}"
  else
    echo "eliteew-ts post-build: FAIL seatd.service unit missing for wants enable" >&2
    exit 1
  fi
  if [[ ! -e "${wants}" ]]; then
    echo "eliteew-ts post-build: FAIL seatd not enabled in multi-user.wants" >&2
    exit 1
  fi
fi

# Metal runtime helpers from overlay (fail closed at bake, not via pack inject).
if [[ -x "${TARGET_DIR}/usr/bin/labwc" || -x "${TARGET_DIR}/bin/labwc" ]]; then
  for _bin in eliteew-ts-session-router eliteew-ts-kiosk eliteew-ts-install-apply; do
    if [[ ! -x "${TARGET_DIR}/usr/local/bin/${_bin}" ]]; then
      echo "eliteew-ts post-build: FAIL missing /usr/local/bin/${_bin} (overlay)" >&2
      exit 1
    fi
  done
fi

# Living Desktop Client is baked only for the living Tauri profile. The
# EmpiierOS profile must not carry or fall back to that payload.
TS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
if rg -q '^payload_profile=tauri$' "${LABELS}" \
  && [[ -x "${TARGET_DIR}/usr/bin/labwc" || -x "${TARGET_DIR}/bin/labwc" ]]; then
  bash "${TS_ROOT}/scripts/bake-desktop-client-into-target.sh" "${TARGET_DIR}"
  if [[ ! -x "${TARGET_DIR}/usr/bin/eliteew-desktop-client" ]]; then
    echo "eliteew-ts post-build: FAIL missing /usr/bin/eliteew-desktop-client after bake" >&2
    exit 1
  fi
  # Tauri tray (libappindicator-sys) — Fedora RPMs into /usr/lib (pin = payload-tauri-runtime.env).
  bash "${TS_ROOT}/scripts/bake-tauri-tray-libs-into-target.sh" "${TARGET_DIR}"
  if [[ ! -e "${TARGET_DIR}/usr/lib/libayatana-appindicator3.so.1" ]]; then
    echo "eliteew-ts post-build: FAIL missing libayatana-appindicator3.so.1 after tray bake" >&2
    exit 1
  fi
elif rg -q '^payload_profile=empiieros-shell$' "${LABELS}"; then
  rm -f "${TARGET_DIR}/usr/bin/eliteew-desktop-client"
  rm -rf "${TARGET_DIR}/opt/eliteew-trusted-substrate/payload-slots"
fi

# Sudo stays setuid only for the live-media installer-specific command file.
# The installed image must not grant the kiosk user ambient wheel/root access.
if [[ -f "${TARGET_DIR}/etc/sudoers.d/wheel" ]]; then
  chmod 0440 "${TARGET_DIR}/etc/sudoers.d/wheel"
  if rg -q 'NOPASSWD:[[:space:]]*ALL|ALL=\(ALL\).*ALL' "${TARGET_DIR}/etc/sudoers.d/wheel"; then
    echo "eliteew-ts post-build: FAIL broad wheel sudo is forbidden" >&2
    exit 1
  fi
fi

# Account and filesystem hardening. Autologin on tty1 does not require a
# password; maintenance SSH is key-only and conditionally enabled.
_users_table="${TS_ROOT}/config/buildroot/external/board/eliteew-ts/users.table"
if ! awk '
  $1 == "eliteew-ts" {
    kiosk = 1
    if ($2 != "105" || $3 != "eliteew-ts" || $4 != "113" || $5 != "*" ||
        $6 != "/home/eliteew-ts" || $7 != "/bin/bash" ||
        ("," $8 ",") ~ /,wheel,/) {
      exit 1
    }
  }
  $1 == "empiieros-maint" {
    maintenance = 1
    if ($2 != "106" || $3 != "empiieros-maint" || $4 != "114" || $5 != "*" ||
        $6 != "/home/empiieros-maint" || $7 != "/bin/bash" || $8 != "-") {
      exit 1
    }
  }
  END { if (!kiosk || !maintenance) exit 1 }
' "${_users_table}"; then
  echo "eliteew-ts post-build: FAIL users.table violates split kiosk/maintenance policy" >&2
  exit 1
fi
if [[ -f "${TARGET_DIR}/etc/shadow" ]]; then
  awk -F: 'BEGIN{OFS=FS} $1=="root" || $1=="eliteew-ts" || $1=="empiieros-maint" {if ($2 !~ /^[!*]/) $2="!" $2; if ($2=="!") $2="!*"} {print}' \
    "${TARGET_DIR}/etc/shadow" >"${TARGET_DIR}/etc/shadow.empiieros"
  install -m 0600 "${TARGET_DIR}/etc/shadow.empiieros" "${TARGET_DIR}/etc/shadow"
  rm -f "${TARGET_DIR}/etc/shadow.empiieros"
fi
if [[ -f "${TARGET_DIR}/etc/passwd" ]]; then
  for _account_spec in "eliteew-ts:105:113" "empiieros-maint:106:114"; do
    IFS=: read -r _account_name _expected_uid _expected_gid <<<"${_account_spec}"
    _account="$(awk -F: -v name="${_account_name}" '$1==name{print $3 ":" $4; exit}' \
      "${TARGET_DIR}/etc/passwd")"
    if [[ -n "${_account}" && "${_account}" != "${_expected_uid}:${_expected_gid}" ]]; then
      echo "eliteew-ts post-build: FAIL ${_account_name} uid:gid mismatch" >&2
      exit 1
    fi
  done
fi
if [[ -f "${TARGET_DIR}/etc/group" ]] \
  && awk -F: '$1=="wheel"{print $4}' "${TARGET_DIR}/etc/group" | tr ',' '\n' \
    | rg -qx 'eliteew-ts|empiieros-maint'; then
  echo "eliteew-ts post-build: FAIL kiosk and maintenance users must not be wheel members" >&2
  exit 1
fi
if [[ -f "${TARGET_DIR}/etc/shadow" ]]; then
  for _account_name in root eliteew-ts empiieros-maint; do
    _password_field="$(awk -F: -v name="${_account_name}" '$1==name{print $2; exit}' "${TARGET_DIR}/etc/shadow")"
    [[ -n "${_password_field}" ]] || {
      [[ "${_account_name}" != "root" ]] && continue
      echo "eliteew-ts post-build: FAIL ${_account_name} account is missing" >&2
      exit 1
    }
    [[ "${_password_field}" == '!'* || "${_password_field}" == '*'* ]] \
      || { echo "eliteew-ts post-build: FAIL ${_account_name} password is not locked" >&2; exit 1; }
  done
fi
install -d -m 0755 \
  "${TARGET_DIR}/var/log" \
  "${TARGET_DIR}/var/cache" \
  "${TARGET_DIR}/etc/network" \
  "${TARGET_DIR}/etc/systemd/network" \
  "${TARGET_DIR}/etc/wpa_supplicant" \
  "${TARGET_DIR}/var/empty"
install -d -m 0700 "${TARGET_DIR}/var/lib/empiieros-runtime"
# Buildroot executes post-build unprivileged. Its fakeroot phase later
# normalizes the tree to root:root and applies users.table ownership. The
# post-image verifier below buildroot-build.sh checks the resulting archive.
for _suid in \
  usr/bin/busybox usr/bin/passwd usr/bin/newgrp usr/bin/gpasswd usr/bin/expiry \
  usr/bin/chsh usr/bin/chfn usr/bin/chage usr/libexec/ssh-keysign; do
  [[ -e "${TARGET_DIR}/${_suid}" ]] && chmod u-s "${TARGET_DIR}/${_suid}"
done

install -d -m 0755 "${TARGET_DIR}/etc/ssh/sshd_config.d"
cat >"${TARGET_DIR}/etc/ssh/sshd_config" <<'EOF'
Include /etc/ssh/sshd_config.d/*.conf
Subsystem sftp internal-sftp
EOF
cat >"${TARGET_DIR}/etc/ssh/sshd_config.d/10-empiieros-security.conf" <<'EOF'
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
chmod 0644 "${TARGET_DIR}/etc/ssh/sshd_config"
chmod 0644 "${TARGET_DIR}/etc/ssh/sshd_config.d/10-empiieros-security.conf"

# Air enrollment pre-license egress (overlay SoT — never payload-templates only).
if [[ ! -f "${TARGET_DIR}/etc/eliteew-trusted-substrate/nft/prelicense.nft" ]]; then
  echo "eliteew-ts post-build: FAIL missing prelicense.nft (Air egress overlay)" >&2
  exit 1
fi
if [[ ! -x "${TARGET_DIR}/usr/local/sbin/eliteew-ts-air-enroll-resolve" ]]; then
  echo "eliteew-ts post-build: FAIL missing eliteew-ts-air-enroll-resolve" >&2
  exit 1
fi
if [[ ! -x "${TARGET_DIR}/usr/local/sbin/eliteew-ts-prelicense-nft-apply" ]]; then
  echo "eliteew-ts post-build: FAIL missing eliteew-ts-prelicense-nft-apply" >&2
  exit 1
fi
if [[ ! -e "${TARGET_DIR}/etc/systemd/system/multi-user.target.wants/eliteew-ts-prelicense-nft.service" ]]; then
  echo "eliteew-ts post-build: FAIL prelicense nft service not enabled" >&2
  exit 1
fi
if [[ ! -e "${TARGET_DIR}/etc/systemd/system/timers.target.wants/eliteew-ts-air-enroll-resolve.timer" ]]; then
  echo "eliteew-ts post-build: FAIL air-enroll resolve timer not enabled" >&2
  exit 1
fi
if ! rg -q '62200-63200' "${TARGET_DIR}/etc/eliteew-trusted-substrate/nft/prelicense.nft"; then
  echo "eliteew-ts post-build: FAIL prelicense.nft missing Air port range" >&2
  exit 1
fi
if rg -q 'udp dport 123' "${TARGET_DIR}/etc/eliteew-trusted-substrate/nft/prelicense.nft"; then
  echo "eliteew-ts post-build: FAIL prelicense.nft must not allow public NTP udp/123" >&2
  exit 1
fi
if [[ ! -f "${TARGET_DIR}/etc/systemd/timesyncd.conf.d/00-no-public-ntp.conf" ]]; then
  echo "eliteew-ts post-build: FAIL missing timesyncd no-public-ntp drop-in" >&2
  exit 1
fi
if ! rg -qx 'NTP=' "${TARGET_DIR}/etc/systemd/timesyncd.conf.d/00-no-public-ntp.conf" \
  || ! rg -qx 'FallbackNTP=' "${TARGET_DIR}/etc/systemd/timesyncd.conf.d/00-no-public-ntp.conf"; then
  echo "eliteew-ts post-build: FAIL timesyncd drop-in must empty NTP and FallbackNTP" >&2
  exit 1
fi

# Network stack is enabled explicitly (BR preset-all is unreliable with an
# empty machine-id). Public NTP stays disabled; installer/operator time is SoT.
# Full BR target has unit files; overlay-only selftest only asserts wants links from overlay.
_enable_systemd_unit() {
  local unit="$1"
  local wants_rel="$2"
  local unit_src=""
  if [[ -f "${TARGET_DIR}/etc/systemd/system/${unit}" ]]; then
    unit_src="../${unit}"
  elif [[ -f "${TARGET_DIR}/usr/lib/systemd/system/${unit}" ]]; then
    unit_src="../../../../usr/lib/systemd/system/${unit}"
  elif [[ -f "${TARGET_DIR}/lib/systemd/system/${unit}" ]]; then
    unit_src="../../../../lib/systemd/system/${unit}"
  else
    echo "eliteew-ts post-build: FAIL missing unit ${unit}" >&2
    exit 1
  fi
  local wants_dir="${TARGET_DIR}/etc/systemd/system/${wants_rel}"
  mkdir -p "${wants_dir}"
  ln -sfn "${unit_src}" "${wants_dir}/${unit}"
  if [[ ! -e "${wants_dir}/${unit}" ]]; then
    echo "eliteew-ts post-build: FAIL ${unit} not enabled in ${wants_rel}" >&2
    exit 1
  fi
}
_require_wants_link() {
  local unit="$1"
  local wants_rel="$2"
  if [[ ! -e "${TARGET_DIR}/etc/systemd/system/${wants_rel}/${unit}" ]] \
    && [[ ! -L "${TARGET_DIR}/etc/systemd/system/${wants_rel}/${unit}" ]]; then
    echo "eliteew-ts post-build: FAIL ${unit} not linked in ${wants_rel}" >&2
    exit 1
  fi
}

# Stale overlay copies can leave a kiosk authorized_keys in TARGET_DIR.
# The kiosk identity must never carry an SSH key.
_kiosk_keys="${TARGET_DIR}/home/eliteew-ts/.ssh/authorized_keys"
if [[ -e "${_kiosk_keys}" || -L "${_kiosk_keys}" ]]; then
  rm -f "${_kiosk_keys}"
fi
if [[ -e "${_kiosk_keys}" || -L "${_kiosk_keys}" ]]; then
  echo "eliteew-ts post-build: FAIL kiosk identity still has authorized_keys" >&2
  exit 1
fi

# Maintenance SSH is either explicitly provisioned with public keys or masked
# after preset-all (post-fakeroot-mask-units.sh). Do not mask here: masks before
# preset-all print "is masked, ignoring".
_authorized_keys="${TARGET_DIR}/home/empiieros-maint/.ssh/authorized_keys"
_sshd_mask="${TARGET_DIR}/etc/systemd/system/sshd.service"
_sshd_wants="${TARGET_DIR}/etc/systemd/system/multi-user.target.wants/sshd.service"
if [[ -s "${_authorized_keys}" ]]; then
  if ! awk 'NF && $1 !~ /^#/ {print}' "${_authorized_keys}" \
    | rg -q '^(ssh-ed25519|sk-ssh-ed25519@openssh\.com|ecdsa-sha2-nistp(256|384|521)|sk-ecdsa-sha2-nistp256@openssh\.com|ssh-rsa) [A-Za-z0-9+/=]+( .*)?$'; then
    echo "eliteew-ts post-build: FAIL authorized_keys has no supported public key" >&2
    exit 1
  fi
  if awk 'NF && $1 !~ /^#/ {print}' "${_authorized_keys}" \
    | rg -v '^(ssh-ed25519|sk-ssh-ed25519@openssh\.com|ecdsa-sha2-nistp(256|384|521)|sk-ecdsa-sha2-nistp256@openssh\.com|ssh-rsa) [A-Za-z0-9+/=]+( .*)?$' \
    | rg -q .; then
    echo "eliteew-ts post-build: FAIL authorized_keys contains an unsupported line" >&2
    exit 1
  fi
  install -d -m 0700 "${TARGET_DIR}/home/empiieros-maint/.ssh"
  chmod 0600 "${_authorized_keys}"
  if [[ -L "${_sshd_mask}" && "$(readlink "${_sshd_mask}")" == "/dev/null" ]]; then
    rm -f "${_sshd_mask}"
  fi
  _enable_systemd_unit sshd.service multi-user.target.wants
else
  rm -f "${_sshd_wants}" "${_sshd_mask}"
fi

if [[ -f "${TARGET_DIR}/usr/lib/systemd/system/systemd-timesyncd.service" ]] \
  || [[ -f "${TARGET_DIR}/lib/systemd/system/systemd-timesyncd.service" ]]; then
  _enable_systemd_unit systemd-networkd.service multi-user.target.wants
  _enable_systemd_unit systemd-resolved.service multi-user.target.wants
else
  _require_wants_link systemd-networkd.service multi-user.target.wants
  _require_wants_link systemd-resolved.service multi-user.target.wants
fi
# timesyncd: drop enable links here; mask after preset-all (post-fakeroot).
rm -f "${TARGET_DIR}/etc/systemd/system/sysinit.target.wants/systemd-timesyncd.service"
rm -f "${TARGET_DIR}/etc/systemd/system/systemd-timesyncd.service"

if rg -q '^payload_profile=empiieros-shell$' "${LABELS}"; then
  for _required in \
    usr/local/bin/empiieros-runtime \
    usr/local/bin/empiieros-shell-gui \
    usr/local/bin/eliteew-ts-installer \
    usr/local/sbin/empiieros-wifi-restore \
    usr/lib/systemd/systemd-socket-proxyd \
    etc/systemd/system/empiieros-runtime.service \
    etc/systemd/system/empiieros-shell-bridge.socket \
    etc/systemd/system/empiieros-shell-bridge.service \
    etc/systemd/system/empiieros-wifi@.service \
    etc/systemd/system/empiieros-wifi-restore.service \
    etc/systemd/system/empiieros-power-reboot.service \
    etc/systemd/system/empiieros-power-poweroff.service \
    etc/systemd/system/empiieros-regulatory-db.service \
    etc/systemd/system/systemd-networkd-wait-online.service.d/10-empiieros.conf \
    etc/systemd/system-preset/00-empiieros.preset \
    opt/eliteew-ts-installer/build-manifest.json \
    usr/local/bin/empiieros-state-unlock-agent \
    opt/eliteew-ts-state-unlock-agent/build-manifest.json \
    opt/empiieros/shell/index.html \
    opt/empiieros/build-manifest.json; do
    if [[ ! -e "${TARGET_DIR}/${_required}" ]]; then
      echo "eliteew-ts post-build: FAIL empiieros-shell artifact missing: /${_required}" >&2
      exit 1
    fi
  done
  # --- Seat Shield floor (EmpiierOS overlay) ---
  for _ss in \
    usr/libexec/empiieros-seat-shield-fw \
    usr/share/empiieros/seat-shield/seat_shield.nft \
    etc/systemd/system/empiieros-seat-shield-nftables.service \
    etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-nftables.service; do
    if [[ ! -e "${TARGET_DIR}/${_ss}" ]]; then
      echo "eliteew-ts post-build: FAIL Seat Shield artifact missing: /${_ss}" >&2
      exit 1
    fi
  done
  if [[ ! -x "${TARGET_DIR}/usr/libexec/empiieros-seat-shield-fw" ]]; then
    echo "eliteew-ts post-build: FAIL Seat Shield helper is not executable" >&2
    exit 1
  fi
  if ! rg -q 'blocked4' "${TARGET_DIR}/usr/share/empiieros/seat-shield/seat_shield.nft" \
    || ! rg -q 'blocked6' "${TARGET_DIR}/usr/share/empiieros/seat-shield/seat_shield.nft"; then
    echo "eliteew-ts post-build: FAIL seat_shield.nft missing blocked4/blocked6" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/sbin/nft" ]]; then
    echo "eliteew-ts post-build: FAIL Seat Shield requires /usr/sbin/nft" >&2
    exit 1
  fi
  # Overlay ships a regular-file wants copy (overlay forbids symlinks).
  # systemd 256 ignores non-symlink Wants drop-ins, so replace with a link.
  # Same for audio-amp: a unit-body wants copy makes preset-all fail with
  # "File … already exists" and does not enable the oneshot.
  for _amp in \
    usr/local/sbin/empiieros-audio-volume \
    etc/systemd/system/empiieros-audio-amp.service \
    etc/systemd/system/multi-user.target.wants/empiieros-audio-amp.service; do
    if [[ ! -e "${TARGET_DIR}/${_amp}" ]]; then
      echo "eliteew-ts post-build: FAIL audio amp artifact missing: /${_amp}" >&2
      exit 1
    fi
  done
  _enable_systemd_unit empiieros-audio-amp.service multi-user.target.wants
  if [[ ! -L "${TARGET_DIR}/etc/systemd/system/multi-user.target.wants/empiieros-audio-amp.service" ]]; then
    echo "eliteew-ts post-build: FAIL audio amp wants is not a symlink" >&2
    exit 1
  fi
  _enable_systemd_unit empiieros-seat-shield-nftables.service multi-user.target.wants
  if [[ ! -L "${TARGET_DIR}/etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-nftables.service" ]]; then
    echo "eliteew-ts post-build: FAIL Seat Shield nftables wants is not a symlink" >&2
    exit 1
  fi
  for _sw in \
    usr/libexec/empiieros-seat-shield-watch \
    etc/systemd/system/empiieros-seat-shield-watch.service \
    etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-watch.service; do
    if [[ ! -e "${TARGET_DIR}/${_sw}" ]]; then
      echo "eliteew-ts post-build: FAIL Seat Shield watch artifact missing: /${_sw}" >&2
      exit 1
    fi
  done
  if [[ ! -x "${TARGET_DIR}/usr/libexec/empiieros-seat-shield-watch" ]]; then
    echo "eliteew-ts post-build: FAIL Seat Shield watch helper is not executable" >&2
    exit 1
  fi
  if ! rg -q '^PrivateTmp=false$' "${TARGET_DIR}/etc/systemd/system/empiieros-seat-shield-watch.service"; then
    echo "eliteew-ts post-build: FAIL Seat Shield watch unit must set PrivateTmp=false" >&2
    exit 1
  fi
  if rg -q 'CapabilityBoundingSet' "${TARGET_DIR}/etc/systemd/system/empiieros-seat-shield-watch.service"; then
    echo "eliteew-ts post-build: FAIL Seat Shield watch unit must not take net-admin capability" >&2
    exit 1
  fi
  _enable_systemd_unit empiieros-seat-shield-watch.service multi-user.target.wants
  if [[ ! -L "${TARGET_DIR}/etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-watch.service" ]]; then
    echo "eliteew-ts post-build: FAIL Seat Shield watch wants is not a symlink" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/sbin/wpa_supplicant" ]]; then
    echo "eliteew-ts post-build: FAIL empiieros-shell requires wpa_supplicant" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/sbin/iw" && ! -x "${TARGET_DIR}/usr/bin/iw" ]]; then
    echo "eliteew-ts post-build: FAIL empiieros-shell requires iw" >&2
    exit 1
  fi
  for _regdb in regulatory.db regulatory.db.p7s; do
    if [[ ! -f "${TARGET_DIR}/lib/firmware/${_regdb}" ]]; then
      echo "eliteew-ts post-build: FAIL signed wireless regulatory database missing: ${_regdb}" >&2
      exit 1
    fi
  done
  if [[ ! -x "${TARGET_DIR}/usr/bin/getent" ]]; then
    echo "eliteew-ts post-build: FAIL Air enrollment resolver requires getent" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/local/sbin/empiieros-wifi-restore" ]]; then
    echo "eliteew-ts post-build: FAIL Wi-Fi restore helper is not executable" >&2
    exit 1
  fi
  _runtime_unit="${TARGET_DIR}/etc/systemd/system/empiieros-runtime.service"
  # ProtectHome=tmpfs: a missing BindReadOnlyPaths source fails NAMESPACE.
  # Official images must not carry a kiosk SSH key, so drop that bind when
  # the file is absent. /proc/1/mounts stays: it exists at boot, not in TARGET_DIR.
  python3 - "${_runtime_unit}" "${TARGET_DIR}" <<'PY'
from pathlib import Path
import sys

unit = Path(sys.argv[1])
root = Path(sys.argv[2])
optional = {
    "/home/eliteew-ts/.ssh/authorized_keys",
    "/home/empiieros-maint/.ssh/authorized_keys",
}
kept = []
for line in unit.read_text(encoding="utf-8").splitlines(keepends=True):
    if line.startswith("BindReadOnlyPaths="):
        source = line.split("=", 1)[1].strip().split(":", 1)[0]
        if source in optional and not (root / source.lstrip("/")).is_file():
            continue
    kept.append(line)
unit.write_text("".join(kept), encoding="utf-8")
PY
  if [[ ! -f "${TARGET_DIR}/home/eliteew-ts/.ssh/authorized_keys" ]] \
    && rg -Fxq 'BindReadOnlyPaths=/home/eliteew-ts/.ssh/authorized_keys' "${_runtime_unit}"; then
    echo "eliteew-ts post-build: FAIL Runtime binds missing kiosk authorized_keys" >&2
    exit 1
  fi
  _bridge_socket="${TARGET_DIR}/etc/systemd/system/empiieros-shell-bridge.socket"
  _bridge_service="${TARGET_DIR}/etc/systemd/system/empiieros-shell-bridge.service"
  if rg -q 'CAP_SYS_PTRACE|EMPIIEROS_ALLOWED_SHELL_' "${_runtime_unit}" \
    || ! rg -q '^RuntimeDirectoryMode=0700$' "${_runtime_unit}" \
    || ! rg -q '^Environment=EMPIIEROS_ALLOWED_BRIDGE_UID=0$' "${_runtime_unit}" \
    || ! rg -q '^Environment=EMPIIEROS_ALLOWED_BRIDGE_EXE=/usr/lib/systemd/systemd-socket-proxyd$' \
      "${_runtime_unit}"; then
    echo "eliteew-ts post-build: FAIL Runtime bridge trust contract is insecure" >&2
    exit 1
  fi
  if ! rg -q '^ListenStream=/run/empiieros-shell/runtime.sock$' "${_bridge_socket}" \
    || ! rg -q '^SocketMode=0600$' "${_bridge_socket}" \
    || rg -q '^After=empiieros-runtime.service$' "${_bridge_socket}" \
    || rg -q '^Before=getty@tty1.service$' "${_bridge_socket}" \
    || ! rg -q '^ExecStart=/usr/lib/systemd/systemd-socket-proxyd --connections-max=16 /run/empiieros/runtime.sock$' \
      "${_bridge_service}"; then
    echo "eliteew-ts post-build: FAIL Shell socket-proxy contract is incomplete" >&2
    exit 1
  fi
  _wait_online="${TARGET_DIR}/etc/systemd/system/systemd-networkd-wait-online.service.d/10-empiieros.conf"
  _wired="${TARGET_DIR}/etc/systemd/network/20-wired.network"
  if ! rg -Fq 'systemd-networkd-wait-online --any --ipv4 --timeout=30' "${_wait_online}" \
    || ! rg -q '^RequiredForOnline=yes$' "${_wired}" \
    || ! rg -q '^IPv6AcceptRA=no$' "${_wired}"; then
    echo "eliteew-ts post-build: FAIL wait-online / wired online contract is incomplete" >&2
    exit 1
  fi
  if ! rg -q '^disable wpa_supplicant\.service$' \
    "${TARGET_DIR}/etc/systemd/system-preset/00-empiieros.preset"; then
    echo "eliteew-ts post-build: FAIL stock global wpa_supplicant unit is not disabled" >&2
    exit 1
  fi
  if [[ -L "${TARGET_DIR}/usr/local/bin/empiieros-runtime" \
    || -L "${TARGET_DIR}/usr/local/bin/empiieros-shell-gui" ]] \
    || find "${TARGET_DIR}/opt/empiieros" -type l -print -quit | rg -q .; then
    echo "eliteew-ts post-build: FAIL symbolic links are forbidden in the EmpiierOS payload" >&2
    exit 1
  fi
  chmod 0755 \
    "${TARGET_DIR}/usr/local/bin/empiieros-runtime" \
    "${TARGET_DIR}/usr/local/bin/empiieros-shell-gui"
  find "${TARGET_DIR}/opt/empiieros" -type d -exec chmod 0755 {} +
  find "${TARGET_DIR}/opt/empiieros" -type f -exec chmod 0644 {} +
  if [[ -f "${TARGET_DIR}/home/empiieros-maint/.ssh/authorized_keys" ]]; then
    chmod 0700 "${TARGET_DIR}/home/empiieros-maint/.ssh"
    chmod 0600 "${TARGET_DIR}/home/empiieros-maint/.ssh/authorized_keys"
  fi
  if [[ -e "${TARGET_DIR}/usr/bin/eliteew-desktop-client" ]]; then
    echo "eliteew-ts post-build: FAIL empiieros-shell image contains Tauri desktop payload" >&2
    exit 1
  fi
  _enable_systemd_unit empiieros-runtime.service multi-user.target.wants
  _enable_systemd_unit empiieros-shell-bridge.socket sockets.target.wants
  _enable_systemd_unit empiieros-regulatory-db.service multi-user.target.wants
  _enable_systemd_unit empiieros-wifi-restore.service multi-user.target.wants
  rm -f "${TARGET_DIR}/etc/systemd/network/eth0.network"
  if [[ -e "${TARGET_DIR}/etc/systemd/network/eth0.network" ]]; then
    echo "eliteew-ts post-build: FAIL leftover BR2_SYSTEM_DHCP eth0.network remains" >&2
    exit 1
  fi
  if ! rg -F -- '--any --ipv4 --timeout=30' \
    "${TARGET_DIR}/etc/systemd/system/systemd-networkd-wait-online.service.d/10-empiieros.conf"; then
    echo "eliteew-ts post-build: FAIL wait-online IPv4-any policy is missing" >&2
    exit 1
  fi
  # Full images ship pid1 here. The W4 fixture does not, so next-image
  # package presence is enforced only when systemd itself was installed.
  if [[ -e "${TARGET_DIR}/usr/lib/systemd/systemd" ]]; then
    if [[ ! -x "${TARGET_DIR}/usr/bin/systemd-analyze" ]]; then
      echo "eliteew-ts post-build: FAIL systemd-analyze missing from next-image userspace" >&2
      exit 1
    fi
    if [[ ! -x "${TARGET_DIR}/usr/bin/bwrap" ]]; then
      echo "eliteew-ts post-build: FAIL bubblewrap missing for WebKit sandbox" >&2
      exit 1
    fi
    if [[ ! -x "${TARGET_DIR}/usr/bin/xdg-dbus-proxy" ]]; then
      echo "eliteew-ts post-build: FAIL xdg-dbus-proxy missing for WebKit sandbox" >&2
      exit 1
    fi
    if [[ ! -e "${TARGET_DIR}/usr/lib/libseccomp.so.2" \
      && ! -e "${TARGET_DIR}/lib/libseccomp.so.2" \
      && ! -e "${TARGET_DIR}/usr/lib64/libseccomp.so.2" ]]; then
      echo "eliteew-ts post-build: FAIL libseccomp missing for systemd/WebKit seccomp" >&2
      exit 1
    fi
    if [[ ! -x "${TARGET_DIR}/usr/sbin/rfkill" \
      && ! -x "${TARGET_DIR}/usr/bin/rfkill" ]]; then
      echo "eliteew-ts post-build: FAIL rfkill missing from next-image userspace" >&2
      exit 1
    fi
  fi
fi

# Default seat TZ Europe/Moscow when zoneinfo is present (full rootfs).
if [[ -e "${TARGET_DIR}/usr/share/zoneinfo/Europe/Moscow" ]]; then
  if [[ -L "${TARGET_DIR}/etc/localtime" ]]; then
    _tz_tgt="$(readlink "${TARGET_DIR}/etc/localtime" || true)"
    case "${_tz_tgt}" in
      *Europe/Moscow*) ;;
      *)
        ln -sfn ../usr/share/zoneinfo/Europe/Moscow "${TARGET_DIR}/etc/localtime"
        ;;
    esac
  else
    ln -sfn ../usr/share/zoneinfo/Europe/Moscow "${TARGET_DIR}/etc/localtime"
  fi
  printf 'Europe/Moscow\n' > "${TARGET_DIR}/etc/timezone"
elif [[ -L "${TARGET_DIR}/etc/localtime" ]]; then
  readlink "${TARGET_DIR}/etc/localtime" | rg -q 'Europe/Moscow' \
    || { echo "eliteew-ts post-build: FAIL /etc/localtime must point at Europe/Moscow" >&2; exit 1; }
  rg -qx 'Europe/Moscow' "${TARGET_DIR}/etc/timezone" \
    || { echo "eliteew-ts post-build: FAIL /etc/timezone must be Europe/Moscow" >&2; exit 1; }
else
  echo "eliteew-ts post-build: FAIL missing Europe/Moscow timezone (zoneinfo or overlay localtime)" >&2
  exit 1
fi


# Product console is tty1 only. Drop extra getty wants here; apply masks after
# preset-all via post-fakeroot-mask-units.sh (masks before preset → diag noise).
# Instance names are getty@ttyN (not getty@N). Overlay may still ship masks as
# SoT; strip them from TARGET so rootfs preset-all stays quiet.
_drop_systemd_wants_link() {
  local _path="$1"
  [[ -e "${_path}" || -L "${_path}" ]] || return 0
  rm -f "${_path}" 2>/dev/null || true
  if [[ -e "${_path}" || -L "${_path}" ]]; then
    perl -e 'unlink @ARGV or exit($![0] == 2 ? 0 : 1)' "${_path}" 2>/dev/null || true
  fi
}
for _tty in 2 3 4 5 6; do
  rm -f "${TARGET_DIR}/etc/systemd/system/getty@${_tty}.service"
  rm -f "${TARGET_DIR}/etc/systemd/system/getty@tty${_tty}.service"
  while IFS= read -r -d '' _want; do
    _drop_systemd_wants_link "${_want}"
  done < <(find "${TARGET_DIR}/etc/systemd/system" "${TARGET_DIR}/usr/lib/systemd/system" \
    -path "*getty.target.wants/getty@tty${_tty}.service" \( -type l -o -type f \) -print0 2>/dev/null || true)
  _drop_systemd_wants_link \
    "${TARGET_DIR}/etc/systemd/system/getty.target.wants/getty@tty${_tty}.service"
  _drop_systemd_wants_link \
    "${TARGET_DIR}/etc/systemd/system/getty.target.wants/getty@${_tty}.service"
done
# Strip overlay ask-password masks until post-fakeroot (same preset quietness).
rm -f "${TARGET_DIR}/etc/systemd/system/systemd-ask-password-console.path" \
  "${TARGET_DIR}/etc/systemd/system/systemd-ask-password-wall.path"
if [[ -e "${TARGET_DIR}/etc/systemd/system/getty.target.wants/getty@tty2.service" ]]; then
  echo "eliteew-ts post-build: FAIL getty@tty2 must not be enabled" >&2
  exit 1
fi
if [[ -e "${TARGET_DIR}/etc/systemd/system/getty@2.service" ]] \
  || [[ -L "${TARGET_DIR}/etc/systemd/system/getty@2.service" ]]; then
  echo "eliteew-ts post-build: FAIL stale getty@2 must be removed (use getty@tty2)" >&2
  exit 1
fi
if ! rg -q '^disable getty@tty2\.service$' \
  "${TARGET_DIR}/etc/systemd/system-preset/00-empiieros.preset"; then
  echo "eliteew-ts post-build: FAIL 00-empiieros.preset must disable getty@tty2" >&2
  exit 1
fi

# AMD/Intel metal graphics + audio (2026-09-10 readiness) — fail closed if stamps skipped rebuild.
if [[ -x "${TARGET_DIR}/usr/bin/labwc" || -x "${TARGET_DIR}/bin/labwc" ]]; then
  if [[ ! -e "${TARGET_DIR}/usr/lib/dri/radeonsi_dri.so" ]]; then
    echo "eliteew-ts post-build: FAIL missing radeonsi_dri.so (rebuild mesa3d with BR2_PACKAGE_MESA3D_GALLIUM_DRIVER_RADEONSI + LLVM)" >&2
    exit 1
  fi
  # Presence check must not pipe find into rg -q under `set -o pipefail`:
  # rg exits on the first match, find gets SIGPIPE, the pipeline becomes 141,
  # and `!` treats real firmware as missing (false FAIL). Same invariant:
  # at least one regular file under amdgpu/.
  amdgpu_fw="$(find "${TARGET_DIR}/usr/lib/firmware/amdgpu" -type f -print -quit 2>/dev/null || true)"
  if [[ ! -d "${TARGET_DIR}/usr/lib/firmware/amdgpu" || -z "${amdgpu_fw}" ]]; then
    echo "eliteew-ts post-build: FAIL missing amdgpu firmware (enable BR2_PACKAGE_LINUX_FIRMWARE_AMDGPU and rebuild linux-firmware)" >&2
    exit 1
  fi
  if [[ ! -x "${TARGET_DIR}/usr/bin/aplay" && ! -x "${TARGET_DIR}/bin/aplay" ]]; then
    echo "eliteew-ts post-build: FAIL missing aplay (enable BR2_PACKAGE_ALSA_UTILS_APLAY and rebuild alsa-utils)" >&2
    exit 1
  fi
fi

_payload_profile="$(awk -F= '$1=="payload_profile"{print $2; exit}' "${LABELS}")"
echo "eliteew-ts post-build: OK profile=${_payload_profile}+labels+no-wg+account-policy+key-only-ssh+seatd-wants+no-kiosk-wants+air-egress+no-public-ntp+tz-moscow+tty1-only+amd-gpu-audio"
