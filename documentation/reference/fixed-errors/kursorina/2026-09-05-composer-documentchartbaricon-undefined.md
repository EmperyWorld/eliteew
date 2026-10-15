# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors entry — Kursorina composer ReferenceError DocumentChartBarIcon.
# ---

# Composer: DocumentChartBarIcon is not defined

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

Desktop app Курсорина crashed on open with `ReferenceError: DocumentChartBarIcon is not defined` (ErrorBoundary `KursorinaApp`). Console stack pointed at `KursorinaApp-*.js` capabilities row.

## Failure layers

1. **FE (cause):** Wave 3 capabilities row in `KursorinaComposer.tsx` used `<DocumentChartBarIcon />` without adding it to the `@heroicons/react/24/outline` import list.
2. **Build/deploy:** Vite/TS did not fail the release bake (JSX identifier treated as free global at runtime after minify); prod SPA shipped broken chunk.
3. **UX:** ErrorBoundary replaced the whole app — no composer, no missions UI.

## Root cause

Missing named import for an icon referenced in JSX after Wave 3 UI expansion.

## What we did

- Added `DocumentChartBarIcon` to imports in `shared/web/frontend/src/pages/Desktop/apps/kursorina/KursorinaComposer.tsx`.
- Redeploy FE (hotfix/release) + edge SPA sync.

## Recommendations

- When adding Heroicons in a file, import in the same edit; do not rely on another sibling file’s import.
- Prefer Biome/`tsc` path that flags undefined JSX identifiers if available; pre-ship smoke: open empty Kursorina composer once after FE bake.
- Wave tool UI changes: grep new icon names against each file’s import block before Commit Package.

## Verification

- `pnpm exec biome check` on `KursorinaComposer.tsx` — clean.
- `rg DocumentChartBarIcon` under `apps/kursorina` — Composer and FindingsView both import before use.
- Post-deploy: hard-refresh `app.eliteew.ru`, open Курсорина — no ReferenceError.

## Residual risk

Edge lag behind prod-core FE if edge deploy skipped — user may still see old chunk until edge sync.
