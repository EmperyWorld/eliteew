# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# Host network apply dead on Trusted Substrate (pkexec + 30- drop-in)

| Field | Value |
|-------|--------|
| **status** | fixed |
| **date** | 2026-09-09 |
| **product_id** | desktop-client |
| **also_affects** | trusted-substrate |
| **severity** | Host Network panel «Применить» / Wi‑Fi |

## Symptom

On metal TS: cable settings shown, link UP, Apply does not change IPv4; Wi‑Fi block nagged about NetworkManager.

## Failure layers

1. Elevation: `pkexec` without Polkit agent on labwc kiosk.
2. networkd: drop-in `30-eliteew-*` sorts after SoT `20-wired.network` → first-match ignores panel config.

## Root cause

Wrong elevation path for embedded NOPASSWD wheel; wrong lexical drop-in name vs first-match policy.

## Fix

- `networkd::wired_apply`: `sudo -n bash` + dest `10-eliteew-<if>.network`; remove stale `30-` / install units.
- FE: omit Wi‑Fi section when `wifiSupported=false`.
- Semver **0.5.23**.

## Verification

- `cargo test -p desktop-client dropin_sorts_before_wired_default`
- Metal: Apply static → `ip -4 addr` shows address; no Wi‑Fi block on networkd backend.
