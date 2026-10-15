# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Personalize missing RU|EN switch; Visual Studio morph demo
# corner↔corner instead of window→taskbar.
# ---

# Personalize language + morph minimize path

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` (amended 2026-09-06: restore in-place hotspots; navigate-away rejected by operator) |
| **date** | `2026-09-06` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md` |
| **commit** | — |

## Symptom

No RU/EN control in Desktop Settings Personalize despite i18n + profile language API. Live preview «App» chip flew between top-right and bottom-left corners, so minimize animation looked wrong.

## Failure layers

- FE IA: language SoT missing from Personalize everyday column.
- FE theatre: morph `layoutId` anchors were corner↔corner, not window→taskbar.

## Root cause

Language lived only in profile/i18n detectors without a Settings surface; morph demo reused widget-corner placement instead of window/taskbar geometry.

## What we did

- `DesktopSettingsPersonalizeLanguageCard` + `applyDesktopUiLanguage` (i18n + optional `updateLanguage`).
- Morph chip anchored to window when expanded, taskbar when minimized (sibling of hotspots, not nested under them).
- SoT Everyday IA §3–§4 updated.

## Recommendations

- Keep language on Personalize primary; do not add a second language grid elsewhere.
- Morph demo must stay window→taskbar; do not re-nest morph under Look SoT hotspot buttons.

## Verification

```text
pnpm exec vitest run src/pages/Desktop/components/settings/__tests__/DesktopSettingsEverydayIa.contract.test.ts
pnpm exec vitest run src/pages/Desktop/utils/__tests__/applyDesktopUiLanguage.test.ts
```

## Residual risk

Unauthed users: localStorage i18n only (honest). Profile Language type allows more codes than Settings RU|EN — Settings clamps.
