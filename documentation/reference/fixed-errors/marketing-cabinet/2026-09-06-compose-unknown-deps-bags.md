# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors entry — MarketingCabinet compose bags typed as Record<string, unknown>
# after atomization (Cause A of SPA TS hygiene Wave M / W0+W1).
# ---

# MarketingCabinet compose unknown deps / bags

| Field | Value |
|-------|--------|
| **product_id** | `marketing-cabinet` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | `eliteew_frontend` (SPA typecheck gate); agent hygiene hooks |
| **canon** | `documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md` (Wave M); `documentation/reference/solution-readiness/README.md` (registry retired) |
| **commit** | — (Commit Package pending) |

## Symptom

`pnpm run typecheck` ~689 after Wave J/K zero baseline; MarketingCabinet ~376, of which ~148 `Type 'unknown' is not assignable…` cascading from compose builders. Biome: 2 warnings (unused import; dead `biome-ignore`).

## Failure layers

1. **FE atomization boundary** — `ComposeSlice` / bag deps as `Record<string, unknown>` erased field types.
2. **Compose call-site** — concrete RQ mutations / FormEvent handlers / `Dispatch` failed assignability into narrow `(…args: unknown[]) => …` (contravariance).
3. **Lock/hygiene** — unused import + dead biome-ignore (W0).

## Root cause

MarketingCabinet page atomization typed the compose/bag seam as opaque `unknown` records instead of named deps interfaces matching pre-split props.

## What we did

- Named `MarketingCabinetViewRouterComposeDeps` / `MarketingCabinetPageBagDeps` (no `Record<string, unknown>`).
- Bivariant `LooseFn` + `MutateHost` at compose/section-handler seams (React EventHandler pattern; `biome-ignore noExplicitAny` only on seam typedefs).
- Removed duplicate object keys in `useMarketingCabinetPageCompose` spreads.
- W0: unused import in `useSocketConnection.tsx`; dead `biome-ignore` in `MusicPlayerFavoriteHex.tsx`.
- Adjacent: AiRun query status nullish; CSV export nullish coalescing in section handlers.

## Recommendations

- Do **not** reintroduce `Record<string, unknown>` for Deps/Bag/ComposeSlice — hook `fe-ts-hygiene-gate.py` + rule `frontend-ts-hygiene.mdc`.
- Do **not** clear residuals with `@ts-ignore` / `as any` / `as unknown as`.
- Next wave (W2): Cause B OpenAPI optional/`null` → required without `??` (MC residual + AMKA/Admin/PW) — separate operator fork.

## Verification

```text
cd shared/web/frontend
pnpm run lint          # 0 warnings
pnpm run lint:api      # OK
pnpm exec tsc -p tsconfig.json --noEmit
# total 437 (was 689); MarketingCabinet 124 (was 376);
# hot builders/compose: 0 errors
```

## Residual risk

- ~124 MC + other clusters remain (Cause B/C — W2–W4).
- `LooseFn` uses seam-local `any` under biome-ignore — do not copy into feature UI props.
