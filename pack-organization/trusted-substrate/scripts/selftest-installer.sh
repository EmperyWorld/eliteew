#!/usr/bin/env bash
# Literal $ tokens below are ripgrep test patterns, not shell expansions.
# shellcheck disable=SC2016
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Policy/selftest for MIT first-party disk installer (no third-party installer binaries).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

check() {
  local msg="$1"
  shift
  if "$@"; then
    echo "OK  ${msg}"
  else
    echo "FAIL ${msg}" >&2
    fail=1
  fi
}

check "installer LICENSE is MIT" rg -q 'MIT License' "${ROOT}/installer/LICENSE"
check "Cargo.toml license=MIT" rg -q 'license = "MIT"' "${ROOT}/installer/Cargo.toml"
check "no prebuilt installer .deb/.rpm/.AppImage in tree" \
  bash -c "! find '${ROOT}/installer' -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' -o -name '*.exe' \) | rg -q ."
check "apply helper present" test -x "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "session router present" test -x "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-session-router"
check "installer session present" test -x "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "live-installer stamp present (live media only)" test -f "${ROOT}/live-media/stamp/etc/eliteew-trusted-substrate/live-installer"
check "runtime overlay does not force installer" \
  bash -c "! test -e '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/eliteew-trusted-substrate/live-installer'"
check "stamp script present" test -f "${ROOT}/scripts/stamp-live-installer-media.sh"
check "live sudoers stamp present" test -f "${ROOT}/live-media/stamp/etc/sudoers.d/eliteew-ts-installer"
check "runtime overlay has no wipe sudoers" \
  bash -c "! test -e '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/sudoers.d/eliteew-ts-installer'"
check "apply requires live flag in source" rg -q 'require_live_media' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply refuses mounted disks" rg -q 'refuse_live_or_mounted_disk' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "eframe/egui without default_fonts feature" bash -c "! rg -q '\"default_fonts\"' '${ROOT}/installer/Cargo.toml'"
check "lock has no epaint_default_fonts" bash -c "! rg -q 'epaint_default_fonts' '${ROOT}/installer/Cargo.lock'"
check "defconfig ships util-linux binaries (lsblk/sfdisk)" rg -q 'BR2_PACKAGE_UTIL_LINUX_BINARIES=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
check "fragment ships util-linux binaries (merge-safe)" rg -q 'BR2_PACKAGE_UTIL_LINUX_BINARIES=y' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "fragment ships rfkill" rg -q 'BR2_PACKAGE_UTIL_LINUX_RFKILL=y' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "fragment ships iw" rg -q 'BR2_PACKAGE_IW=y' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "fragment ships wpa_supplicant" rg -q 'BR2_PACKAGE_WPA_SUPPLICANT=y' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "fragment enables wpa_supplicant WPA3 for the next image" rg -q 'BR2_PACKAGE_WPA_SUPPLICANT_WPA3=y' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "fragment enables wpa_supplicant ctrl iface for the next image" rg -q 'BR2_PACKAGE_WPA_SUPPLICANT_CTRL_IFACE=y' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "fragment ships getent for Air resolver" rg -q 'BR2_PACKAGE_GETENT=y' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "kernel ships nftables conntrack expression" rg -q 'CONFIG_NFT_CT=y' "${ROOT}/config/buildroot/external/board/eliteew-ts/linux-security.fragment"
check "EmpiierOS Wi-Fi service present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-wifi@.service"
check "wifi unit allows AF_INET for nl80211" rg -q 'RestrictAddressFamilies=.*AF_INET' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-wifi@.service"
check "apply refuses empty wifi profile" rg -q 'Wi-Fi profile empty' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply waits for live wifi MainPID" rg -q 'wpa_supplicant died after start' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "EmpiierOS persisted Wi-Fi restore service present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-wifi-restore.service"
check "EmpiierOS allowlisted power reboot unit present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-power-reboot.service"
check "EmpiierOS allowlisted poweroff unit present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-power-poweroff.service"
check "power reboot isolates reboot.target" rg -q 'isolate reboot.target' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-power-reboot.service"
check "poweroff isolates poweroff.target" rg -q 'isolate poweroff.target' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-power-poweroff.service"
check "EmpiierOS persisted Wi-Fi restore helper executable" test -x "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-wifi-restore"
check "wireless networkd DHCP policy present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/network/20-wireless.network"
check "stock argument-less wpa service is disabled" rg -q '^disable wpa_supplicant\.service$' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system-preset/00-empiieros.preset"
check "preset disables extra getty@ttyN" rg -q '^disable getty@tty2\.service$' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system-preset/00-empiieros.preset"
check "preset disables timesyncd (mask policy)" rg -q '^disable systemd-timesyncd\.service$' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system-preset/00-empiieros.preset"
check "preset disables sshd when masked" rg -q '^disable sshd\.service$' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system-preset/00-empiieros.preset"
check "preset disables stock ask-password paths" rg -q '^disable systemd-ask-password-console\.path$' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system-preset/00-empiieros.preset"
check "post-build does not mask getty@N" bash -c "! rg -q 'ln -sfn /dev/null \"\$\{TARGET_DIR\}/etc/systemd/system/getty@\$\{_tty\}\.service\"' '${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh'"
check "post-build converts audio-amp wants to symlink" rg -q '_enable_systemd_unit empiieros-audio-amp\.service multi-user\.target\.wants' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "post-fakeroot mask script present" test -x "${ROOT}/config/buildroot/external/board/eliteew-ts/post-fakeroot-mask-units.sh"
check "post-fakeroot masks getty@ttyN" rg -q '_mask "getty@tty\$\{_tty\}\.service"' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-fakeroot-mask-units.sh"
check "post-fakeroot masks timesyncd" rg -q '_mask systemd-timesyncd\.service' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-fakeroot-mask-units.sh"
check "buildroot-build injects post-fakeroot" rg -q 'BR2_ROOTFS_POST_FAKEROOT_SCRIPT' "${ROOT}/scripts/buildroot-build.sh"
check "post-build does not mask getty before preset" bash -c "! rg -q 'ln -sfn /dev/null \"\$\{TARGET_DIR\}/etc/systemd/system/getty@tty\$\{_tty\}\.service\"' '${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh'"
check "EmpiierOS Runtime service present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-runtime.service"
check "Runtime bind-mounts host pid1 mounts" rg -q 'BindReadOnlyPaths=/proc/1/mounts:/run/empiieros/host-mounts' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-runtime.service"
check "defconfig ships dosfstools mkfs.fat" rg -q 'BR2_PACKAGE_DOSFSTOOLS_MKFS_FAT=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
check "defconfig ships grub install tools" rg -q 'BR2_TARGET_GRUB2_INSTALL_TOOLS=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
check "apply preflight require_disk_tools" rg -q 'require_disk_tools' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply extracts via gzip|tar (BusyBox has no tar -z)" rg -q 'gzip -dc' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply does not use tar -xzf" bash -c "! rg -q 'tar -C .* -xzf' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply'"
check "apply releases leftover install mounts" rg -q 'release_installer_mounts' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply grub-install on target ESP (not chroot grub)" rg -q 'grub-install' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply does not chroot grub-install" bash -c "! rg -q 'chroot \"\\\$MNT\" \"\\\$grubbin\"' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply'"
check "apply writes PARTUUID grub.cfg" rg -q 'root=PARTUUID=' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply reads PARTUUID via lsblk not BusyBox blkid" rg -q 'lsblk -n -o' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply validates UUID via read_uuid_field" rg -q 'read_uuid_field' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply writes grub.cfg to ESP EFI/BOOT" rg -q 'EFI/BOOT/grub.cfg' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply generates ssh host keys on target (not baked)" rg -q 'ssh-keygen -A' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply prefers chroot ssh-keygen after bind /dev+/proc" rg -q 'chroot after mount --bind /dev\+/proc' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply release_chroot_dev_proc after keygen" rg -q 'release_chroot_dev_proc' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply umount -l MNT/dev after chroot keygen" rg -q 'umount -l "\$MNT/dev"' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply umount -l MNT/proc after chroot keygen" rg -q 'umount -l "\$MNT/proc"' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply live -A -f is fallback only" rg -q 'live -A -f \(fallback' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply validates operator key with Buildroot awk" rg -q 'valid > 0 && invalid == 0' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply has no unavailable ripgrep runtime dependency" \
  bash -c "! rg -q '(^|[|;&[:space:]])rg([[:space:]]|$)' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply'"
check "network config clear succeeds when no previous profile exists" \
  bash -c '
    set -e
    work="$(mktemp -d)"
    trap '"'"'rmdir "$work"'"'"' EXIT
    ELITEEW_TS_NETWORK_DIR="$work" \
      ELITEEW_TS_INSTALL_LOCK="$work/lock" \
      ELITEEW_TS_INSTALL_LOG="$work/log" \
      source "$1"
    clear_installer_network_configs
    : >"$work/20-eliteew-ts-install-eth0.network"
    clear_installer_network_configs
    [[ ! -e "$work/20-eliteew-ts-install-eth0.network" ]]
    exec 9>&-
    unlink "$work/lock"
    rmdir "$work"
    trap - EXIT
  ' bash "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "archive verification accepts exact hash and rejects corruption" \
  bash -c '
    set -e
    work="$(mktemp -d)"
    trap '"'"'rm -rf -- "$work"'"'"' EXIT
    printf trusted >"$work/rootfs.tar.gz"
    sha256sum "$work/rootfs.tar.gz" | cut -d " " -f1 >"$work/rootfs.tar.gz.sha256"
    ELITEEW_TS_ROOTFS_ARCHIVE="$work/rootfs.tar.gz" \
      ELITEEW_TS_ROOTFS_HASH="$work/rootfs.tar.gz.sha256" \
      ELITEEW_TS_INSTALL_LOCK="$work/lock" \
      ELITEEW_TS_INSTALL_LOG="$work/log" \
      source "$1"
    verify_rootfs_archive
    printf corrupted >>"$work/rootfs.tar.gz"
    if (verify_rootfs_archive >/dev/null 2>&1); then
      exit 1
    fi
  ' bash "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"

check "GUI ordered reboot via flag not immediate systemctl" rg -q 'eliteew-ts-reboot-requested' "${ROOT}/installer/src/apply.rs"
check "session reboots after labwc exit on flag" rg -q 'eliteew-ts-reboot-requested' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "session reboot kill excludes its own process" rg -Fq "pkill -f '^/usr/local/bin/eliteew-ts-installer([[:space:]]|$)'" "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "session has no broad installer self-kill" \
  bash -c "! rg -Fq \"pkill -f '/usr/local/bin/eliteew-ts-installer'\" '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session'"
check "session disables labwc systemd user activation env" rg -q 'LABWC_UPDATE_ACTIVATION_ENV=0' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "session uses generated Russian UTF-8 locale" rg -q '^export LANG=ru_RU.UTF-8$' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "Buildroot generates installer and Shell locales" rg -q '^BR2_GENERATE_LOCALE="en_US.UTF-8 ru_RU.UTF-8"$' "${ROOT}/config/buildroot/fragments/20-network-base.frag"
check "regional settings are persisted into target" rg -q 'regional settings persisted' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "Wi-Fi passphrase is received on stdin, not argv" rg -q 'IFS= read -r psk' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply Wi-Fi key_mgmt matches Runtime WPA-PSK" rg -q 'key_mgmt=WPA-PSK' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply Wi-Fi does not force SAE on this image" bash -c "! rg -q 'key_mgmt=WPA-PSK SAE' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply'"
check "apply Wi-Fi does not write ctrl_interface" bash -c "! rg -q 'ctrl_interface=/run/wpa_supplicant' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply'"
check "apply resets failed Wi-Fi unit before restart" rg -q 'start_installer_wifi_unit' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "installed Wi-Fi profile is root-only" rg -q 'install -m 0600 -o 0 -g 0.*wifi_source' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "common laptop Wi-Fi drivers are required by image gate" rg -q 'CONFIG_RTW89_8852BE' "${ROOT}/scripts/buildroot-build.sh"
check "defconfig enables alsa-utils aplay" rg -q 'BR2_PACKAGE_ALSA_UTILS_APLAY=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"

check "apply wipefs fail-closed (no || true)" rg -q 'wipefs -a "\$disk" \|\| die' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply dd wipe header fail-closed" rg -q 'dd wipe header failed' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply verifies archive hash before disk wipe" rg -q 'verify_rootfs_archive' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply verifies FoFline install proof before wipe" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
fn = text.find("cmd_disk_install()")
proof = text.find("verify_install_proof", fn)
wipe = text.find("wipefs -a", fn)
assert fn != -1 and proof != -1 and wipe != -1 and proof < wipe, (fn, proof, wipe)
PY
check "apply plants first-boot PIN on target" rg -q 'issue_target_first_boot_pin' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply commits empty machine-id before PIN" rg -q 'commit_target_machine_id' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply fingerprint matches Runtime fp_v2" rg -Fq 'eliteew-desktop-client|v2|' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply PIN hash uses first-boot domain" rg -Fq 'empiieros-first-boot-pin-v1|' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "flash writes archive hash witness" rg -q 'rootfs.tar.gz.sha256' "${ROOT}/scripts/flash-live-installer-usb.sh"
check "apply pins selected disk identity before wipe" rg -q 'disk identity changed after selection; refusing wipe' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply verifies installed target contract" rg -q 'target install contract verified' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "real install-to-boot QEMU gate is wired" rg -q 'qemu-installed-system-smoke.sh' "${ROOT}/scripts/selftest-secure-reset.sh"
check "repair always regenerates ssh host keys" rg -q 'regenerating ssh host keys' "${ROOT}/scripts/repair-installed-nvme-from-live.sh"
check "repair prefers ssh-keygen -A -f" rg -q 'ssh-keygen -A -f "\$MNT"' "${ROOT}/scripts/repair-installed-nvme-from-live.sh"
check "repair does not generate-if-missing only" bash -c "! rg -q 'generate if missing' '${ROOT}/scripts/repair-installed-nvme-from-live.sh'"
check "GUI skips removable install targets" rg -q 'съёмный носитель — установка только на внутренний диск' "${ROOT}/installer/src/apply.rs"
check "apply persists exactly one validated installer network profile" rg -q 'expected exactly one persisted installer network config' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "live installer profiles keep RequiredForOnline=no" \
  bash -c 'count="$(rg -c "RequiredForOnline=no" "$1")"; [[ "${count:-0}" -ge 3 ]]' \
  bash "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "persisted installer profile is rewritten to require online" rg -q 'persist_installer_network_profile' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "DHCP installer profile is not persisted as 10- override" rg -q 'installer_profile_is_dhcp' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "DHCP persist skip is logged" rg -q 'skip 10- persist' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply refuses polygon lab persist" rg -q 'refusing polygon lab address' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply persists static only after operator-static" rg -q 'no operator-static this session' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "overlay wired is DHCP IPv4" rg -qx 'DHCP=ipv4' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/network/20-wired.network"
check "overlay network dir does not bake lab /30" bash -c '! rg -q "192\\.168\\.8\\.10" "$1"' bash "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/network"
check "DHCP persist skip is executable" bash -c '
  set -e
  work="$(mktemp -d)"
  trap '"'"'rm -rf -- "$work"'"'"' EXIT
  ELITEEW_TS_NETWORK_DIR="$work" \
    ELITEEW_TS_INSTALL_LOCK="$work/lock" \
    ELITEEW_TS_INSTALL_LOG="$work/log" \
    source "$1"
  printf "%s\n" "DHCP=ipv4" >"$work/dhcp.network"
  printf "%s\n" "DHCP=yes" >"$work/dhcp-yes.network"
  printf "%s\n" "DHCP=no" "Address=10.20.30.2/24" >"$work/static.network"
  installer_profile_is_dhcp "$work/dhcp.network"
  installer_profile_is_dhcp "$work/dhcp-yes.network"
  if installer_profile_is_dhcp "$work/static.network"; then
    exit 1
  fi
  exec 9>&-
  unlink "$work/lock"
' bash "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "wait-online drop-in waits for any IPv4" rg -F -- '--any --ipv4 --timeout=30' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/systemd-networkd-wait-online.service.d/10-empiieros.conf"
check "wired fallback requires IPv4 online" rg -qx 'RequiredForOnline=yes' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/network/20-wired.network"
check "wireless remains optional for online" rg -qx 'RequiredForOnline=no' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/network/20-wireless.network"
check "firmware-dependent ath10k is modular" rg -qx 'CONFIG_ATH10K=m' "${ROOT}/config/buildroot/external/board/eliteew-ts/linux-wifi.fragment"
check "image gate requires modular Wi-Fi drivers" rg -q 'firmware-dependent Wi-Fi driver must be modular' "${ROOT}/scripts/buildroot-build.sh"
check "image gate requires QCA6174 firmware-6.bin" rg -q 'ath10k/QCA6174/hw3.0/firmware-6.bin' "${ROOT}/scripts/buildroot-build.sh"
check "persisted network rewrite is executable" bash -c '
  set -e
  work="$(mktemp -d)"
  trap '"'"'rm -rf -- "$work"'"'"' EXIT
  ELITEEW_TS_NETWORK_DIR="$work" \
    ELITEEW_TS_INSTALL_LOCK="$work/lock" \
    ELITEEW_TS_INSTALL_LOG="$work/log" \
    source "$1"
  printf "%s\n" "[Link]" "RequiredForOnline=no" >"$work/src.network"
  rewrite_persisted_network_online_requirement "$work/src.network" >"$work/out.network"
  grep -qx "RequiredForOnline=yes" "$work/out.network"
  if rewrite_persisted_network_online_requirement "$work/out.network" >/dev/null 2>&1; then
    exit 1
  fi
  exec 9>&-
  unlink "$work/lock"
' bash "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply has no metal-stack inject asserts" bash -c "! rg -q 'assert_extracted_metal_stack|fix_extracted_ownership|assert_archive_metal_kernel' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply'"
check "pack is copy-only (no fuse2fs)" bash -c "! rg -q 'fuse2fs' '${ROOT}/scripts/pack-install-rootfs-metal.sh'"
check "pack is copy-only (cp -a SoT)" rg -q 'copy-only SoT' "${ROOT}/scripts/pack-install-rootfs-metal.sh"
check "pack refuses baked ssh host keys" rg -q 'baked ssh_host_' "${ROOT}/scripts/pack-install-rootfs-metal.sh"
check "pack-from-live-mount retired" bash -c "! test -e '${ROOT}/scripts/pack-install-rootfs-from-live-mount.sh'"
check "flash uses BR images SoT" rg -q 'BR_ROOTFS' "${ROOT}/scripts/flash-live-installer-usb.sh"
check "flash refuses Dual SoT" rg -q 'Dual SoT' "${ROOT}/scripts/flash-live-installer-usb.sh"
check "flash has no host overlay product inject" bash -c "! rg -q 'inject live installer overlay' '${ROOT}/scripts/flash-live-installer-usb.sh'"
check "post-build refuses baked ssh host keys" rg -q 'baked ssh_host_' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "post-build rejects broad wheel sudo" rg -q 'broad wheel sudo is forbidden' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "post-build locks root and kiosk passwords" rg -q 'password is not locked' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "kiosk and SSH maintenance identities are split" rg -q '^empiieros-maint 106 empiieros-maint 114 \* /home/empiieros-maint /bin/bash - ' "${ROOT}/config/buildroot/external/board/eliteew-ts/users.table"
check "installer provisions only maintenance authorized_keys" rg -q 'MNT/home/empiieros-maint/.ssh/authorized_keys' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "post-build SSH permits only maintenance identity" rg -q '^AllowUsers empiieros-maint$' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "post-build makes SSH drop-ins authoritative" rg -Fq 'Include /etc/ssh/sshd_config.d/*.conf' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "live installer network profiles stay optional for online" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
assert text.count("RequiredForOnline=no") >= 3, text.count("RequiredForOnline=no")
assert "persist_installer_network_profile" in text
assert "installer_profile_is_dhcp" in text
assert "skip 10- persist" in text
assert 'print "RequiredForOnline=yes"' in text
PY
check "installer persist rewrites RequiredForOnline=yes" rg -q 'persist_installer_network_profile' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "payload template persist rewrites RequiredForOnline=yes" rg -q 'persist_installer_network_profile' "${ROOT}/payload-templates/usr-local-bin/eliteew-ts-install-apply"
check "payload template no longer raw-copies installer network" bash -c "! rg -q 'cp -a \"\\\$netcfg\"' '${ROOT}/payload-templates/usr-local-bin/eliteew-ts-install-apply'"
check "wait-online drop-in is bounded and any-link" rg -Fq 'systemd-networkd-wait-online --any --ipv4 --timeout=30' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/systemd-networkd-wait-online.service.d/10-empiieros.conf"
check "repair never re-enables password SSH" bash -c "! rg -q '^PasswordAuthentication yes|^KbdInteractiveAuthentication yes' '${ROOT}/scripts/repair-installed-nvme-from-live.sh'"
check "post-build asserts Seat Shield floor" rg -q 'FAIL Seat Shield artifact missing' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "post-build refuses kiosk WantedBy" rg -q 'must not declare WantedBy' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "post-build asserts seatd multi-user.wants" rg -q 'seatd not enabled in multi-user.wants' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "kiosk unit has no WantedBy Install" bash -c "! rg -q '^WantedBy=' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/eliteew-ts-kiosk.service'"
check "apply strips live installer from metal" rg -q 'eliteew-ts-installer-session' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply strips installer share dir" rg -q 'usr/local/share/eliteew-ts-installer' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "repair does not host-cp desktop client" bash -c "! rg -q 'eliteew-desktop-client' '${ROOT}/scripts/repair-installed-nvme-from-live.sh'"
check "bake desktop client script present" test -x "${ROOT}/scripts/bake-desktop-client-into-target.sh"
check "post-build bakes desktop client" rg -q 'bake-desktop-client-into-target' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "bake tray libs script present" test -x "${ROOT}/scripts/bake-tauri-tray-libs-into-target.sh"
check "post-build bakes tray libs" rg -q 'bake-tauri-tray-libs-into-target' "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh"
check "tray runtime example env present" test -f "${ROOT}/config/payload-tauri-runtime.example.env"
check "getty restart is bounded and failure-only" rg -q '^Restart=on-failure$' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/getty@tty1.service.d/autologin.conf"
check "getty Conflicts shutdown targets" rg -q 'Conflicts=.*shutdown\.target' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/getty@tty1.service.d/autologin.conf"
check "wheel sudoers has no privilege grant" bash -c "! rg -q '^[^#].*ALL=' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/sudoers.d/wheel'"
check "payload sync script exists" test -x "${ROOT}/scripts/sync-payload-templates-from-overlay.sh"
check "payload templates match overlay (shared)" bash "${ROOT}/scripts/sync-payload-templates-from-overlay.sh" --check
check "installer compositor restart is bounded" rg -q 'MAX_COMPOSITOR_RESTARTS' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "session does not force pixman by default" bash -c "! rg -q 'WLR_RENDERER=\"\\$\\{WLR_RENDERER:-pixman\\}\"' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session'"
check "kiosk does not force pixman by default" bash -c "! rg -q 'export WLR_RENDERER=\"\\$\\{WLR_RENDERER:-pixman\\}\"' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-kiosk'"
check "kiosk chooses WLR by GPU DRM" rg -q 'choose_wlr_renderer' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-kiosk"
check "kiosk XKB us,ru Alt+Shift" rg -q 'grp:alt_shift_toggle' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-kiosk"
check "installer session XKB us,ru Alt+Shift" rg -q 'grp:alt_shift_toggle' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "installer session blocks VT chords including F2" rg -q 'C-A-F1' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session" \
  && rg -q 'C-A-F2' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "installer GUI blocks dangerous shortcuts" rg -q 'consume_dangerous_shortcuts' "${ROOT}/installer/src/ui.rs"
check "installer progress uses roadmap not log scroll" rg -q 'paint_install_roadmap' "${ROOT}/installer/src/ui.rs" \
  && bash -c "! rg -q 'ScrollArea::vertical\\(\\).*progress_lines' '${ROOT}/installer/src/ui.rs'"
check "apply Wi-Fi PSK validator is C-locale" rg -q 'valid_wifi_psk' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "GUI accepts ZAPISAL PIN ack fallback" rg -q 'ZAPISAL' "${ROOT}/installer/src/ui.rs"
check "GUI splits Wi-Fi PSK errors" rg -q 'validate_wifi_passphrase' "${ROOT}/installer/src/net.rs"
check "defconfig Mesa radeonsi+LLVM" rg -q 'BR2_PACKAGE_MESA3D_GALLIUM_DRIVER_RADEONSI=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig" && rg -q 'BR2_PACKAGE_MESA3D_LLVM=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
check "defconfig amdgpu firmware" rg -q 'BR2_PACKAGE_LINUX_FIRMWARE_AMDGPU=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
check "kernel fragment AMD+HDA" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/linux-gpu-audio.fragment" && rg -q 'CONFIG_DRM_AMDGPU=y' "${ROOT}/config/buildroot/external/board/eliteew-ts/linux-gpu-audio.fragment" && rg -q 'CONFIG_SND_HDA_GENERIC=y' "${ROOT}/config/buildroot/external/board/eliteew-ts/linux-gpu-audio.fragment"
check "users.table includes audio" rg -q ',audio' "${ROOT}/config/buildroot/external/board/eliteew-ts/users.table"
check "kiosk compositor restart is bounded" rg -q 'MAX_COMPOSITOR_RESTARTS' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-kiosk"
check "disk discovery uses /sys/block" rg -q '/sys/block' "${ROOT}/installer/src/apply.rs"
check "stamp chowns sudoers.d to root" rg -q 'chown -R root:root' "${ROOT}/scripts/stamp-live-installer-media.sh"
check "stamp writes V2 install ticket" rg -q 'install-proof.json' "${ROOT}/scripts/stamp-live-installer-media.sh"
check "stamp refuses living ecap on live media" rg -q 'rm -f .*current.ecap' "${ROOT}/scripts/stamp-live-installer-media.sh"
check "apply proof is ticket-only" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
start = text.find("INSTALL_PROOF_BODY=")
end = text.find("\nissue_target_first_boot_pin", start)
fn = text[start:end]
assert start != -1 and end != -1, (start, end)
assert "current.ecap" not in fn, fn
assert "capsule_sha256" not in fn, fn
assert "ELITEEW_TS_INSTALL_CAPSULE" not in fn, fn
assert '{"v":1,"kind":"empiieros-install-proof-v1","product_id":"eliteew-fofline"}' in fn
assert "verify_install_proof()" in fn
PY
check "defconfig ships seatd daemon for non-root labwc" rg -q 'BR2_PACKAGE_SEATD_DAEMON=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
check "installer-session does not pkill itself" bash -c "! rg -q 'pkill -f eliteew-ts-installer[^/-]' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session'"
check "app log persists under HOME" rg -q 'eliteew-ts-installer-app.log' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "build script enforces glibc ceiling" rg -q 'GLIBC_MAX|x86_64-linux-gnu' "${ROOT}/scripts/build-installer-from-source.sh"
check "Buildroot always rebuilds installer from current source" rg -q 'rebuilding first-party installer from current source' "${ROOT}/scripts/buildroot-build.sh"
check "installer build emits provenance manifest" rg -q 'eliteew-ts-installer/build-manifest.json' "${ROOT}/scripts/build-installer-from-source.sh"
check "image verification rejects stale installer binary" rg -q 'stale or unproven installer binary' "${ROOT}/scripts/buildroot-build.sh"
check "Buildroot rebuilds state unlock agent from source" rg -q 'rebuilding state LUKS unlock agent from current source' "${ROOT}/scripts/buildroot-build.sh"
check "state unlock build emits provenance manifest" rg -q 'eliteew-ts-state-unlock-agent/build-manifest.json' "${ROOT}/scripts/build-state-unlock-agent-from-source.sh"
check "image verification rejects stale state unlock agent" rg -q 'stale or unproven state unlock agent' "${ROOT}/scripts/buildroot-build.sh"
check "overlay state unlock agent binary present" test -x "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/empiieros-state-unlock-agent"
check "state unlock agent MIT LICENSE" test -f "${ROOT}/state-unlock-agent/LICENSE"
check "state unlock systemd path unit present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-state-unlock-agent.path"
check "state unlock systemd service unit present" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-state-unlock-agent.service"
check "state unlock path enabled for cryptsetup.target" test -L "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/cryptsetup.target.wants/empiieros-state-unlock-agent.path"
check "stock console ask-password path masked" bash -c "test \"\$(readlink '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/systemd-ask-password-console.path')\" = '/dev/null'"
check "stock wall ask-password path masked" bash -c "test \"\$(readlink '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/systemd-ask-password-wall.path')\" = '/dev/null'"
check "state unlock agent unit tests pass" bash -c 'cd "'"${ROOT}/state-unlock-agent"'" && cargo test --quiet'
check "state unlock agent does not log passphrases" bash -c 'if rg -n "println!|eprintln!|info!|debug!" "'"${ROOT}/state-unlock-agent/src"'" 2>/dev/null | rg -qi pass; then exit 1; fi'
check "overlay installer binary present" test -x "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer"
check "overlay installer binary glibc <= 2.41" bash -c '
  max=$(objdump -T "'"${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer"'" 2>/dev/null | rg -o "GLIBC_[0-9.]+" | sort -Vu | tail -1)
  python3 -c "import sys; s=sys.argv[1].removeprefix(\"GLIBC_\"); t=tuple(int(x) for x in s.split(\".\")); sys.exit(0 if t<=(2,41) else 1)" "$max"
'
for _tty in 2 3 4 5 6; do
  check "getty@tty${_tty} masked to /dev/null" bash -c "test -L '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/getty@tty${_tty}.service' && test \"\$(readlink '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/getty@tty${_tty}.service')\" = '/dev/null'"
  check "getty@tty${_tty} not in getty.target.wants" bash -c "test ! -e '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/getty.target.wants/getty@tty${_tty}.service'"
done
check "bash_profile uses session-router" rg -q 'eliteew-ts-session-router' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/home/eliteew-ts/.bash_profile"
check "brand assets present" test -f "${ROOT}/installer/assets/logo.png" && test -f "${ROOT}/installer/assets/chime.wav"
check "boot splash asset present" test -f "${ROOT}/installer/assets/boot-splash.png"
check "overlay share has splash+chime" test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/share/eliteew-ts-installer/boot-splash.png" && test -f "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/share/eliteew-ts-installer/chime.wav"
check "session plays power-on chime" rg -q 'ELITEEW_TS_CHIME_ALREADY=1' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "session chime is foreground aplay" rg -q 'if aplay -q' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "apply emits extract heartbeats" rg -q 'extract … still running' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "build requires boot-splash.png" rg -q 'missing.*boot-splash.png' "${ROOT}/scripts/build-installer-from-source.sh"
check "ui extract time asymptote" rg -q 'extract_started' "${ROOT}/installer/src/ui.rs" && rg -q '/ 90\.0' "${ROOT}/installer/src/ui.rs"
check "installer wizard body scrolls with wheel" rg -q 'installer_wizard_body' "${ROOT}/installer/src/ui.rs"
check "ui skips welcome chime when ALREADY" rg -q 'ELITEEW_TS_CHIME_ALREADY' "${ROOT}/installer/src/ui.rs"
check "installer reveals first-boot PIN before reboot" rg -q 'first_boot_pin' "${ROOT}/installer/src/ui.rs"
check "installer reboot waits for PIN ack" rg -q 'ЗАПИСАЛ' "${ROOT}/installer/src/ui.rs"
check "apply exposes live PIN reveal path" rg -q 'pin-reveal' "${ROOT}/installer/src/apply.rs"
check "apply pin-reveal is a helper command" rg -q 'pin-reveal' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "GUI reads PIN via root helper" rg -q 'pin-reveal' "${ROOT}/installer/src/apply.rs"
check "apply recovery-reveal is a helper command" rg -q 'recovery-reveal' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply log stays off secret stdout" rg -q 'tee -a "\$LOG" >&2' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply stages state recovery from stdin" rg -q 'state-recovery-stage' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply resolves auto or user state recovery" rg -q 'resolve_state_recovery' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply rejects PIN-shaped user disk key" rg -q 'valid_state_user_secret' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply formats LUKS2 state" rg -q 'luksFormat' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply refuses LUKS if target lacks cryptsetup" rg -q 'target rootfs has no cryptsetup' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply LUKS type is luks2" rg -q -- '--type luks2' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply does not use PIN as LUKS key" bash -c "! rg -n 'luksFormat' -A20 '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply' | rg -q 'generate_first_boot_pin|first-boot-pin'"
check "apply writes crypttab for empiieros-state" rg -q 'empiieros-state UUID=' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply GPT has a state slot" rg -q 'write_gpt_esp_root_state' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "GUI reads state recovery via root helper" rg -q 'recovery-reveal' "${ROOT}/installer/src/apply.rs"
check "GUI stages state recovery over stdin" rg -q 'state-recovery-stage' "${ROOT}/installer/src/apply.rs"
check "GUI Done shows disk recovery" rg -q 'state_recovery' "${ROOT}/installer/src/ui.rs"
check "GUI offers auto or operator disk key" rg -q 'Задать свой ключ' "${ROOT}/installer/src/ui.rs"
check "GUI has StateKey step" rg -q 'Step::StateKey' "${ROOT}/installer/src/ui.rs"
check "GUI does not auto-select strongest Wi-Fi" bash -c "! rg -n 'wifi_networks = networks' -A6 '${ROOT}/installer/src/ui.rs' | rg -q 'first\\(\\)'"
check "GUI names the clicked Wi-Fi SSID" rg -q 'Выбрана сеть' "${ROOT}/installer/src/ui.rs"
check "GUI asks for a manual wall clock" rg -q 'Дата и время' "${ROOT}/installer/src/ui.rs"
check "apply stages installer wall clock" rg -q -- '--datetime' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "first boot consumes install-wall-clock" rg -q 'install-wall-clock' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-apply-install-clock"
check "apply plants install-clock helper" rg -q 'planted install-clock first-boot apply' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply chowns planted seat shell to root" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
start = text.find("plant_seat_shell()")
end = text.find("\nseat_time_helper_src()", start)
body = text[start:end]
assert start != -1 and end != -1, (start, end)
assert "chown -R 0:0" in body, "plant_seat_shell does not chown root"
assert "verify_seat_shell_trusted" in body
assert 'die "seat shell is not root-owned"' in text
contract = text.find("verify_target_install_contract()")
assert contract != -1 and text.find("verify_seat_shell_trusted", contract) != -1
PY
check "apply plants tty1-only console policy" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
assert "plant_target_console_policy()" in text
assert "plant_break_glass_password" not in text
assert "eliteew-ts-change-me" not in text
assert 'must stay password-locked (no extra VT login)' in text
install = text.find("cmd_disk_install()")
assert install != -1 and text.find("plant_target_console_policy", install) != -1
PY
check "apply requires live state unlock agent before wipe" rg -q 'require_state_unlock_agent' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply plants state LUKS unlock agent from live media" rg -q 'planted state LUKS unlock agent from live media' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply disk-install plants state unlock agent" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
assert "plant_target_state_unlock_agent()" in text
install = text.find("cmd_disk_install()")
assert install != -1
assert text.find("require_state_unlock_agent", install) != -1
assert text.find("plant_target_state_unlock_agent", install) != -1
contract = text.find("verify_target_install_contract()")
assert contract != -1 and "empiieros-state-unlock-agent" in text[contract:]
assert "systemd-ask-password-console.path" in text[contract:]
assert "target_path_under_root" in text[contract:]
PY
check "apply keeps extracted IdP Date Runtime" rg -q 'extracted Runtime already IdP Date DPoP; keep SoT' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply plants OTA cutover ReadWritePaths" rg -q 'planted OTA cutover ReadWritePaths' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply plants OTA fetch helper when live has it" rg -q 'planted OTA fetch helper' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "overlay Runtime drop-in allows OTA dests" rg -q '/opt/empiieros' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-runtime.service.d/ota-cutover.conf"
check "apply requires IdP Date runtime before wipe" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
fn = text.find("cmd_disk_install()")
req = text.find("require_idp_date_runtime", fn)
wipe = text.find("wipefs -a", fn)
assert fn != -1 and req != -1 and wipe != -1 and req < wipe, (fn, req, wipe)
PY
check "apply requires install-clock sources before wipe" python3 - "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
fn = text.find("cmd_disk_install()")
req = text.find("require_install_clock_sources", fn)
wipe = text.find("wipefs -a", fn)
assert fn != -1 and req != -1 and wipe != -1 and req < wipe, (fn, req, wipe)
PY
check "overlay share has install-clock helper" test -s "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/share/eliteew-ts-installer/empiieros-apply-install-clock"
check "overlay share time helper matches masked SoT" bash -c '
  ovl="'"${ROOT}"'/config/buildroot/external/board/eliteew-ts/rootfs_overlay"
  bin="${ovl}/usr/local/share/eliteew-ts-installer/empiieros-time-sync"
  unit="${ovl}/usr/local/share/eliteew-ts-installer/empiieros-time-sync.service"
  cmp -s "$bin" "${ovl}/usr/local/sbin/empiieros-time-sync"
  cmp -s "$unit" "${ovl}/etc/systemd/system/empiieros-time-sync.service"
  grep -q ntp_masked "$bin"
  ! grep -q set-ntp "$bin"
  grep -q "Do not enable timesyncd" "$unit"
'
check "stamp plants masked time helper from overlay SoT" rg -q 'plant_live_time_helper' "${ROOT}/scripts/stamp-live-installer-media.sh" && rg -q 'never the live /usr/local/sbin helper' "${ROOT}/scripts/stamp-live-installer-media.sh"
check "apply does not plant OTA artifact PK" bash -c '
  ! rg -q "plant_seat_ota_pk|require_seat_ota_pk" "'"${ROOT}"'/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
'
check "stamp does not plant OTA artifact PK" bash -c '
  ! rg -q "plant_live_ota_pk" "'"${ROOT}"'/scripts/stamp-live-installer-media.sh"
'
check "stamp unplants leftover OTA keys" rg -q 'unplant_live_ota_keys' "${ROOT}/scripts/stamp-live-installer-media.sh"
check "stamp plants overlay apply without OTA PK" rg -q 'plant_live_apply' "${ROOT}/scripts/stamp-live-installer-media.sh"
check "flash refuses leftover ESP OTA PK" rg -q 'strip ESP OTA crutches' "${ROOT}/scripts/flash-live-installer-usb.sh"
check "overlay share has no artifact.pk.hex" bash -c '
  ! test -e "'"${ROOT}"'/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/share/eliteew-ts-installer/artifact.pk.hex"
'
check "apply refuses a missing wall clock stamp" rg -q 'staged wall clock missing' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply forgets leftover live wifi" rg -q 'live-network-forget' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "live session forgets leftover wifi" rg -q 'live-network-forget' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-installer-session"
check "wifi-restore skips live-installer" rg -q 'live-installer' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-wifi-restore.service"
check "overlay wifi unit allows AF_INET" rg -q '(^|[[:space:]])AF_INET([[:space:]]|$)' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-wifi@.service"
check "apply plants live wifi unit" rg -q 'planted live wifi unit with AF_INET' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "apply refuses a silent wifi unit" rg -q 'refusing to plant a silent nl80211 unit' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "wifi-restore kicks DHCP after SSID" rg -q 'networkctl reconfigure' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-wifi-restore"
check "timesyncd is masked" bash -c "[[ \"\$(readlink '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/systemd-timesyncd.service')\" == /dev/null ]]"
check "timesyncd drop-in empties public NTP" rg -qx 'FallbackNTP=' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/timesyncd.conf.d/00-no-public-ntp.conf"
check "prelicense nft has no NTP hole" bash -c "! rg -q 'udp dport 123' '${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/eliteew-trusted-substrate/nft/prelicense.nft'"
check "apply logs associating iface and ssid" rg -q 'associating iface=' "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "GUI rejects PIN as disk key" rg -q 'PIN не может быть ключом диска' "${ROOT}/installer/src/apply.rs"
check "defconfig ships cryptsetup" rg -q 'BR2_PACKAGE_CRYPTSETUP=y' "${ROOT}/config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
check "kernel fragment enables DM_CRYPT" rg -q 'CONFIG_DM_CRYPT=y' "${ROOT}/config/buildroot/external/board/eliteew-ts/linux-security.fragment"
check "state LUKS recipe selftest exists" test -x "${ROOT}/scripts/selftest-state-luks.sh"
check "installer build pins its own CARGO_TARGET_DIR" rg -q 'CARGO_TARGET_DIR="\$\{SRC\}/target"' "${ROOT}/scripts/build-installer-from-source.sh"
check "audio aplay bounded wait" rg -q 'try_wait' "${ROOT}/installer/src/audio.rs" && rg -q 'aplay hung' "${ROOT}/installer/src/audio.rs"
check "design preview mock present" test -f "${ROOT}/installer/assets/design-preview.html"
TRUSTED_SUBSTRATE_CANON="${ROOT}/../../documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md"
check "readiness remains NOT_READY before image and metal acceptance" rg -q 'Status:.*NOT_READY' "${TRUSTED_SUBSTRATE_CANON}"
check "anti-crutch NOT_CRUTCH" rg -q 'NOT_CRUTCH' "${TRUSTED_SUBSTRATE_CANON}"

APPLY="${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
check "fp_v2 and PIN hash match Runtime vectors; off-path and missing tickets are denied" bash -c '
  set -e
  work="$(mktemp -d)"
  trap '"'"'rm -rf -- "$work"'"'"' EXIT
  export ELITEEW_TS_INSTALL_LOCK="$work/lock"
  export ELITEEW_TS_INSTALL_LOG="$work/log"
  export ELITEEW_TS_INSTALL_STATE_DIR="$work/run"
  export ELITEEW_TS_LIVE_FLAG="$work/live-installer"
  source "$1"
  fp="$(fingerprint_v2 eliteew-ts abc uuid-1)"
  [[ "$fp" == "fp_v2_a6b6b3b1d092127bb5910cb371ddab7a" ]]
  mkdir -p "$work/run" "$work/empty-id/etc"
  : >"$work/live-installer"
  : >"$work/empty-id/etc/machine-id"
  mid="$(commit_target_machine_id "$work/empty-id")"
  [[ "$mid" =~ ^[0-9a-f]{32}$ ]]
  [[ "$(tr -d '\n' <"$work/empty-id/etc/machine-id")" == "$mid" ]]
  [[ "$(commit_target_machine_id "$work/empty-id")" == "$mid" ]]
  auto="$(resolve_state_recovery)"
  [[ "$auto" =~ ^[0-9a-f]{4}(-[0-9a-f]{4}){7}$ ]]
  [[ "$auto" != *APPLY* ]]
  printf "%s\n" user operator-disk-key-ok | cmd_state_recovery_stage
  [[ "$(resolve_state_recovery)" == "operator-disk-key-ok" ]]
  valid_state_user_secret 1234 && exit 1
  valid_state_user_secret short && exit 1
  valid_state_user_secret operator-disk-key-ok
  valid_state_unlock_secret operator-disk-key-ok
  valid_state_unlock_secret "$auto"
  (
    export LANG=ru_RU.UTF-8 LC_ALL=ru_RU.UTF-8
    valid_wifi_psk 12345678
    valid_wifi_psk secret12
    valid_wifi_psk short && exit 1
    valid_wifi_country RU
  ) || exit 1
  mkdir -p "$work/wifi-src" "$work/wifi-dst/etc/systemd/system"
  printf "%s\n" "RestrictAddressFamilies=AF_UNIX AF_NETLINK AF_PACKET AF_INET AF_INET6" \
    >"$work/wifi-src/good.service"
  MNT="$work/wifi-dst" WIFI_UNIT="$work/wifi-src/good.service" plant_installed_wifi_unit
  wifi_unit_has_inet "$work/wifi-dst/etc/systemd/system/empiieros-wifi@.service"
  printf "%s\n" "RestrictAddressFamilies=AF_UNIX AF_NETLINK AF_PACKET AF_INET6" \
    >"$work/wifi-src/bad.service"
  if ( MNT="$work/wifi-dst" WIFI_UNIT="$work/wifi-src/bad.service" plant_installed_wifi_unit \
    >/dev/null 2>&1 ); then
    exit 1
  fi
  wifi_unit_has_inet "$work/wifi-src/bad.service" && exit 1
  wifi_unit_has_inet "$work/wifi-src/good.service"
  pin_hash="$(hash_first_boot_pin "$(printf "ab%.0s" {1..16})" fp_v2_aaa 2468)"
  [[ "$pin_hash" == "6aaadbb3168fb3f7fd89960fb1d3aac7a9d358f2f52fbea2bf410ea392587238" ]]
  printf "%s\n" "$INSTALL_PROOF_BODY" >"$work/install-proof.json"
  if ( ELITEEW_TS_INSTALL_PROOF="$work/install-proof.json" \
    verify_install_proof >/dev/null 2>&1 ); then
    exit 1
  fi
  if ( ELITEEW_TS_INSTALL_PROOF=/opt/eliteew-ts-install/missing.json \
    verify_install_proof >/dev/null 2>&1 ); then
    exit 1
  fi
  exec 9>&-
  unlink "$work/lock"
' bash "${APPLY}"
TMPFLAG="$(mktemp -d)/live-installer"
# Without live flag → refuse
if ELITEEW_TS_INSTALL_LOG=/tmp/eliteew-ts-install-selftest.log \
  ELITEEW_TS_LIVE_FLAG=/nonexistent-live-flag \
  bash "${APPLY}" disk-install --disk /dev/null --dry-run 2>/tmp/eliteew-ts-apply-err.txt; then
  echo "FAIL apply should refuse without live flag" >&2
  fail=1
else
  echo "OK  apply refuses without live-installer flag"
fi
# With live flag + bad disk → allowlist refuse
touch "$TMPFLAG"
if ELITEEW_TS_INSTALL_LOG=/tmp/eliteew-ts-install-selftest.log \
  ELITEEW_TS_LIVE_FLAG="$TMPFLAG" \
  ELITEEW_TS_ROOTFS_ARCHIVE=/nonexistent/rootfs.tar.gz \
  bash "${APPLY}" disk-install --disk /dev/null --dry-run 2>/tmp/eliteew-ts-apply-err2.txt; then
  echo "FAIL dry-run should reject /dev/null" >&2
  fail=1
else
  echo "OK  apply rejects non-allowlisted disk"
fi
rm -f "$TMPFLAG"
rmdir "$(dirname "$TMPFLAG")" 2>/dev/null || true

if ! bash "${ROOT}/scripts/selftest-state-luks.sh"; then
  echo "FAIL state LUKS recipe selftest" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "selftest-installer: FAILED" >&2
  exit 1
fi
echo "selftest-installer: PASSED"
