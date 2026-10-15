# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: black screen after GRUB (no cage + masked getty + smoke stub exit).
# ---

# trusted-substrate — black screen after install reboot

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **product_id** | `trusted-substrate` |
| **symptom** | Install succeeds; after GRUB reboot — black screen, no UI/login |
| **failure layer** | Kiosk display session + console ownership |
| **root cause** | Launcher `exec`’d AppImage with no Wayland/X compositor; `getty@tty1` was **masked**; smoke stub exited → empty tty1 with no recovery console on that VT |
| **fix** | Compositor under a **real** agetty `--autologin` session (not masked getty + bare system User=); visible `tty_msg` on failure; F2 break-glass |
| **verification** | Metal: tty1 paints or shows kiosk text; F2 login works |
| **also_affects** | Buildroot overlay kiosk copies (kept in sync) |

## Recommendations

- Never mask the only interactive getty on a kiosk pilot without a compositor + fail-open console.
- Smoke ISO must show honest on-screen text, not silent stub exit.
