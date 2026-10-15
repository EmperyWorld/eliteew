# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — disk install fails after extract: chroot grub-install missing.
# ---

# trusted-substrate — grub-install missing in chroot after extract

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **product_id** | `trusted-substrate` |
| **symptom** | Apply reaches extract then Failed; log: `chroot: failed to run command 'grub-install': No such file or directory` |
| **failure layer** | install-apply bootloader step |
| **root cause** | `rootfs.tar.gz` is a runtime image (has `boot/grub/grub.cfg` stub only, no `grub-install`). Apply ran `chroot $mnt grub-install`. |
| **fix** | Run live `grub-install --efi-directory/--boot-directory/--removable` on target disk; write `grub.cfg` with `root=PARTUUID=…`. |
| **verification** | Metal log showed ENOENT; archive `tar -tz` has no grub-install; selftest locks host install path. |
| **also_affects** | — |
