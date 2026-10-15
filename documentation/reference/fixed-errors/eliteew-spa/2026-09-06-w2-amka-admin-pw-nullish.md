# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — SPA TS hygiene W2 Cause B (AMKA / Admin / PW OpenAPI nullish).
# ---

# SPA W2: AMKA / Admin / PW nullish OpenAPI

| Field | Value |
|-------|--------|
| **product_id** | `eliteew-spa` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | marketing-cabinet (AMKA), Admin surveys/users, professional-worlds admin |
| **canon** | `documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md` (Wave M W2); readiness W2 projection |
| **commit** | — (Commit Package pending) |

## Symptom

After W1, SPA typecheck still ~437; AMKA 89 / Admin 38 / PW 35 dominated by TS18048/TS2322 on optional nested OpenAPI fields.

## Failure layers

1. OpenAPI optional nested objects/arrays consumed as required in Builder/Admin/PW UI.
2. Test fixtures lagging new required OpenAPI fields.
3. Minor: invalid button variant `"neutral"`; missing filter setter on Admin users hub type.

## Root cause

Cause B: generated optional/`null` shapes used without `??` / normalize-at-boundary / fixture completion.

## What we did

- AMKA: `normalizeAmkaOperatorConfigV1` from DEFAULT; plan/step optional guards; no invented `execution_mode` BE field.
- Admin: survey `?? []` / create required fields; `setSsoDesktopOnly` on filter state; MusicForge variant → `secondary`; diagnostics Error narrow; fixture props.
- PW: metrics/modules/playbooks `?? []`; overview pack counts in fixtures; zod status enum; showing status guard.

## Recommendations

- Prefer normalize-at-boundary for nested operator configs over per-field `!`.
- Do not silence with `as unknown as` (pre-existing AMKA alignment cast is out of W2 scope — follow-up).
- Next: W3 Desktop / desktop-ai-chat / ewa.

## Verification

```text
tsc: amka 0, Admin 0, PW 0; SPA total 274 (was 437)
lint / lint:api: clean
vitest: amkaViewUtils + adminUsersSummaryFilterApply + adminApi — 22 passed
```

## Residual risk

MarketingCabinet ~123 + Desktop/ewa clusters remain (W3+).
