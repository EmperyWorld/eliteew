# docker/stack/ — Compose inventory

Living Podman Compose files for EliteEW. Run from **repo root** with explicit `--env-file docker/env_file/...`.

Canon topology: `documentation/platform/PRODUCTION-TOPOLOGY-STATE.md` §Current.  
Dir map: `docker/README.md`, `documentation/platform/docker-re_doc/DOCKER-DIR-STRUCTURE.md`.  
Env pairing: `docker/env_file/README.md`.

## Prod-core (typical public runtime on `.111`)

| File | Env | Role |
|------|-----|------|
| `stack0_b.yml` + `stack0_b.prod-baked.override.yml` | `.env.stack0.backend` | API / workers / beat (baked line A) |
| `stack0_b.dev-bind.override.yml` | `.env.stack0.backend` | Dev-bind line B (mutually exclusive with baked) |
| `stack0_f.yml` + baked/dev-bind overrides | `.env.stack0.backend` | SPA frontend |
| `stack0_b_workers_lan.yml` | `.env.stack0.backend.lan141` (+ shared/jobs) | Optional LAN worker overlay |
| `stack1.yml` | `.env.stack1` | PG / Redis / Rabbit / Qdrant / Seaweed / ES / Chroma legacy |
| `stack2.yml` + `stack2.prod-core.override.yml` (+ `.baked.override.yml`) | `.env.stack2` | llama-chat on `.111` |
| `stack2-llama-remote-embed-rerank.yml` (+ `.host-net.yml`) | `.env.llama-remote` | gpu141 remote embed/rerank/tool-router |
| `stack4.yml` + `stack4.prod-baked.override.yml` | `.env.stack4` | OCR / Tika / Paperless path |
| `stack6.yml` + `stack6.prod-baked.override.yml` | `.env.stack6` | Keycloak |
| `stack11.yml` + `stack11/` | `.env.stack11` | Meet / Jitsi |
| `stack12.yml` | `.env.stack12` | CoreDNS internal sites |
| `stack-ewa-postgres.yml` | `.env.stack-ewa` | EWA companion Postgres |
| `stack-mobile-release.yml` + `mobile-release/` | `.env.stack-mobile-release` (example only until created) | OTA artifacts |
| `stack-yandex-tunnel.yml` | `.env.yandex-tunnel` | Edge reverse SSH (`builders/yandex-tunnel/`) |
| `kbsew.yml` | `.env.kbsew` | KBSEW service |
| `meet-edge-wg.yml` / `meet-edge-wg-client.yml` | `.env.meet-edge-wg*` | Meet WG edge |

## Profiles / overlays

| Path | Role |
|------|------|
| `profiles/stack2.prod-core.*.override.yml` | Model presets (gemma / etc.) for stack2 |

## Retained compose (not default prod; do not resurrect without operator task)

| File | Env | Note |
|------|-----|------|
| `stack3.yml` | `.env.stack3` | VictoriaLogs era |
| `stack5.yml` + `stack5/searxng.settings.yml` | `.env.stack5` | SearXNG / Crawl4AI era |
| `stack9.yml` | `.env.stack9` | Voice stack — explicit TZ only |
| `stack0_test.yml` | `.env.stack0.backend` | Local/test overlay |

## Soft-retired (do not recreate)

| Former | Where |
|--------|-------|
| `stack-ewc-postgres.yml` + `.env.stack-ewc` | `trash/` (Wave D1 / env-order 2026-08-15) |
| `stack666` / OpenVPN stack | `trash/` |

## Operator entry

```bash
source docker/scripts/eliteew-docker-aliases.sh
bash docker/scripts/eliteew-deploy.sh release stack0 --all   # line A
bash docker/scripts/eliteew-deploy.sh hotfix stack0 status   # active_line
bash docker/scripts/eliteew-prod-core-env-push.sh --validate-only
```
