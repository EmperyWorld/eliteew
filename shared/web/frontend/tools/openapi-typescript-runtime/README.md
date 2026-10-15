# openapi-typescript runtime (isolated)

SPA typecheck uses **TypeScript 7**. `openapi-typescript@7` still needs the classic Compiler API (`ts.factory`), which TS 7 no longer exports from the package root.

This directory is an **npm**-managed island (not part of the SPA pnpm workspace):

| Package | Version |
|---------|---------|
| `typescript` | 5.9.x |
| `openapi-typescript` | 7.13.x |

Install:

```bash
cd shared/web/frontend && pnpm run openapi:tooling:install
```

Callers use `scripts/openapi-typescript.sh` via `pnpm run openapi:pilot*`.
