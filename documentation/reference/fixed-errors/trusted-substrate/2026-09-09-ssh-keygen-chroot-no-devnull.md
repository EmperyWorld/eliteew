# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# Install apply: ssh-keygen -A fails — no /dev/null in chroot

| Field | Value |
|-------|--------|
| **status** | fixed |
| **date** | 2026-09-09 |
| **product_id** | trusted-substrate |
| **also_affects** | — |
| **severity** | install SoT / OpenSSH |

## Symptom

GUI install on NVMe reaches extract, then Failed. Apply log: `Couldn't open /dev/null: No such file or directory` then `ERROR: ssh-keygen -A failed`. Disk already wiped/mkfs'd.

## Failure layers

1. **Apply** — preferred path was `chroot $MNT ssh-keygen -A` when target binary exists.
2. **Rootfs extract** — Buildroot `rootfs.tar.gz` has no `/dev` nodes (normal for tar SoT).
3. **OpenSSH** — `ssh-keygen` opens `/dev/null` inside chroot → fail.

## Root cause

chroot into freshly extracted rootfs without `/dev/null` (no bind-mount / mknod).

## Fix

- Prefer live `ssh-keygen -A -f $MNT` (OpenSSH root override; no chroot /dev).
- Fallback: `ensure_target_devnull` (bind `/dev` or `mknod`) then chroot `-A`.
- `release_installer_mounts` umounts `$MNT/dev`.

## Verification

```bash
bash pack-organization/trusted-substrate/scripts/selftest-installer.sh
```

**Metal E2E (2026-09-09, Toshiba NVMe `/dev/nvme0n1`, live USB `/dev/sda`):** first attempt failed (`Couldn't open /dev/null`). After apply patch: `ssh-keygen: generating new host keys: RSA ECDSA ED25519` → `grub-install` «No error reported» → `disk-install complete` → `step -> Done` → reboot requested.

## Recommendations

Never chroot into extracted SoT without `/dev` (or use `ssh-keygen -A -f`).
