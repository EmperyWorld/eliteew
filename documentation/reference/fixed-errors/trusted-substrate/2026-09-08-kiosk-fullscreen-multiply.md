# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: non-fullscreen chrome + multiplying launchers on substrate kiosk.
# ---

# trusted-substrate — kiosk not fullscreen and launcher multiply

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **product_id** | `trusted-substrate` |
| **symptom** | Window shows min/max/close; only RMB maximize fills screen; closing/reload leaves ever more launchers |
| **failure layer** | labwc kiosk session (window rules + autostart lifecycle + pkill) |
| **root cause** | (1) Maximize keeps SSD chrome — need fullscreen/no decorations. (2) Each labwc restart leaves orphan `~/.config/labwc/autostart` loops (PPID 1) spawning new clients; Tauri single-instance is per session-bus and does not stop orphans. (3) `pkill -x eliteew-desktop-client` never matches (`comm` max 15 → `eliteew-desktop`). |
| **fix** | windowRules ToggleFullscreen + SetDecorations none; empty root menu; flock on autostart; reap orphans before labwc; `pkill -f '/usr/bin/eliteew-desktop-client'` |
| **commit** | `e3a68d10e` |
| **verification** | Metal: one autostart + one client after heal; selftest asserts |
| **also_affects** | Any labwc kiosk that restarts compositor while autostart runs a forever loop |

## Evidence

`ps` on `.8.10`: multiple `sh …/labwc/autostart` and multiple `/usr/bin/eliteew-desktop-client`. `pkill -x eliteew-desktop-client` → pattern longer than 15 characters.
