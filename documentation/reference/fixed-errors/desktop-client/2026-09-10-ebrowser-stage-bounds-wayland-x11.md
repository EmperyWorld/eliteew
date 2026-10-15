# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser stage paints from window top on Wayland (move no-op).
# ---

# EBrowser — stage bounds stuck at top (Wayland)

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **also_affects** | `trusted-substrate` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` |
| **commit** | — (Commit Package) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

EBrowser site content rendered from the top of the product window while the SPA host surface is lower (below chrome). Chrome appeared covered / misaligned.

## Failure layers

1. Stage is a parented `WebviewWindow`; bounds use `set_position` (GTK `move_`).
2. On Wayland, compositor ignores client toplevel moves — size applies, position stays default (0,0).
3. TS kiosk defaulted `GDK_BACKEND=wayland`.

## Root cause

Window-manager contract: Wayland does not allow the move API the stage bounds path relies on.

## What we did

- Client early hook: prefer `GDK_BACKEND=x11` when `DISPLAY` exists (XWayland), unless `ELITEEW_FORCE_GDK_WAYLAND=1`.
- TS kiosk default `GDK_BACKEND=x11`.
- Drift log when applied Y disagrees with request.

## Verification

```text
rg 'prefer_x11_backend_for_stage_windows|webviewwindow_stage_bounds' pack-organization/connection-agent/src-tauri/src/linux_runtime_noise.rs
rg 'GDK_BACKEND=.*x11' pack-organization/trusted-substrate/**/eliteew-ts-kiosk
```

## Recommendations

- Seats: OTA client ≥ fix; ensure labwc Xwayland enabled (`DISPLAY` set).
- Long-term: GtkFixed in-window embed removes X11 dependency for stages.
