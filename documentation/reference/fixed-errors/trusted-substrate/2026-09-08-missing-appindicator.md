# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: Desktop Client panic missing ayatana-appindicator on substrate.
# ---

# trusted-substrate — missing libayatana-appindicator3

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **updated** | `2026-09-09` |
| **product_id** | `trusted-substrate` |
| **symptom** | labwc up (mouse/Wayland); EliteEW window never appears; app restart loop; black screen |
| **failure layer** | Payload runtime shared libraries (tray) |
| **root cause** | `eliteew-desktop-client` panics in `libappindicator-sys` when `libayatana-appindicator3.so.1` / `libappindicator3.so.1` absent |
| **fix (Fedora kickstart)** | Ship `libayatana-appindicator-gtk3` + `libappindicator-gtk3` via kickstart + `eliteew-ts-extra` |
| **fix (Buildroot SoT)** | `pack-organization/trusted-substrate/scripts/bake-tauri-tray-libs-into-target.sh` from pinned Fedora x86_64 RPMs (`config/payload-tauri-runtime.env`) at post-build → `/usr/lib` — same kinship as Desktop Client RPM bake |
| **verification** | App log no appindicator panic; client window on tty1; archive contains `libayatana-appindicator3.so.1` |
| **also_affects** | Any minimal image hosting the Connected Client RPM without tray libs |

## Evidence

- Fedora USB diag (2026-09-08): panic → exit 101.
- Buildroot metal `192.168.8.10` (2026-09-09): labwc + wayland-0 live; `/tmp/runtime-105/eliteew-ts-app.log` panic loop ~580+; no ayatana `.so` on disk.
