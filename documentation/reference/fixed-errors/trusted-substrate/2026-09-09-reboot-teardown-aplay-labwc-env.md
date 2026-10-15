# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# Live reboot DRM/libseat assert; aplay missing; labwc systemd --user spam

| Field | Value |
|-------|--------|
| **status** | fixed |
| **date** | 2026-09-09 |
| **product_id** | trusted-substrate |
| **severity** | install SoT / live session |

## Symptom

After install Done → reboot: labwc DRM Permission denied, libseat Broken pipe, assertion. Also aplay WARN every step; systemd1 import-environment fail at session start. Historical first install fail: ssh-keygen without /dev/null.

## Root cause

1. `reboot_now` called `apply reboot` / `systemctl reboot` while labwc still held DRM.
2. `BR2_PACKAGE_ALSA_UTILS=y` but `BR2_PACKAGE_ALSA_UTILS_APLAY` unset → no `/usr/bin/aplay`.
3. labwc `session.c` runs `systemctl --user import-environment` on DRM by default; live getty has no user manager.
4. ssh-keygen chroot path needed bind `/dev`+`/proc` (primary path is `-A -f`).

## Fix

- Ordered reboot: flag + `labwc --exit` → session sync → apply reboot.
- Enable `BR2_PACKAGE_ALSA_UTILS_APLAY=y`.
- `LABWC_UPDATE_ACTIVATION_ENV=0` + `LANG=C.UTF-8` in installer-session.
- `ensure_chroot_dev_proc` before chroot ssh-keygen.

## Verification

selftest + metal: no systemd1 spam at start; reboot without assert storm; aplay after next BR rebake.
