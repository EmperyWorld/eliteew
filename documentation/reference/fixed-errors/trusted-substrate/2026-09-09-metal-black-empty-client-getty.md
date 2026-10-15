# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — metal black screen: empty SoT client + getty on-failure.
# ---

# trusted-substrate — metal black screen empty client / getty dead

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **product_id** | `trusted-substrate` |
| **symptom** | `disk-install complete`; SSH/ping OK; black screen; no labwc; kiosk holds or getty inactive |
| **failure layer** | BR SoT payload completeness + getty Restart policy |
| **root cause** | (1) Phase C3 left Desktop Client out of `rootfs.tar.gz`. (2) `Restart=on-failure` stopped tty1 after clean SIGINT/exit — no kiosk recover. |
| **fix** | post-build `bake-desktop-client-into-target.sh` from `payload-tauri.env`; getty `Restart=always` + `Conflicts=shutdown…`; overlay `etc/sudoers.d/wheel`. |
| **verification** | Rebake lists `/usr/bin/eliteew-desktop-client` in archive; metal smoke paints kiosk; no SSH inject. |
| **also_affects** | Live getty policy (same overlay unit) |
