# Frontend license cleanup (MIT-first)

Living canon for **direct** SPA dependencies under `shared/web/frontend`.
Gate script: `pnpm licenses:check` → `shared/web/frontend/scripts/check-frontend-licenses.mjs`.

## Policy

- Prefer **MIT** (or MIT-compatible) for packages listed in `dependencies` / `devDependencies`.
- The gate rejects unknown or nonfree license buckets anywhere in the installed
  dependency graph unless an exact package version has an evidence-backed
  metadata resolution.
- Non-MIT directs need an explicit exception in `DIRECT_NON_MIT_EXCEPTIONS` with a reason.

## Current exceptions (direct)

| Package | License class | Reason |
| --- | --- | --- |
| `@eliteew/kernel-offline-policy` | MIT | First-party workspace package in the MIT product bundle |
| `@fontsource/*` | OFL | Bundled webfonts |
| `playwright` | Apache-2.0 | Dev-only E2E |
| `typescript` | Apache-2.0 | Dev-only compiler |
| `sharp` | Apache-2.0 | Optional image optimizer (`VITE_IMAGE_OPTIMIZER`) |

## Removed nonfree direct dependency (2026-09-28)

`gsap` 3.15.0 used the custom Standard No-Charge GSAP license rather than an
OSI/FSF free-software license. The Empery Nexus Chronicle animations now use
the already-shipped MIT `framer-motion` runtime and browser timers. GSAP is
absent from `package.json`, `pnpm-lock.yaml`, source imports, and the production
bundle dependency graph.

## Resolved transitive metadata

| Package | Scanner result | Verified license | Evidence |
| --- | --- | --- | --- |
| `khroma@2.1.0` | `Unknown` (package metadata omits the field) | MIT | [upstream v2.1.0 license](https://github.com/fabiospampinato/khroma/blob/v2.1.0/license) |

The script binds this resolution to version `2.1.0`; an upgrade returns to a
hard failure until its license evidence is reviewed.

## Removed dead directs (2026-08-09)

Zero `src/` imports; purged from `package.json` (+ related wiring):

| Package | Notes |
| --- | --- |
| `keycloak-js` | OIDC is `oauth4webapi` only; Apache exception removed from license gate; Vite `vendor-keycloak` chunk rule removed |
| `jspdf` | Unused |
| `codemirror` | Unused; Monaco owns code editing; workspace override + `codemirror-vendor` defer token removed |
| `immer` | No direct imports; remains transitive (zustand / R3F peers) |
| `jszip` | No direct imports; remains via `exceljs` |
| `rollup-plugin-polyfill-node` | Listed but not wired in `vite.config.ts` |

## Operator check

```bash
cd shared/web/frontend
pnpm licenses:check
```

## Related

- `platform/FRONTEND-TOOLCHAIN-AND-BUILD.md`
- `platform/DEPENDENCY-GOVERNANCE.md`
- Auth adapter: `platform/docker-re_doc/KEYCLOAK-ELITEEW.md` (historical `keycloak-js` iframe note only)
