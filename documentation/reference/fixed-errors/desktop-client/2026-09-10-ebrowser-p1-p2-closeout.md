# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser P1/P2 gaps closed (policy push, audio_out, chrome, IPv6).
# ---

# EBrowser — P1/P2 closeout (policy refresh, audio_out, chrome, IPv6)

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **also_affects** | `desktop-shell` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` |
| **commit** | — (Commit Package) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

After P0 SoT fix, remaining audit gaps: Rust policy lagged up to TTL on admin tighten; `audio_out` only applied at attach; address bar ignored in-page nav; IPv6 allowlist incomplete in Rust/TS.

## Root cause

Missing force-refresh IPC, missing live WebKit settings re-apply, no location/history chrome bridge, IPv4-only CIDR helpers.

## What we did

- `ebrowser_refresh_policy` + SPA 60s force refresh
- `apply_audio_out_settings` on toggle
- `ebrowser_get_location` / history back-forward + chrome
- IPv6 CIDR in Rust/TS + golden tests; products.md + Vitest + backlog

## Verification

```text
cargo test ebrowser_
pytest tests/test_ebrowser_nav_policy.py -q
pnpm exec vitest run src/features/ebrowser src/pages/Desktop/apps/EBrowserApp
```

## Recommendations

- OTA TREE bump when operator schedules publish (`ebrowser-007`).
- Do not reintroduce SPA PolicySnapshot as SoT.
