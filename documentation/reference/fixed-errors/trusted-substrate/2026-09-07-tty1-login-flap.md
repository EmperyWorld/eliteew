# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: tty1 login prompt flaps with kiosk (OnFailure getty + Restart=always).
# ---

# trusted-substrate — shaking login on tty1

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **product_id** | `trusted-substrate` |
| **symptom** | After boot tty1 shows a convulsing/shaking login prompt; tty2 asks for password normally |
| **failure layer** | Console ownership / systemd unit deps on tty1 |
| **root cause** | `eliteew-ts-kiosk` had `Restart=always` **and** `OnFailure=getty@tty1` while `Conflicts=getty@tty1`, with getty unmasked — getty and kiosk thrash on the same VT |
| **fix** | Adult path: agetty `--autologin` + `~/.bash_profile` → kiosk; **do not** mask getty; **do not** OnFailure-start getty from a Restart=always system unit; password via `--plaintext` + `chpasswd` |
| **verification** | Metal: tty1 app; F2 password works; selftest-w1 locks autologin drop-in |
| **also_affects** | — |

## Recommendations

- Break-glass belongs on tty2+, never as OnFailure partner of a Restart=always kiosk on tty1.
