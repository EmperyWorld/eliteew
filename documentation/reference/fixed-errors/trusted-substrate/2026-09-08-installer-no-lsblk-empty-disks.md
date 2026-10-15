# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — live installer showed no disks; metal log: lsblk failed to spawn.
# ---

# trusted-substrate — live installer disk list empty (no lsblk)

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **product_id** | `trusted-substrate` |
| **symptom** | Installer network step works; disk step «диски не обнаружены» / empty list (earlier UX sometimes looked like a disk existed then vanished) |
| **failure layer** | Live image package set + disk discovery dependency |
| **root cause** | `BR2_PACKAGE_UTIL_LINUX_BINARIES` was unset — `lsblk`/`sfdisk`/`findmnt` not on rootfs. Installer called `Command::new("lsblk")` → spawn fail → empty Vec. Wipe path also lacked sfdisk/mkfs.vfat/grub-install. |
| **fix** | (1) Disk discovery primary = `/sys/block` (no lsblk required). (2) Enable `UTIL_LINUX_BINARIES` + dosfstools + grub install tools in defconfig; post-build gate. (3) Apply preflight `require_disk_tools` before commit wipe. (4) sudoers.d chown root in stamp. |
| **verification** | Metal log no longer `lsblk failed to spawn`; selftest asserts defconfig + `/sys/block`; stick has `lsblk`/`sfdisk`/`mkfs.vfat`/`grub-install` |
| **also_affects** | Any live apply that assumed util-linux binaries |

## Evidence

`eliteew-ts-installer-app.log`: `lsblk failed to spawn` then `step -> Disk`. Image inventory: `MISS lsblk`, `MISS sfdisk`, `MISS mkfs.vfat`, `MISS grub-install`.
