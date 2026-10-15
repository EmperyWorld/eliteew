# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Personalize density: half-screen wallpaper theatre + peer-card dump.
# ---

# Personalize density — wallpaper theatre and Look heap

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md` §4 |
| **commit** | — (Commit Package pending) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

Wallpaper chooser/preview felt half-screen; Personalize body dumped peer cards; picker felt like a second Settings window.

## Failure layers

1. Sticky VS stage `min-h-64`/`sm:min-h-72` + full language card + second sticky try-on offset.
2. Wallpaper card `aspect-video` + `min-h-[140px]` duplicated sticky wallpaper stage.
3. Flat peer `SettingsFormCard` stack (theme / wallpaper / curated) without Look hierarchy.
4. WallpaperPicker `ModalAdvanced size="xl"` + 4-col video tiles.

## Root cause

Layout/IA composition treated sticky preview, language, wallpaper preview, and Look controls as independent peer theatres instead of one compact sticky stack + one Look group + one wallpaper representation.

## What we did

- Compact `stageDensity` on preview-only; language strip; try-on nested in same sticky stack.
- Wallpaper thumb + CTA inside Look group; ThemeAccent `embedded`.
- Picker `lg`, 5-col, shorter tiles, body max-h.
- SoT Everyday IA §4 + Vitest locks.

## Recommendations

- Do not reintroduce peer `aspect-video` wallpaper card or second sticky `top: 42vh`.
- Keep picker compact; sticky VS remains wallpaper SoT stage.
- Regression: EverydayIa + Personalize premium + WallpaperPicker tests.

## Verification

```text
pnpm exec vitest run …EverydayIa …premium …WallpaperPicker → 18 passed
pnpm exec biome check — changed TS → clean
```

## Residual risk

Browser sticky-height smoke after deploy (optional); try-on Save `.catch(() => {})` honesty is pre-existing, not introduced by density wave.
