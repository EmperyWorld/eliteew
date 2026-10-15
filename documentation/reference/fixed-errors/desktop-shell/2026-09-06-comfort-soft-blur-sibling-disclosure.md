# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Comfort soft-blur experimental was a sibling disclosure to
# session-status (Everyday IA Measure closeout).
# ---

# Comfort soft-blur sibling disclosure

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md` |
| **commit** | — |

## Symptom

Comfort tab presented soft-blur experiment / measure as a peer disclosure next to Session status; cognitive audit residual after Everyday IA waves.

## Failure layers

FE IA / disclosure hierarchy (Comfort primary vs support) — not copy-only.

## Root cause

Soft-blur measure lived as a sibling `<details>` instead of nesting under session-status support disclosure required by Everyday IA J5.

## What we did

- Nested `desktop-settings-comfort-experimental-effects` inside `desktop-settings-comfort-session-status`.
- Stripped dead Look SoT window/taskbar/widgets/opacity change handlers from Visual Studio preview popover chain.
- Retargeted Settings guide RU/EN steps to Everyday IA.
- Locks: EverydayIa + comfort-first + PerformanceTab tests.

## Recommendations

- Do not reintroduce soft-blur as Comfort-primary sibling disclosure.
- Look SoT hotspots must navigate to Chrome/Widgets — no second style grids on Personalize preview.

## Verification

```text
cd shared/web/frontend && pnpm exec vitest run \
  src/pages/Desktop/components/settings/__tests__/DesktopSettingsEverydayIa.contract.test.ts \
  src/pages/Desktop/components/settings/__tests__/DesktopSettingsPerformanceTab.comfort-first.contract.test.ts \
  src/pages/Desktop/components/settings/__tests__/DesktopSettingsPerformanceTab.test.tsx
→ pass
```

## Residual risk

Honest interface re-audit cognitive ≥15 still depends on browser smoke; code locks cover nesting and Look SoT navigate.
