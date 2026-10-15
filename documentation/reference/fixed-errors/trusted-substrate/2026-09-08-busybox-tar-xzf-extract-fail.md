# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — live disk install failed at «extracting rootfs»; retries «mounted disk».
# ---

# trusted-substrate — BusyBox tar -xzf fails extract

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **product_id** | `trusted-substrate` |
| **symptom** | Apply reaches `extracting rootfs` then UI Failed; retry: `refusing wipe of mounted disk … (mounts present)` |
| **failure layer** | Live apply helper + BusyBox tar applet |
| **root cause** | Apply used `tar -xzf`. Buildroot ships BusyBox tar which rejects `-z` (`invalid option -- 'z'`). `set -e` aborted without a logged ERROR line; mounts under `/mnt/eliteew-ts-install` stayed up and blocked wipe retry. |
| **fix** | (1) Extract via `gzip -dc \| tar -x` (works with BusyBox). (2) `release_installer_mounts` before commit refuse + EXIT trap. (3) Installer UI drains apply stderr. (4) Selftest locks no `tar -xzf`. |
| **verification** | Host: BusyBox `tar -xzf` → invalid option; `gzip -dc \| busybox tar -x` → ~357M tree. Selftest + inject apply on USB. |
| **also_affects** | Any live script assuming GNU tar flags on BusyBox |

## Evidence

Metal apply log stopped at `extracting rootfs` with no ERROR. Chroot inventory: `/usr/bin/tar → busybox`. Repro: `busybox tar … -xzf` → `invalid option -- 'z'`.
