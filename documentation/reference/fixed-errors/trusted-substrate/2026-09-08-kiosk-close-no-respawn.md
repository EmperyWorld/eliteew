# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: closing Desktop Client leaves empty labwc without restart.
# ---

# trusted-substrate — close window no respawn

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **product_id** | `trusted-substrate` |
| **symptom** | App runs under labwc; closing the window leaves empty desktop; does not come back |
| **failure layer** | Kiosk session lifecycle vs Tauri quit path |
| **root cause** | Close → Tauri `prevent_close` + async revoke; process can remain alive with no windows while autostart `wait` blocks — restart loop never runs |
| **fix** | labwc Close/Alt-F4 → `pkill -x eliteew-desktop-client`; Maximize windowRules; quit-hang watchdog kill -9 |
| **verification** | Close window → client returns within a few seconds |
| **also_affects** | — |
