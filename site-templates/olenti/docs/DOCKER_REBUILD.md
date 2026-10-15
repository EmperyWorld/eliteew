# Template build and container packaging

How-to/reference · checked against current scripts and manifests. The former destructive global-prune/rebuild recipe used obsolete paths and nonexistent package scripts. Rebuilding this template does not require deleting unrelated containers, images or database volumes.

## Package builds

With dependencies installed and the declared toolchain available, from the monorepository root:

```bash
cd site-templates/olenti
pnpm run bundle:storefront
# Alternative combined public/admin build:
# pnpm run vite:build:admin
```

For the API, in its own working directory:

```bash
cd site-templates/olenti/server
pnpm run tsc:build:api
```

Both frontend entries use the configured output directory (`dist` by default); choose the intended artifact before packaging. The API build generates Prisma and then TypeScript output. These commands were inspected, not executed in the documentation audit.

## Existing packaging limitations

- [Development compose](../docker-compose.yml) runs `npm run dev`, which the current frontend manifest does not define. It has frontend/database services, but no API service. It cannot provide the documented complete local app without a separate correction.
- [Production compose](../docker-compose.prod.yml) defines frontend, API and PostgreSQL with persistent upload/database volumes. Its existence is not proof of a successful current build or deployment.
- [The API Dockerfile](../server/Dockerfile) runs `npm run build`, absent from the current server manifest (`tsc:build:api` is declared). It also uses Node 20 image inputs; exact compatibility with current dependency engines needs verification.
- [Frontend packaging](../Dockerfile.prod) copies an already-built `dist` into nginx. [Nginx](../nginx/nginx.conf) proxies the API/uploads to a named service and uses Docker's resolver address `127.0.0.11`; Podman DNS portability is not established by this configuration.

Application/container configuration is outside the documentation task, so these files were not changed. Do not use the obsolete one-command recipe as a release runbook. Follow [README setup](../README.md) for the source/dev pairing until the packaging mismatch receives an authorized fix and validation.

## Verification before an authorized rollout

Review selected frontend entry, database initialization/migrations, secret delivery, uploads persistence, origin/cookie behavior and nginx proxy resolution. Check the affected service logs and HTTP/schema postconditions. A frontend `/health` response proves nginx is serving; it is distinct from API `/api/health` and does not prove database/schema readiness. No image build, compose restart, seed, database change or global cache/volume deletion was performed here.
