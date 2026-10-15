# Olenti website template

Explanation · source inspection dated 2026-10-11. This template contains a React/Vite admin UI and storefront plus a separate Express/Prisma API. Site Studio can use [runtime profiles](../runtime-profiles/README.md) to specialize a template instance. It is separate from the shared FastAPI API and public Next.js landing package.

## Components

- [src/main.tsx](src/main.tsx): combined public/admin frontend entry.
- [src/main.public.tsx](src/main.public.tsx): storefront entry selected by `VITE_APP_ENTRY`.
- [server/src/index.ts](server/src/index.ts): Express server, API route mounts, static uploads/assets, Prisma connection and notification-worker startup.
- [server/prisma](server/prisma/): database schema and seed inputs.
- [package.json](package.json), [server/package.json](server/package.json): independent frontend/backend scripts and dependency declarations.

The API owns auth, products, consultations, masterclasses, bookings, orders, settings, gallery, schedules, favorites, content, presentations and admin configuration. `/api/health` is declared directly; `/api/docs` serves Swagger documentation. Route methods/body schemas must be checked in [server/src/routes](server/src/routes/), not inferred from these mount names.

## Environment and development

[Environment validation](server/src/config/env.ts) requires `DATABASE_URL` and `JWT_SECRET`; the latter must be at least 32 characters. The server loads dotenv. CORS uses public/admin frontend URLs plus explicit `CORS_ALLOWED_ORIGINS`. `UPLOADS_DIR`, `PORT` and `HOST` affect runtime. Supply development values privately; no credential values are included here.

With dependencies installed, in separate terminals:

```bash
cd site-templates/olenti
pnpm run vite:dev:admin
```

```bash
cd site-templates/olenti/server
PORT=3001 pnpm run tsx:dev:api
```

The Vite proxy defaults to `localhost:3001`; the API defaults to 3000, so the override above is intentional. A configured PostgreSQL database/schema is required; starting the API does not prove Prisma migrations or seed data have been applied. Database initialization is an operator action and was not performed in this audit.

## Builds and checks

Frontend scripts are `vite:build:admin`, `bundle:storefront`, `tsc:check`, `test`, and `check:uploads-bootstrap`. Server scripts include `tsc:build:api`, `node:start:api`, and Prisma generation/migration/seed commands. `tsc:build:api` runs Prisma generation before TypeScript compilation. These scripts were inspected, not executed.

This template has ESLint/Prettier scripts; the shared desktop SPA's Biome-only convention is not evidence that this package uses Biome. [docker-compose.yml](docker-compose.yml) still runs nonexistent `npm run dev` and lacks an API service, so it is not a working full-stack quick start. The API [Dockerfile](server/Dockerfile) also calls an absent `build` script. See [container packaging](docs/DOCKER_REBUILD.md) for these concrete limits.

## Related documents

- [Site edge carrier](../../documentation/platform/SITE-EDGE-CARRIER.md)
- [Source architecture](../../documentation/platform/ARCHITECTURE-CODE-MAP.md)
- [Template core](docs/TEMPLATE_CORE.md), [technical overview](docs/CURRENT_TECHNICAL_OVERVIEW.md), [admin API](docs/ADMIN_API_CONTRACT.md); these entry guides were reconciled with current source
