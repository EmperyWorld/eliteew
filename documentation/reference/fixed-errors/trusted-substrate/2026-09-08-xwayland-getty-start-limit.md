# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: labwc XWayland fail → getty@tty1 start-limit → black cursor.
# ---

# trusted-substrate — labwc XWayland / getty start-limit

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **product_id** | `trusted-substrate` |
| **symptom** | After reboot tty1 flashes red then black blinking cursor; F2 works; journal: getty start-limit-hit; manual kiosk: Wayland Xwayland server create fails |
| **failure layer** | Compositor deps + session lifecycle on tty1 |
| **root cause** | `xorg-x11-server-Xwayland` not in ISO; labwc fails creating Xwayland; kiosk `exec labwc` ends the login session; getty@tty1 hits default start-limit → permanent black VT. Chrony NTP “already in use” is unrelated red noise. |
| **fix** | Ship `xorg-x11-server-Xwayland`; labwc config xwayland enable when binary present; kiosk **loops** labwc (no bare exec); getty drop-in `StartLimitIntervalSec=0` |
| **verification** | Metal: labwc stays up / retries with text; getty not start-limit-hit; Desktop Client visible |
| **also_affects** | — |

## Recommendations

- Treat chrony source collisions as noise unless time is wrong.
- On a live broken box: install Xwayland, `systemctl reset-failed getty@tty1 && systemctl restart getty@tty1`.
