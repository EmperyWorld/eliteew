# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — FoFline browser tile called Tauri on EmpiierOS.
# ---

# FoFline browser tile called Tauri on EmpiierOS

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `contained` |
| **date** | `2026-09-20` |
| **also_affects** | `desktop-client` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` |
| **commit** | `30944c93c` |

## Symptom

The desktop browser tile on EmpiierOS FoFline does nothing or reports that it is not a native client. The OS seat browser overlay already works from the HUD.

## Failure layers

1. `foflineNative` was treated as Tauri.
2. `ebrowser_open` needs `__TAURI_INTERNALS__.invoke`, which EmpiierOS does not inject.
3. A nested `https` iframe is the Meet WebProcess crash, so it is not a fallback.

## Root cause

The tile had one native gate: Tauri invoke. EmpiierOS is FoFline plus `EmperyDesktopNativeOidc` and no invoke.

## What we did

`openEmpiierosSeatBrowser` / `closeEmpiierosSeatBrowser` call `window.EmperyDesktopSeatBrowser`. `https` only. No token. Missing host is `seat_browser_unavailable`. Tauri `ebrowser_open` stays. The tile is on the FoFline allowlist. W5 allows `/api/v1/ebrowser` for policy banners.

## Recommendations

Do not mount a browser iframe in the product WebView. Do not send refresh tokens to the host. Do not open an OS downloads folder from this tile.

## Verification

Vitest `ebrowserEmpiieros.test.ts` and `EBrowserApp.test.tsx`. Public spa-latest `1789890833725-7y746j4lvw`. Glass is hide/re-open after `spa_sync`. The host inject may still be absent; that outcome is `seat_browser_unavailable`, not a nested page.

## Residual risk

Until the OS injects `EmperyDesktopSeatBrowser`, the tile cannot show the overlay. Stack0 bake `1789891909119-45tkayntro` includes the allowlist.
