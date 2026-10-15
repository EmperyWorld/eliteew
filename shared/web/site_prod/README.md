# EliteEW public Next.js website

Explanation · source inspection dated 2026-10-11. This package serves the public landing pages and lead intake. User-created Site Studio sites have a separate runtime. Product/operations canon: [SITE-PROD-LANDING.md](../../../documentation/product/SITE-PROD-LANDING.md).

## Package and entry points

[package.json](package.json) declares Next.js **16.3.6**, React/React DOM **19.3.0**, Node >=20.9.0, TypeScript 7 tooling, Tailwind and Framer Motion. The previous README's Next 16.3.5 pin was stale; use the manifest/lockfile for version authority.

[App Router](src/app/) contains pages, [GET /health](src/app/health/route.ts) and [POST /api/lead](src/app/api/lead/route.ts). Typed Russian content lives in [src/content](src/content/). Lint uses [eslint-with-ts6.cjs](eslint-with-ts6.cjs) for this package; the shared desktop SPA separately uses Biome.

## Local commands

With compatible Node/pnpm installed:

```bash
cd shared/web/site_prod
pnpm install --frozen-lockfile
pnpm dev
pnpm run test:content
pnpm build
PORT=8080 pnpm start
```

The dev server defaults to port 3000. `pnpm start` requires the build output. [Dockerfile](Dockerfile) uses standalone Next output. [pnpm-workspace.yaml](pnpm-workspace.yaml) permits selected native dependency builds. Installation/build commands were inspected, not executed for this documentation change.

## Lead contract and storage

[leadSchema](src/lib/leadSchema.ts) validates the JSON request; quiz and bundle intents have additional required data. The route returns `ok`, `id` and `intent` on successful persistence. Errors use `ok: false`: invalid JSON/validation or missing intent data (400), rate limit with `Retry-After` (429), and persistence failure (500).

[leadStore](src/lib/leadStore.ts) appends records to `leads.jsonl` under `LEAD_DATA_DIR`, default `/tmp/eliteew-leads`, and optionally posts to `LEAD_WEBHOOK_URL`. A non-2xx webhook response is logged after the local append. A thrown network error can propagate after that append and make HTTP fail even though local data was written; webhook delivery is not an atomic transaction with file storage. The default temporary directory is not a durable storage guarantee.

Secrets must be supplied server-side; `LEAD_WEBHOOK_URL` must not be exposed to the browser. [rateLimit](src/lib/rateLimit.ts) owns throttling behavior.

## Deployment

[run-podman-secure.sh](run-podman-secure.sh) is the local container wrapper; [eliteew-landing-deploy.sh](../../../docker/scripts/eliteew-landing-deploy.sh) is the hosted deployment wrapper. Follow [production topology](../../../documentation/platform/PRODUCTION-TOPOLOGY-STATE.md) for host/container/port state. No deployment or live lead submission was performed by this audit.
