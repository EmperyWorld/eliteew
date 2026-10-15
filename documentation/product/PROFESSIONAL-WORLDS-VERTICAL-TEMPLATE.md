# Professional Worlds — Vertical Template Authoring Guide

Operator and engineer checklist for adding a **second (or Nth) profession** without forking the desktop shell.

Canon hub: [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md) · pack contract: [`PROFESSIONAL-WORLDS-PACK-V2-CONTRACT.md`](PROFESSIONAL-WORLDS-PACK-V2-CONTRACT.md)

## When to use this guide

Use when onboarding a new `vertical_slug` (pilot: **`consultant`**) with **core modules only** — no `{slug}_*` addon panels required on day one.

## Checklist (deploy a profession)

1. **Vertical row** — insert into `professional_verticals` (or seed migration) with `slug`, `name`, `profile_schema`, `workspace_template`.
2. **Core modules** — assign from catalog: `profile`, `clients`, `deals`, `learning`, `public-presence`, `artifacts`. Skip `objects` unless the vertical needs listing workspace (realtor-only today).
3. **Pack manifest** — author JSON under `documentation/product/packs/{slug}-core-pack-v1.json`; validate with pack import dry-run in admin.
4. **UGS types** — register `professional_worlds_{slug}_*` generation types before enabling AI actions.
5. **Learning seed** — optional course row scoped by `vertical_slug`.
6. **Playbooks (optional)** — module key `{slug}_playbooks`; nav appears only when module enabled **and** runtime config lists playbooks.
7. **i18n** — add `professionTools.professionNames.{slug}` and any addon labels under `professionalWorlds.json` (en + ru).
8. **Smoke** — `bash docker/scripts/professional-worlds-stack0-smoke.sh` plus manual: activate vertical → Overview → Clients (no Properties tab for non-realtor).

## Module naming rules

| Pattern | Use |
|---------|-----|
| Catalog keys (`clients`, `learning`, …) | Shared CRM / learning / brand surfaces — no App.tsx fork |
| `{slug}_playbooks` | Vertical playbooks nav + runtime panel |
| `{slug}_*` addon | Dedicated profession tools (realtor_pro, leads, …) — register in `runtimeModuleRegistry.tsx` or fall back to placeholder |

Generic helpers:

- `listCoreModuleKeys()` → shared catalog keys (`profile`, `clients`, `deals`, `learning`, `public-presence`, `artifacts`)
- `playbooksModuleKeyForVertical(slug)` → `{slug}_playbooks`
- `verticalSupportsListingWorkspace(slug)` → `slug === 'realtor'` when `objects` module enabled
- `mediaContextForVertical(slug)` → `'realtor'` for realtor; `null` for consultant and others (no listing media)

Implementation hub: `shared/web/frontend/src/features/professional-worlds/desktop/professionalVerticalTemplate.ts`.

## Media workbench facade (strategy 2A)

**FE module map (Wave E, 2026-08-10):** public import stays `desktop/ProfessionalMediaWorkbench.tsx` (thin re-export of `ProfessionalMediaWorkbench`, `PW_FALLBACK_PHOTO_PRESETS`, `ProfessionalMediaContextType`). Implementation under `desktop/mediaWorkbench/`: compose `ProfessionalMediaWorkbench.tsx`, hook `useProfessionalMediaWorkbench.ts`, panels (`MediaWorkbenchAttachedPhotos`, `MediaWorkbenchBatchProgress`, `MediaWorkbenchAlbumsPanel`, `MediaWorkbenchBrandKitPanel`, `MediaWorkbenchModals`), plus `constants` / `types` / `helpers` / `FieldGrid`. LOC lock: `mediaWorkbench/__tests__/ProfessionalMediaWorkbench.atomization.contract.test.ts`.

`ProfessionalMediaWorkbench` accepts vertical context without changing HTTP routes:

| Prop | Role |
|------|------|
| `targetId` | Listing/media target UUID (realtor property id) |
| `contextType` | `'realtor'` \| `'consultant'` |
| `propertyId` | Optional legacy alias → `targetId = propertyId ?? targetId` |

- **`contextType === 'realtor'`** — realtor media APIs via `desktop/media/realtorMediaAdapter.ts`.
- **`contextType === 'consultant'`** — honest empty/unavailable state; **no** realtor media API calls.

Backend mirror (no route migration): `api/services/professional_worlds/media_target_adapter.py` — `resolve_media_target(context_type, target_id)` with ownership check for realtor; structured unsupported error for consultant.

**Invariant:** existing `/professional-worlds/media/*` and realtor property media URLs stay unchanged in this wave — facade props and adapter only.

## FE extension (no shell fork)

- Nav built from runtime config + helpers in `activeViewModules.ts` / `verticalModuleLogic.ts`.
- Unknown `{slug}_*` keys → `RuntimePlaceholderPanel` (visible “coming soon”, not hidden).
- Multi-vertical switch: toolbar popover + `resolveActiveVerticalSlug()` on snapshot load.

## Admin / ops verification

- Overview tab: registry counts + **24h runtime** row (`playbook_runs_24h`, failures, artifacts, credits).
- **Ops** tab: DB probe + per-vertical usage table (`GET /professional-worlds/admin/ops/metrics`).

## Regression commands

```bash
cd shared/api && UV_PROJECT_ENVIRONMENT=../../.venv uv run pytest tests/test_professional_worlds_snapshot.py tests/test_professional_worlds.py -k consultant -q
cd shared/web/frontend && pnpm exec vitest run src/features/professional-worlds/desktop/verticalConstants.test.ts src/features/professional-worlds/desktop/professionalVerticalTemplate.test.ts
bash docker/scripts/professional-worlds-stack0-smoke.sh
```

## Reference seed

- Manifest: `documentation/product/packs/consultant-core-pack-v1.json`
- Migration: `shared/api/migrations/applied/20260702_01_pw_consultant_core_seed.sql`
