# Developer setup from checked-in build files

How-to · source inspection dated 2026-10-11. Run commands from the repository root unless a block includes `cd`. This is a development entry guide; a production-ready one-command installation is not provided by these commands.

## Choose a scope

Start with [the source architecture](ARCHITECTURE-CODE-MAP.md) and [module map](../reference/SOURCE-MODULE-MAP.md). For a browser UI change, work in `shared/web/frontend`; for a shared endpoint, in `shared/api`. Android and the organization connection agent have separate toolchains. Local `.env` files, keys, keystores, generated assets and runtime data must stay outside documentation and version control.

## Python API tooling

[pyproject.toml](../../shared/api/pyproject.toml) requires Python >=3.14. [The host helper](../../scripts/eliteew/backend-venv-env.sh) selects a repository-root `.venv` and `PYTHONPATH=<repo>/shared`, the parent of the `api` package.

For a new development environment:

```bash
cd shared/api
UV_PROJECT_ENVIRONMENT=../../.venv uv sync --extra dev
cd ../..
bash scripts/eliteew/sync-host-api-venv.sh
```

The sync script installs the production-aligned API dependency surface plus host development tooling. It changes the virtual environment and can require network access; it was inspected, not executed during the documentation audit. [requirements.txt](../../shared/api/requirements.txt) delegates to [builder inputs](../../docker/builders/stack0-api/requirements/api.in); those inputs and locks are the runtime dependency authority.

With a prepared environment, these checks do not deploy services:

```bash
PYTHONDONTWRITEBYTECODE=1 bash scripts/eliteew/validate-app-manifests.sh
PYTHONDONTWRITEBYTECODE=1 bash scripts/eliteew/smoke-install-profile.sh --profile onprem-team-core
```

Both commands passed on 2026-10-11. They checked 22 manifests, 24 legacy component identifiers and four profiles; the community profile resolved 16 components with seat activation disabled. They do not install an edition or test a live API.

For a targeted unit test using the existing host environment:

```bash
cd shared/api
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_json_safe_smoke.py -q
```

Import path and interpreter location matter: from `shared/api`, the host interpreter is `../../.venv/bin/python`. The container environment is a separate `/app/.venv`. See [testing strategy](TESTING-STRATEGY.md) for the immutable runner and integration prerequisites.

## Starting a configured API

Prepare development-only environment values and infrastructure using [the configuration guide](INFRASTRUCTURE-SOURCE-GUIDE.md). A plain import/start may initialize clients or enforce worker readiness; a bare checkout is not a self-contained backend.

```bash
PYTHONPATH=shared .venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

The ASGI target and single-worker constraint come from [main.py](../../shared/api/main.py). This launch command was checked against source, but not run with live dependencies. Use a separate terminal for workers only after inspecting their queue and database requirements. Never point local experiments at production DSNs.

## Browser frontend

[package.json](../../shared/web/frontend/package.json) declares Node >=22.22.0 and pnpm >=12, and pins pnpm 12.4.1 through `packageManager`. Use the repository's package-manager pin; a global pnpm 10 installation does not satisfy it.

```bash
cd shared/web/frontend
corepack enable
pnpm --version
pnpm install --frozen-lockfile
VITE_DEV_SERVER_HMR_HOST=127.0.0.1 VITE_DEV_SERVER_CLIENT_PORT=3000 pnpm dev
```

`corepack` must be available independently; installing it was not part of this audit. The commands were inspected, not executed: the audit host's global pnpm was 10.34.6. Vite defaults to port 3000 and loopback binding, with a strict port. This starts UI development, not a fully integrated deployment.

Current [Vite configuration](../../shared/web/frontend/vite.config.ts) sends `/api` to `stack0-eliteew-api-prod:8000` and strips `/api`. That container hostname and rewrite are not a portable localhost-backend setup. HMR also defaults to a hosted domain unless overridden. `VITE_DEV_SERVER_HTTPS` currently enables the HTTPS branch when its value is the string `false`; do not infer conventional Boolean behavior from the variable name. These are recorded implementation limitations; application configuration was not changed by this audit.

Read [frontend developer entry](../product/FRONTEND-DEVELOPER-ENTRY.md) for boot ownership, client contracts and narrow regression commands. `pnpm run typecheck` checks types; `pnpm run build` does not invoke typecheck. Build output defaults to `dist-build`; `VITE_OUT_DIR` overrides it.

## Other entrances

- [Android](../../pack-cloud/mobile/README.md): Java 17, Android SDK, checked-in Gradle wrapper, independent modules/flavors.
- [Tauri connection agent](../../pack-organization/connection-agent/README.md): pnpm 11.21.0 pin, Rust/Tauri and platform-native build prerequisites. Its pin differs from the SPA pin.
- [Public Next.js site](../../shared/web/site_prod/README.md): separate package, lockfile, lead storage and lint tooling.
- [Olenti template](../../site-templates/olenti/README.md): separate Vite entries, Express API, Prisma/PostgreSQL and runtime profiles.
- [KBSEW](../../KBSEW/README.md): separate `api` package and service configuration.

## Quality checks and known drift

`bash tools/check_all.sh` runs architecture guard, the U3 import guard, Ruff and Biome. `bash scripts/eliteew/validate-local.sh` additionally drives frontend release checks and filtered backend tests. It is a broader local gate, not an exact reproduction of every GitHub job.

The frontend's declared `validate:eliteew` script points to `../../scripts/validate-local.sh`, which does not exist from that package. Invoke `bash scripts/eliteew/validate-local.sh` from the repository root. The checked-in primary CI workflow selects pnpm 10 while the SPA manifest requires pnpm >=12. Both mismatches require a separate code/configuration task; do not silently change dependencies during documentation work.

No formatter/fixer, dependency install, full SPA build, Android build, native bundle, database migration or deployment was executed for this documentation-only change. Test execution and limitations are recorded in [the audit report](../reference/DOCUMENTATION-AUDIT-REPORT.md).
