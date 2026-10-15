# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: device_request_prepare fails without OS Secret Service on kiosk.
# ---

# trusted-substrate — missing gnome-keyring / Secret Service

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **product_id** | `trusted-substrate` |
| **symptom** | UI: «Не удалось подготовить запрос устройства»; `~/EliteEW/Import` empty; no `device_crypto_pub.json` |
| **failure layer** | Session secrets provider (OS keyring) for Desktop Client |
| **root cause** | Client stores device signing/recipient SK via Rust `keyring` (`sync-secret-service`). agetty→`dbus-run-session` had a session bus but **no** `org.freedesktop.secrets` (gnome-keyring not shipped/started); `ensure_device_keys` failed. FE often hides the real invoke string. |
| **fix** | Ship `gnome-keyring`; `eliteew-ts-secrets-up` starts+unlocks login collection inside `dbus-run-session` before labwc/app |
| **verification** | Metal SSH via `.111`: after secrets up, `eliteew-device-request-*.json` in Import + `device_crypto_pub.json` |
| **also_affects** | Any headless/autologin host of Connected Client without Secret Service |

## Evidence

- `busctl`/`dbus-send`: `The name org.freedesktop.secrets was not provided by any .service files`
- Import writable (`_ssh_probe.txt`) but no request JSON until keyring unlocked
- After `gnome-keyring` + unlock on app bus: request JSON + crypto pub appeared
