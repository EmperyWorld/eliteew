# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — post-install black screen because install archive ≠ live metal rootfs.
# ---

# trusted-substrate — install archive stale vs live metal (black after GRUB)

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **product_id** | `trusted-substrate` |
| **symptom** | Live installer works; after install reboot — black screen, no input. Same class as early live GRUB freeze. |
| **failure layer** | Install payload artifact (`opt/.../rootfs.tar.gz`) |
| **root cause** | Live USB was patched in place (newer `bzImage` ~14.2M, seatd, session-router) while install still extracted stale `rootfs.tar.gz` (15:43, `bzImage` ~13.7M, no seatd/router). |
| **fix** | Single SoT: Buildroot `images/rootfs.tar.gz` only. `pack-install-rootfs-metal.sh` is **copy-only**. Live USB place must SHA-match BR. Completeness = rebake overlay into BR, never fuse-repack / live inject. |
| **verification** | Packed bzImage size 14214144 + efifb; archive lists seatd + session-router; no live-installer stamp. |
| **also_affects** | Any future live-only inject without repack |
