# Olenti technical overview

Explanation · validated against the current template entry points on 2026-10-11. Paths are relative to `site-templates/olenti/`; the historical `active_job/Olenti` and nested `Olenti/` layouts are not the current checkout.

## Components and data flow

[main.tsx](../src/main.tsx) mounts [App](../src/App.tsx), a combined public/admin application. [main.public.tsx](../src/main.public.tsx) mounts [App.public](../src/App.public.tsx), the storefront build. `VITE_APP_ENTRY` selects an entry through the [Vite configuration](../vite.config.ts). This is two build entry points sharing source, not a separately maintained admin repository.

The frontend uses React, React Router, TanStack Query, Zustand and Axios. [API clients](../src/services/api/client.ts) separate public/admin token selection and retain a hybrid client. `VITE_API_URL` overrides the default `/api` base. A 401 clears the relevant stored token and redirects to the matching login route. Client-side session separation does not replace server authorization.

[The Express entry](../server/src/index.ts) loads dotenv, validates settings, configures Helmet/CORS/JSON middleware/rate limiting, static uploads/assets and Swagger, mounts public/admin routes, connects Prisma, and initializes in-process notification handling. [PrismaPg](../server/src/db.ts) connects PostgreSQL using `DATABASE_URL`. [The schema](../server/prisma/schema.prisma) and [migrations](../server/prisma/migrations/) define users, commerce/booking/content and configuration records.

## Background work and limits

[notificationQueue.ts](../server/src/queue/notificationQueue.ts) uses `setImmediate` or `setTimeout` and logs supported notification jobs. It does **not** use Redis/BullMQ and is not a durable external notification queue. Process restart loses pending timers; its compatibility options do not implement persistent retries/backoff.

[The general limiter](../server/src/middleware/rateLimiter.ts) uses `RateLimiterMemory`, with `RATE_LIMIT_POINTS`, `RATE_LIMIT_WINDOW` and an explicit disable flag. It is process-local, not a distributed Redis limiter. Admin login uses [its own limiter](../server/src/middleware/adminRateLimiter.ts). PostgreSQL is an actual dependency; the previous overview's mandatory Redis claim was stale.

Uploads are filesystem-backed and publicly served under `/uploads`; volume persistence and access policy must be chosen for the deployment. They are not the shared platform's S3 storage. [Site settings](../server/src/services/siteSettings.ts) read/write the `Config` namespace `site` and produce a payload containing contact, title/theme and URL fields. Responses synthesize `updatedAt`; it is not a stored last-change timestamp.

## Authentication, errors and configuration

[Authentication](../server/src/middleware/auth.ts) verifies signed JWTs and reloads the user from PostgreSQL, requiring an active account. `requireAdmin` requires role `ADMIN`. Bearer tokens take precedence over cookies; cookie selection has public/admin/legacy fallbacks. This is a local identity system, independent of shared API Keycloak configuration. [The admin reference](ADMIN_API_CONTRACT.md) details login/settings behavior and source route locations.

[Environment validation](../server/src/config/env.ts) requires `JWT_SECRET` (at least 32 characters) and `DATABASE_URL`. Public/admin origins and explicit CORS origins configure browser access; CORS is not an authentication rule. Optional admin bootstrap credentials are sensitive runtime values and must not be published. Seed/migration commands mutate the database and are not automatic acceptance evidence.

[Error middleware](../server/src/middleware/errorHandler.ts) returns operational errors as `{success:false,message}`, Prisma known request errors as 400 and unclassified errors as 500. Route-local validation/errors can differ. [The validation helper](../server/src/middleware/validate.ts) parses body/query/params; inspect each route before assuming a common body or response envelope.

## Development and builds

[The README](../README.md) contains the current scripts. Vite listens on 5173 and proxies to 3001; the API's default port is 3000, so set `PORT=3001` for the documented local pairing. An installed/generated Prisma client and prepared schema are prerequisites. [prisma.config.ts](../server/prisma.config.ts) owns migration/schema paths; template and demo seeds are separate scripts.

The frontend uses its own ESLint/Prettier toolchain. `vite:build:admin` builds the combined entry; `bundle:storefront` builds the public entry. The API's `tsc:build:api` generates Prisma before compiling. Installation, compilation, database provisioning and live request execution were not run in this documentation audit.

[Container packaging](DOCKER_REBUILD.md) has concrete source mismatches and is not an accepted full-stack recipe. [Template boundary](TEMPLATE_CORE.md), [runtime profiles](../../runtime-profiles/README.md) and [Site Studio](../../../documentation/platform/SITE-EDGE-CARRIER.md) explain integration ownership. Historical local container names/ports are observations, not default topology.
