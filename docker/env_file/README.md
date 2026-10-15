# `docker/env_file` — secrets and templates

**Русский:** каталог для **`--env-file`** у Podman/Docker Compose.  
**Боевые** файлы `.env.*` (без `.example`) — plaintext staging **только на command-center `.136`**; **не коммитятся**.  
**Шаблоны** `*.example` — commit-safe (секреты = `CHANGE_ME`); структура синхронизируется с live при hygiene-волнах.

**English:** Compose `--env-file` directory. Live `.env.*` = staging on `.136` only (gitignored). `*.example` = committed redacted templates.

Config Plane: `documentation/platform/PROD-CORE-CONFIG-PLANE.md`  
Compose map: `docker/stack/README.md`

## Status matrix

| Class | Files | Notes |
|-------|-------|-------|
| **Living prod / staging** | `.env.stack0.backend`, `.env.stack1`, `.env.stack2`, `.env.stack4`, `.env.stack6`, `.env.stack11`, `.env.stack12`, `.env.stack-ewa`, `.env.yandex-tunnel`, `.env.kbsew`, `.env.llama-remote`, `.env.meet-edge-wg`, `.env.stack9` | Edit on `.136`; push via `eliteew-prod-core-env-push.sh` (bundle) |
| **Generated (do not hand-edit)** | `.env.stack0.shared`, `.env.stack0.api`, `.env.stack0.jobs` | From `stack0-env-materialize-roles.sh` |
| **Optional / overlay** | `.env.stack0.frontend`, `.env.stack0.backend.lan141`, `*.lan-bind.example`, `.env.stack0.backend.prod-baked.example` | LAN workers / baked image tag hints |
| **Retained offline** | `.env.stack3`, `.env.stack5` (+ examples) | Stacks not on default prod; keys often commented |
| **Soft-retired** | ~~`.env.stack-ewc`~~ | With `stack-ewc-postgres.yml` → `trash/` (Wave D1/env-order) |
| **Local tokens** | `.kbsew-internal.token` | Gitignored; KBSEW local smoke helper |
| **Brand template** | `brand_config.env.example` | Branding / volume name hints (not compose `--env-file` SSOT) |
| **Bundles** | `bundles/prod-core.env.tar.sops` | Encrypted Config Plane artifact (committed). Plaintext `prod-core.env.tar` gitignored — do not leave beside sops |

## Pairing: env ↔ compose

| Env file | Compose |
|----------|---------|
| `.env.stack0.backend` | `stack0_b.yml`, `stack0_f.yml` (+ baked/dev-bind overrides) |
| `.env.stack0.{shared,api,jobs}` | Container `env_file:` after materialize |
| `.env.stack0.backend.lan141` | `stack0_b_workers_lan.yml` |
| `.env.stack1` | `stack1.yml` |
| `.env.stack2` | `stack2.yml` (+ `stack2.prod-core*.override.yml`) |
| `.env.llama-remote` | `stack2-llama-remote-embed-rerank*.yml` (gpu141) |
| `.env.stack4` | `stack4.yml` |
| `.env.stack6` | `stack6.yml` |
| `.env.stack9` | `stack9.yml` |
| `.env.stack11` | `stack11.yml` |
| `.env.stack12` | `stack12.yml` |
| `.env.stack-ewa` | `stack-ewa-postgres.yml` |
| `.env.yandex-tunnel` | `stack-yandex-tunnel.yml` |
| `.env.kbsew` | `kbsew.yml` |
| `.env.meet-edge-wg` | `meet-edge-wg.yml` |
| `.env.meet-edge-wg-client.example` | `meet-edge-wg-client.yml` |
| `.env.stack-mobile-release.example` | `stack-mobile-release.yml` |
| `.env.stack3` / `.env.stack5` | `stack3.yml` / `stack5.yml` (retained) |

## Block layout

1. **Docker Compose** — variables from `${...}` in the matching `docker/stack/*.yml`.
2. **Optional** — sourced by ops scripts; compose may not interpolate them (noted in-file).

## Related

- `SYNC_STACK0_STACK1.md` — stack0/stack1 secret alignment (Paperless secrets live in `.env.stack4`).
- Role materialize: `bash docker/scripts/stack0-env-materialize-roles.sh`
- Bundle build/encrypt: `prod-core-env-bundle-build.sh` / `prod-core-env-sops-encrypt.sh`
- Example refresh (hygiene): rebuild `*.example` from live with secrets redacted to `CHANGE_ME` — never commit live `.env.*`

## Wave env-order (2026-08-15)

- Soft-retired leftover live `.env.stack-ewc`; removed plaintext `bundles/prod-core.env.tar` from working tree (sops remains).
- Regenerated drifted `*.example` from live key sets (stack0.backend, stack1/2/4/6/9/11/12, ewa, kbsew, yandex, llama-remote, meet-edge-wg, frontend).
