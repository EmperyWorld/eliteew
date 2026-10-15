# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Kursorina mission vanishes after create (stale list race).
# ---

# Mission starts then disappears (stale list race)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

User launches an investigation: UI briefly shows queued/running, then returns to «Новое расследование» / empty history. Backend Celery still completes the mission.

## Failure layers

1. **FE list lifecycle (cause):** `fetchMissionsList` depended on `selectedId` / `isComposing`, so create → select re-fired list GET. In-flight/stale empty responses called `setMissions([])` and `setIsComposing(true)` with no AbortController / generation guard.
2. **Poll stop:** `activeMission` became null → poll effect cleaned up after ~2 GETs while worker ran ~90s.
3. **Backend:** Not at fault — POST 201, celery `completed`, no delete.

## Root cause

Stale `GET /missions?limit=30` overwrote optimistic create state and forced composer when the list looked empty.

## What we did

- Stable `fetchMissionsList` (refs, no selection deps).
- AbortController + generation token ignore late responses.
- `mergeServerMissions` keeps local-only create rows; `preferFresher` for overlapping ids.
- Empty list opens composer only when `selectedId` is null.
- Vitest lock: `missionListMerge.test.ts`.

## Recommendations

- List fetches must never full-replace local create without merge/abort.
- Do not put selection/composing into list-fetch `useCallback` deps.
- After create, Network: poll count ≫ 2 while status is running.

## Verification

```bash
cd shared/web/frontend && pnpm exec vitest run src/pages/Desktop/apps/kursorina/__tests__/missionListMerge.test.ts
```

Manual: empty history → create → late empty list must not restore composer; poll continues.

## Residual risk

Very old cached CDN SPA until edge/hotfix; hard-refresh required.
