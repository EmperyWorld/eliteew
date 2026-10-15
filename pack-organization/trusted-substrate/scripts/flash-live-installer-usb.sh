#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Flash Trusted Substrate live-installer USB from Buildroot images/ only.
# Install archive on media must be byte-identical to images/rootfs.tar.gz.
# Forbidden: host overlay product inject, fuse-repack, out/ archive when SHA differs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"

BR_IMG="${ELITEEW_TS_BR_IMAGES:-${ELITEEW_TS_BUILDROOT_OUT}/images}"
OUT_DIR="${ELITEEW_TS_OUT:-${ELITEEW_TS_WORK_ROOT}/out}"
DEV="${1:-/dev/sda}"
LOG="${ELITEEW_TS_FLASH_LOG:-/tmp/eliteew-ts-flash-live.log}"

BR_ROOTFS="${ELITEEW_TS_BR_ROOTFS:-${BR_IMG}/rootfs.tar.gz}"
BR_EXT2="${ELITEEW_TS_BR_EXT2:-${BR_IMG}/rootfs.ext2}"
BR_BZ="${ELITEEW_TS_BR_BZIMAGE:-${BR_IMG}/bzImage}"

exec > >(tee -a "$LOG") 2>&1

die() { echo "FATAL: $*" >&2; exit 1; }

sha_of() { sha256sum "$1" | awk '{print $1}'; }

echo "=== safety ==="
[[ -b "$DEV" ]] || die "not a block device: $DEV"
TRAN="$(lsblk -dn -o TRAN "$DEV" 2>/dev/null || true)"
RM="$(lsblk -dn -o RM "$DEV" 2>/dev/null || true)"
MODEL="$(lsblk -dn -o MODEL "$DEV" 2>/dev/null || true)"
SIZE="$(lsblk -dn -o SIZE "$DEV" 2>/dev/null || true)"
echo "DEV=$DEV TRAN=$TRAN RM=$RM SIZE=$SIZE MODEL=$MODEL"
[[ "$TRAN" == "usb" ]] || die "refuse non-usb device (TRAN=$TRAN)"
[[ "$RM" == "1" ]] || die "refuse non-removable (RM=$RM)"

[[ -f "$BR_ROOTFS" && -f "$BR_EXT2" && -f "$BR_BZ" ]] || die "missing BR images under $BR_IMG"
BR_SHA="$(sha_of "$BR_ROOTFS")"
echo "BR SoT sha256=$BR_SHA"

# Optional staged OUT must match BR (copy-only pack). Never flash divergent out/.
STAGED="${ELITEEW_TS_OUT_ROOTFS:-${OUT_DIR}/rootfs.tar.gz}"
if [[ -f "$STAGED" ]]; then
  ST_SHA="$(sha_of "$STAGED")"
  [[ "$ST_SHA" == "$BR_SHA" ]] || die "CRITICAL: Dual SoT — $STAGED ($ST_SHA) ≠ $BR_ROOTFS ($BR_SHA). Run pack-install-rootfs-metal.sh (copy-only) after rebake."
fi

echo "=== unmount ==="
umount "${DEV}"?* 2>/dev/null || true
umount /mnt/ts-esp /mnt/ts-root 2>/dev/null || true

echo "=== wipe + GPT (ESP + bios_grub + root) ==="
wipefs -a "$DEV"
parted -s "$DEV" mklabel gpt
parted -s "$DEV" mkpart ESP fat32 1MiB 513MiB
parted -s "$DEV" set 1 esp on
parted -s "$DEV" mkpart bios_grub 513MiB 514MiB
parted -s "$DEV" set 2 bios_grub on
parted -s "$DEV" mkpart root ext4 514MiB 100%
partprobe "$DEV"
sleep 1
parted -s "$DEV" print
lsblk "$DEV"

echo "=== format ESP ==="
mkfs.vfat -F32 -n ELITEEWTS "${DEV}1"

echo "=== dd BR rootfs.ext2 → ${DEV}3 ==="
dd if="$BR_EXT2" of="${DEV}3" bs=4M status=progress conv=noerror,notrunc
sync
e2fsck -f -y "${DEV}3" || { ec=$?; [[ "$ec" -le 2 ]] || exit "$ec"; }
resize2fs "${DEV}3"
e2label "${DEV}3" eliteew-ts

echo "=== mount ==="
mkdir -p /mnt/ts-esp /mnt/ts-root
mount "${DEV}1" /mnt/ts-esp
mount "${DEV}3" /mnt/ts-root

echo "=== kernel on ESP + root (from BR images) ==="
mkdir -p /mnt/ts-root/boot /mnt/ts-esp/boot
cp -a "$BR_BZ" /mnt/ts-root/boot/bzImage
cp --no-preserve=ownership "$BR_BZ" /mnt/ts-esp/boot/bzImage

echo "=== refuse product inject — BR overlay must already contain installer bits ==="
for bin in eliteew-ts-installer eliteew-ts-install-apply eliteew-ts-installer-session eliteew-ts-session-router; do
  [[ -x "/mnt/ts-root/usr/local/bin/${bin}" ]] || die "missing /usr/local/bin/${bin} in BR rootfs — rebake Buildroot with overlay (Phase A3)"
done

echo "=== stamp live-installer + sudoers (live-only; not in SoT archive) ==="
bash "$ROOT/scripts/stamp-live-installer-media.sh" /mnt/ts-root

echo "=== place BR rootfs.tar.gz (byte-identical SoT) ==="
mkdir -p /mnt/ts-root/opt/eliteew-ts-install
cp -a "$BR_ROOTFS" /mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz
LIVE_SHA="$(sha_of /mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz)"
[[ "$LIVE_SHA" == "$BR_SHA" ]] || die "CRITICAL: Dual SoT after place — live archive ≠ BR"
printf '%s\n' "$BR_SHA" \
  >/mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz.sha256
chmod 0644 /mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz.sha256

rm -f /mnt/ts-root/etc/eliteew-trusted-substrate/INSTALL-COMPLETE
rm -f /mnt/ts-root/etc/eliteew-trusted-substrate/disable-kiosk

echo "=== grub2-install ==="
grub2-install --target=x86_64-efi --force \
  --efi-directory=/mnt/ts-esp --boot-directory=/mnt/ts-esp/boot \
  --removable --recheck "$DEV"
grub2-install --target=i386-pc \
  --boot-directory=/mnt/ts-esp/boot --recheck "$DEV"

PARTUUID="$(blkid -s PARTUUID -o value "${DEV}3")"
FSUUID="$(blkid -s UUID -o value "${DEV}3")"
[[ -n "$PARTUUID" && -n "$FSUUID" ]] || die "blkid failed"
echo "PARTUUID=$PARTUUID FSUUID=$FSUUID"

mkdir -p /mnt/ts-esp/boot/grub2
cat >/mnt/ts-esp/boot/grub2/grub.cfg <<EOF
set default=0
set timeout=3
insmod part_gpt
insmod ext2
insmod fat
insmod all_video
insmod gzio
insmod efi_gop

menuentry "EliteEW Trusted Substrate — Live Installer" {
    search --no-floppy --file --set=root /boot/bzImage
    linux /boot/bzImage root=PARTUUID=${PARTUUID} rootwait rw console=tty0 earlyprintk=efi,keep loglevel=7
}

menuentry "EliteEW TS Live (fs-uuid fallback)" {
    search --no-floppy --fs-uuid --set=root ${FSUUID}
    linux /boot/bzImage root=PARTUUID=${PARTUUID} rootwait rw console=tty0 earlyprintk=efi,keep loglevel=7
}
EOF
mkdir -p /mnt/ts-esp/EFI/BOOT
cp --no-preserve=ownership /mnt/ts-esp/boot/grub2/grub.cfg /mnt/ts-esp/EFI/BOOT/grub.cfg 2>/dev/null || true

echo "=== strip ESP OTA crutches (never flash-time SoT) ==="
rm -f /mnt/ts-esp/artifact.pk.hex /mnt/ts-esp/artifact.sk.hex \
  /mnt/ts-esp/empiieros-ota-plant-seat-pk.py /mnt/ts-esp/eliteew-ts-install-apply \
  /mnt/ts-esp/_wtest

echo "=== verify ==="
test -e /mnt/ts-root/etc/eliteew-trusted-substrate/live-installer
test -x /mnt/ts-root/usr/local/bin/eliteew-ts-installer
test -f /mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz
test -f /mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz.sha256
test -f /mnt/ts-esp/boot/bzImage
! test -e /mnt/ts-esp/artifact.pk.hex
! test -e /mnt/ts-root/usr/local/share/eliteew-ts-installer/artifact.pk.hex
! grep -qE 'plant_seat_ota_pk|require_seat_ota_pk' \
  /mnt/ts-root/usr/local/bin/eliteew-ts-install-apply
# Product console is tty1 only; extra VT gettys stay masked in factory rootfs.
[[ -L /mnt/ts-root/etc/systemd/system/getty@tty2.service ]] \
  && [[ "$(readlink /mnt/ts-root/etc/systemd/system/getty@tty2.service)" == "/dev/null" ]] \
  || die "getty@tty2 must be masked to /dev/null"
test ! -e /mnt/ts-root/etc/systemd/system/getty.target.wants/getty@tty2.service
[[ "$(sha_of /mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz)" == "$BR_SHA" ]]
du -h /mnt/ts-root/opt/eliteew-ts-install/rootfs.tar.gz
echo "SoT sha256=$BR_SHA"

echo "=== sync + umount ==="
sync
umount /mnt/ts-esp
umount /mnt/ts-root
sync
echo "=== FLASH OK: $DEV is live-installer USB (BR SoT only) ==="
echo "Boot target UEFI; Secure Boot off. Log: $LOG"
