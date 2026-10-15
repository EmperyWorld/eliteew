# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser opens as separate fullscreen window under labwc kiosk.
# ---

# EBrowser — separate fullscreen window (labwc ToggleFullscreen *)

| Field | Value |
|-------|--------|
| **status** | `fixed` (SoT; metal: refresh kiosk labwc rc + OTA client with `set_fullscreen(false)`) |
| **date** | `2026-09-10` |
| **product_id** | `desktop-client` |
| **also_affects** | `trusted-substrate` |
| **symptom** | EBrowser opens as its own fullscreen window covering the output instead of the in-app host surface |
| **failure layers** | labwc windowRules; parented X11 stage toplevel |
| **root cause** | Kiosk `windowRule identifier="*"` ran `ToggleFullscreen` on every mapped window. After `GDK_BACKEND=x11`, EBrowser stage is a distinct X11 toplevel → WM fullscreens it. |
| **fix** | Title-scoped ToggleFullscreen (launcher + product only); stage `set_fullscreen(false)` after bounds |
| **verification** | `cargo test` for `ebrowser_stage` locks `set_fullscreen(false)`; metal labwc smoke confirms stage bounds |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Do not

- Re-add `ToggleFullscreen` under `identifier="*"`.
- «Fix» by SPA fullscreen chrome hide.
