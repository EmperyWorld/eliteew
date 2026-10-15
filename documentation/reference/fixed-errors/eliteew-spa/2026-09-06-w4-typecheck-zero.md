# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — SPA TS hygiene W4 residual clear to typecheck 0.
# ---

# SPA W4: typecheck restored to 0

| Field | Value |
|-------|--------|
| **product_id** | `eliteew-spa` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | marketing-cabinet |
| **canon** | `documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md` Wave M W4 |
| **commit** | — (Commit Package pending) |

## Symptom

Post-W3 SPA typecheck **189** (MC ~123 + surveys/OIDC/DocEditor/config/other ~66).

## Root cause

(1) Compose hosts still erased query property access (`unknown`); (2) residual Cause B nullish + Cause C fixtures + vite import extensions.

## What we did

- `marketingCabinetComposeHosts.ts` QueryLike/MutationLike; ViewRouter/sections consume hosts
- Nullish/fixtures across MC + surveys + DocEditor + OIDC test stubs (`as unknown as` only in `__tests__`, allowlisted)
- vite/vitest drop `.ts` import extensions; e2e playwright types

## Verification

```text
pnpm run typecheck  # 0
pnpm run lint       # 0 warnings
pnpm run lint:api   # OK
```

## Residual risk

Future OpenAPI regen may reopen nullish — hygiene hooks block silence bags/casts on prod surfaces.
